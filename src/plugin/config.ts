import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, rmSync } from 'fs';
import { execSync } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';

const CLAUDE_SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');
const BACKUP_PATH = join(homedir(), '.claude', 'settings.json.bak');
const PLUGIN_INSTALL_DIR = join(homedir(), '.claude', 'plugins', 'go-api');

const CONTEXT7_MCP_KEY = 'context7';
const CONTEXT7_MCP_CONFIG = {
  command: 'npx',
  args: ['-y', '@upstash/context7-mcp'],
};

type HookGroup = { matcher: string; hooks: Array<{ type: string; command: string; timeout?: number }> };

export interface ClaudeSettings {
  hooks?: {
    SessionStart?: HookGroup[];
    [key: string]: unknown;
  };
  env?: Record<string, string>;
  mcpServers?: Record<string, { command: string; args: string[] }>;
  [key: string]: unknown;
}

export function readSettings(): ClaudeSettings {
  try {
    return JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

export function writeSettings(settings: ClaudeSettings, backup = false): void {
  const dir = join(homedir(), '.claude');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (backup && existsSync(CLAUDE_SETTINGS_PATH)) {
    writeFileSync(BACKUP_PATH, readFileSync(CLAUDE_SETTINGS_PATH));
  }
  writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n');
}

export function injectContext7Config(settings: ClaudeSettings): void {
  if (!settings.mcpServers) settings.mcpServers = {};
  if (!settings.mcpServers[CONTEXT7_MCP_KEY]) {
    settings.mcpServers[CONTEXT7_MCP_KEY] = CONTEXT7_MCP_CONFIG;
  }
}

export function removeContext7Config(settings: ClaudeSettings): boolean {
  if (settings.mcpServers?.[CONTEXT7_MCP_KEY]) {
    delete settings.mcpServers[CONTEXT7_MCP_KEY];
    if (Object.keys(settings.mcpServers).length === 0) delete settings.mcpServers;
    return true;
  }
  return false;
}

export interface ModelConfig {
  model?: string;
  haiku?: string;
  sonnet?: string;
  opus?: string;
  subagent?: string;
}

export function copyPluginToClaude(projectRoot: string): void {
  // 清除旧安装
  if (existsSync(PLUGIN_INSTALL_DIR)) {
    rmSync(PLUGIN_INSTALL_DIR, { recursive: true });
  }
  mkdirSync(PLUGIN_INSTALL_DIR, { recursive: true });

  // 复制 dist/ 和 bin/
  cpSync(join(projectRoot, 'dist'), join(PLUGIN_INSTALL_DIR, 'dist'), { recursive: true });
  cpSync(join(projectRoot, 'bin'), join(PLUGIN_INSTALL_DIR, 'bin'), { recursive: true });

  // 复制 package.json 并安装运行时依赖
  const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8'));
  const runtimeDeps = pkg.dependencies || {};
  const targetPkg = { name: 'go-api', private: true, dependencies: runtimeDeps };
  writeFileSync(join(PLUGIN_INSTALL_DIR, 'package.json'), JSON.stringify(targetPkg, null, 2));

  execSync('npm install --production --prefix ' + PLUGIN_INSTALL_DIR, { stdio: 'pipe' });
}

export function removePluginFromClaude(): void {
  if (existsSync(PLUGIN_INSTALL_DIR)) {
    rmSync(PLUGIN_INSTALL_DIR, { recursive: true });
  }
}

export function installPlugin(apiKey: string, projectRoot: string, models?: ModelConfig): void {
  const settings = readSettings();
  // Create single backup before any modification
  if (existsSync(CLAUDE_SETTINGS_PATH)) {
    writeFileSync(BACKUP_PATH, readFileSync(CLAUDE_SETTINGS_PATH));
  }

  // hooks
  if (!settings.hooks) settings.hooks = {};
  settings.hooks.SessionStart = [
    {
      matcher: 'startup|resume',
      hooks: [
        {
          type: 'command',
          command: `node ${join(PLUGIN_INSTALL_DIR, 'bin', 'cli.js')} start --daemon`,
          timeout: 15000,
        },
      ],
    },
  ];

  // env — base config
  if (!settings.env) settings.env = {};
  if (!settings.env.ANTHROPIC_BASE_URL) {
    settings.env.ANTHROPIC_BASE_URL = 'http://localhost:4141';
  }
  settings.env.ANTHROPIC_AUTH_TOKEN = apiKey;

  // env — model config
  if (models) {
    settings.env.ANTHROPIC_MODEL = models.model || 'deepseek-v4-flash[1m]';
    settings.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = models.haiku || models.model || 'deepseek-v4-flash[1m]';
    settings.env.ANTHROPIC_DEFAULT_SONNET_MODEL = models.sonnet || models.model || 'deepseek-v4-flash[1m]';
    settings.env.ANTHROPIC_DEFAULT_OPUS_MODEL = models.opus || models.model || 'deepseek-v4-pro[1m]';
    settings.env.CLAUDE_CODE_SUBAGENT_MODEL = models.subagent || models.model || 'deepseek-v4-flash[1m]';
    settings.env.CLAUDE_CODE_EFFORT_LEVEL = 'max';
    settings.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1';
  }

  // context7 MCP
  if (!settings.mcpServers) settings.mcpServers = {};
  if (!settings.mcpServers[CONTEXT7_MCP_KEY]) {
    settings.mcpServers[CONTEXT7_MCP_KEY] = CONTEXT7_MCP_CONFIG;
  }

  writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n');
}

export function injectPluginConfig(): void {
  const settings = readSettings();
  if (!settings.hooks) settings.hooks = {};
  settings.hooks.SessionStart = [
    { matcher: 'startup|resume', hooks: [{ type: 'command', command: `node ${join(PLUGIN_INSTALL_DIR, 'bin', 'cli.js')} start --daemon`, timeout: 15000 }] },
  ];
  if (!settings.env) settings.env = {};
  if (!settings.env.ANTHROPIC_BASE_URL) {
    settings.env.ANTHROPIC_BASE_URL = 'http://localhost:4141';
  }
  if (!settings.env.ANTHROPIC_AUTH_TOKEN) {
    settings.env.ANTHROPIC_AUTH_TOKEN = 'placeholder';
  }
  injectContext7Config(settings);
  writeSettings(settings);
}

export function removePluginConfig(): boolean {
  const settings = readSettings();
  let changed = false;
  if (settings.hooks?.SessionStart?.some((g) => hookHasPlugin(g as Record<string, unknown>))) {
    delete settings.hooks.SessionStart;
    changed = true;
  }
  if (settings.hooks && Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }
  if (settings.env?.ANTHROPIC_BASE_URL === 'http://localhost:4141') {
    delete settings.env.ANTHROPIC_BASE_URL;
    changed = true;
  }
  if (settings.env?.ANTHROPIC_AUTH_TOKEN === 'placeholder') {
    delete settings.env.ANTHROPIC_AUTH_TOKEN;
    changed = true;
  }
  if (settings.env && Object.keys(settings.env).length === 0) {
    delete settings.env;
  }
  changed = removeContext7Config(settings) || changed;
  if (changed) writeSettings(settings);
  if (changed) removePluginFromClaude();
  return changed;
}

function cmdHasPlugin(cmd?: string): boolean {
  if (!cmd) return false;
  return cmd.includes('plugins/go-api') || cmd.includes('plugins\\go-api');
}

function hookHasPlugin(hookGroup: Record<string, unknown>): boolean {
  const hooks = hookGroup.hooks as Array<{ command?: string }> | undefined;
  if (!hooks) return false;
  return hooks.some((h) => cmdHasPlugin(h.command));
}

function hasPluginHook(settings: ClaudeSettings): boolean {
  return !!settings.hooks?.SessionStart?.some((g) => hookHasPlugin(g as Record<string, unknown>));
}

export function isPluginInstalled(): boolean {
  const settings = readSettings();
  return !!(
    hasPluginHook(settings) &&
    settings.env?.ANTHROPIC_BASE_URL === 'http://localhost:4141' &&
    settings.mcpServers?.context7?.args?.some((a: string) => a.includes('context7-mcp'))
  );
}
