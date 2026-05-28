# go-api 项目

## 项目说明

将 Anthropic API 格式转换为 OpenCode Go API 格式的 Claude Code 插件。安装后自动配置代理 + context7 文档查询工具。

## 仓库

- GitHub: https://github.com/qintaiyang/go-api
- 本地: C:\Users\31439\Desktop\plugin

## 分支

- `main` — 稳定分支，推送到 GitHub
- `bate` — 开发测试分支

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run build` | 编译 TypeScript |
| `npm run dev` | 开发模式（tsx watch） |
| `npx tsc --noEmit` | 类型检查 |
| `npm test` | 运行测试 |
| `node bin/cli.js install` | 安装插件 |
| `node bin/cli.js start` | 启动代理 |
| `node bin/cli.js status` | 查看状态 |
| `node bin/cli.js uninstall` | 卸载插件 |

## 安装到 GitHub

```bash
git add -A
git commit -m "描述"
git push origin master:main --force
```

## 发布新版本

```bash
npm run build
node bin/cli.js install --api-key <key>
```

## 项目结构

```
src/
  index.ts       — Express 服务器主入口
  config.ts      — 配置、环境变量、模型列表
  types.ts       — TypeScript 类型定义
  logger.ts      — 日志工具
  translate.ts   — Anthropic ↔ OpenAI 格式翻译
  stream.ts      — SSE 流翻译
  opencode.ts    — OpenCode API 客户端
  plugin/        — 插件管理系统
    config.ts    — settings.json 读写、context7 MCP 注册
    index.ts     — CLI 命令分发
    manager.ts   — 代理进程生命周期管理
bin/
  cli.js         — CLI 入口
docs/
  PLUGIN.md      — 插件使用文档
```
