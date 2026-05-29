import { createInterface } from 'readline';
import { join } from 'path';
import { startDaemon, stop, isRunning } from './manager';
import { installPlugin, copyPluginToClaude, type ModelConfig, removePluginConfig, isPluginInstalled } from './config';

const PROJECT_ROOT = join(__dirname, '..', '..');

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';

const GO_MODELS_API = 'https://opencode.ai/zen/go/v1/models';

function log(tag: string, msg: string, color = RESET) {
  console.log(`  ${color}${tag}${RESET} ${msg}`);
}

function divider() {
  console.log(`  ${DIM}─────────────────────────────────────────────${RESET}`);
}

function printHeader(title: string) {
  console.log(`\n  ${BOLD}${CYAN}${title}${RESET}`);
  divider();
}

function promptForInput(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`  ${CYAN}?${RESET} ${question}`, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function extractApiKey(args: string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--api-key' && i + 1 < args.length) {
      return args[i + 1];
    }
  }
  return undefined;
}

async function fetchModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(GO_MODELS_API, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const data = await res.json() as { data: Array<{ id: string }> };
    return (data?.data || []).map((m: any) => m.id).sort();
  } catch {
    return [];
  }
}

function printModelMenu(models: string[], selected?: string): void {
  divider();
  console.log(`  ${BOLD}可用模型${RESET}`);
  divider();
  models.forEach((m, i) => {
    const num = String(i + 1).padStart(2, ' ');
    const mark = m === selected ? `${GREEN} ▶${RESET}` : '  ';
    console.log(`  ${DIM}${num}.${RESET}${mark} ${m}`);
  });
  divider();
}

async function selectModel(
  models: string[],
  prompt: string,
  defaultIdx = 0,
): Promise<string> {
  const answer = await promptForInput(`${prompt} ${DIM}(1-${models.length}, 回车=默认)${RESET}: `);
  const num = parseInt(answer, 10);
  if (num >= 1 && num <= models.length) {
    return models[num - 1];
  }
  return models[defaultIdx] || models[0];
}

export async function handleCommand(args: string[]): Promise<void> {
  const command = args[0];

  switch (command) {
    case 'install': {
      const apiKeyArg = extractApiKey(args);

      if (isPluginInstalled()) {
        printHeader('插件已安装');
        log('ℹ️', '插件已经安装，无需重复操作。', YELLOW);
        console.log();
        return;
      }

      printHeader('正在安装 go-api 插件');

      // ── Step 1: API Key ────────────────────────────────────
      let apiKey = apiKeyArg;
      if (!apiKey) {
        console.log();
        log('🔑', '需要配置 OpenCode API Key', YELLOW);
        apiKey = await promptForInput(`${BOLD}请输入你的 API Key${RESET} ${DIM}(输入后回车)${RESET}: `);
        while (!apiKey) {
          log('⚠️', 'API Key 不能为空，请重新输入', YELLOW);
          apiKey = await promptForInput(`${BOLD}请输入你的 API Key${RESET}: `);
        }
      }

      // ── Step 2: 获取模型列表 ────────────────────────────────
      console.log();
      log('🔍', '正在获取可用模型列表...', DIM);
      const models = await fetchModels(apiKey);
      if (models.length === 0) {
        log('⚠️', '无法获取模型列表，将使用默认配置', YELLOW);
      }

      // 默认模型配置
      let defaultModel = 'deepseek-v4-flash[1m]';
      let fastModel = 'deepseek-v4-flash[1m]';
      let sonnetModel = 'deepseek-v4-flash[1m]';
      let opusModel = 'deepseek-v4-pro[1m]';
      let subagentModel = 'deepseek-v4-flash[1m]';
      let wantsDetail = false;

      if (apiKeyArg) {
        // --api-key 模式：跳过交互，使用默认模型
        log('⚙️', `使用默认模型 ${CYAN}${defaultModel}${RESET} ${DIM}(--api-key 模式)${RESET}`);
      } else {
        // 交互模式：让用户选择
        if (models.length > 0) {
          console.log();
          log('🎯', `${BOLD}选择默认模型${RESET} ${DIM}(用于日常对话)${RESET}`);
          printModelMenu(models);
          defaultModel = await selectModel(models, '选择默认模型');
          fastModel = defaultModel;
          sonnetModel = defaultModel;
          opusModel = defaultModel;
          subagentModel = defaultModel;
        }

        // ── 细分角色配置 ──────────────────────────────────
        console.log();
        const detailAns = await promptForInput(
          `${BOLD}是否为不同任务分配不同模型?${RESET} ${DIM}(Y/n)${RESET}: `,
        );
        wantsDetail = detailAns.toLowerCase() !== 'n' && models.length > 0;

        if (wantsDetail) {
          console.log();
          log('⚙️', `${BOLD}细分模型配置${RESET}`);
          divider();
          log('📌', `${CYAN}Haiku${RESET} 快速任务 ${DIM}(代码补全/简单问答)${RESET}`);
          printModelMenu(models, fastModel);
          fastModel = await selectModel(models, '选择 Haiku 模型', models.indexOf(fastModel) + 1);

          console.log();
          log('📌', `${CYAN}Sonnet${RESET} 中等任务 ${DIM}(代码编写/重构)${RESET}`);
          printModelMenu(models, sonnetModel);
          sonnetModel = await selectModel(models, '选择 Sonnet 模型', models.indexOf(sonnetModel) + 1);

          console.log();
          log('📌', `${CYAN}Opus${RESET} 复杂任务 ${DIM}(架构设计/深度分析)${RESET}`);
          printModelMenu(models, opusModel);
          opusModel = await selectModel(models, '选择 Opus 模型', models.indexOf(opusModel) + 1);

          console.log();
          log('📌', `${CYAN}Subagent${RESET} 子代理模型 ${DIM}(后台任务)${RESET}`);
          printModelMenu(models, subagentModel);
          subagentModel = await selectModel(models, '选择 Subagent 模型', models.indexOf(subagentModel) + 1);
        }
      }

      // ── Step 3: 复制文件到 ~/.claude/plugins/go-api/ ──────────
      console.log();
      log('📦', '正在复制插件文件...', DIM);
      try {
        copyPluginToClaude(PROJECT_ROOT);
        log('✅', `插件已安装到 ~/.claude/plugins/go-api/`, GREEN);
      } catch (err) {
        log('❌', `复制失败: ${err}`, RED);
        process.exit(1);
      }

      // ── Step 4: 构建配置并写入 ──────────────────────────────
      const modelConfig: ModelConfig = {
        model: defaultModel,
        haiku: wantsDetail ? fastModel : undefined,
        sonnet: wantsDetail ? sonnetModel : undefined,
        opus: wantsDetail ? opusModel : undefined,
        subagent: wantsDetail ? subagentModel : undefined,
      };

      installPlugin(apiKey, PROJECT_ROOT, modelConfig);

      // ── Step 6: 显示配置摘要 ──────────────────────────────
      console.log();
      divider();
      console.log(`  ${BOLD}${GREEN}✅ 安装完成！配置摘要${RESET}`);
      divider();
      console.log(`    ${DIM}ANTHROPIC_BASE_URL${RESET}        http://localhost:4141`);
      console.log(`    ${DIM}ANTHROPIC_AUTH_TOKEN${RESET}      ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`);
      console.log(`    ${DIM}ANTHROPIC_MODEL${RESET}            ${CYAN}${defaultModel}${RESET}`);
      if (wantsDetail) {
        console.log(`    ${DIM}ANTHROPIC_HAIKU${RESET}            ${fastModel}`);
        console.log(`    ${DIM}ANTHROPIC_SONNET${RESET}           ${sonnetModel}`);
        console.log(`    ${DIM}ANTHROPIC_OPUS${RESET}             ${opusModel}`);
        console.log(`    ${DIM}CLAUDE_SUBAGENT${RESET}            ${subagentModel}`);
      }
      console.log(`    ${DIM}安装位置${RESET}                   ~/.claude/plugins/go-api/`);
      console.log(`    ${DIM}CLAUDE_CODE_EFFORT${RESET}          max`);
      console.log(`    ${DIM}context7 MCP${RESET}                ✅ 已注册`);
      console.log(`    ${DIM}SessionStart hook${RESET}           ✅ 已注册`);
      divider();

      console.log(`  ${GREEN}启动 Claude Code 即可使用${RESET}`);
      console.log(`  ${DIM}  $ claude${RESET}\n`);
      break;
    }

    case 'uninstall':
      if (!isPluginInstalled()) {
        printHeader('插件未安装');
        log('ℹ️', '没有找到插件配置。', YELLOW);
        return;
      }
      printHeader('正在卸载插件');
      if (isRunning()) {
        log('🛑', '正在停止代理...');
        stop();
        log('✅', '代理已停止', GREEN);
      }
      removePluginConfig();
      log('✅', '插件配置已从 ~/.claude/settings.json 中清理', GREEN);
      divider();
      console.log(`\n  ${GREEN}卸载完成${RESET}\n`);
      break;

    case 'status': {
      printHeader('插件状态');
      const installed = isPluginInstalled();
      const running = isRunning();
      log(installed ? '✅' : '❌', `插件: ${installed ? '已安装' : '未安装'}`, installed ? GREEN : YELLOW);
      log(running ? '✅' : '❌', `代理: ${running ? '运行中' : '已停止'}`, running ? GREEN : YELLOW);
      if (running) {
        log('🔌', `端口: ${process.env.PROXY_PORT || '4141'}`);
      }
      if (installed) {
        divider();
        log('💡', `运行 ${CYAN}go-api uninstall${RESET} 可卸载插件`);
      }
      console.log();
      break;
    }

    default:
      console.error(`\n  ❌ 未知命令: ${command}`);
      console.error(`  Usage: go-api <install|uninstall|status>\n`);
      process.exit(1);
  }
}
