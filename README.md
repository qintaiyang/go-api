# go-api

一个 Claude Code 插件，将 Anthropic API 格式转换为 OpenCode Go API 格式，让你通过 OpenCode 使用开源模型（DeepSeek、Qwen、GLM、Kimi 等）。

安装后自动配置代理 + context7 文档查询工具，开箱即用。

---

## 如果你是 AI（自动安装）

<spec-for-ai>
请按以下步骤自动安装：

1. 切换到 `main` 分支
2. 运行 `npm install` 安装依赖
3. 运行 `npm run build` 编译项目
4. 运行 `node bin/cli.js install --api-key <用户的 OpenCode Go API Key>` 安装插件
   - 如果不知道 API Key，运行 `node bin/cli.js install` 进入交互模式，由用户输入
5. 安装完成后，每次启动 Claude Code 会话时自动运行代理
6. 用户可直接使用 `claude` 命令启动
</spec-for-ai>

## 如果你是人类（手动安装）

### 前置要求

- Node.js 18+
- OpenCode Go 订阅（获取 API Key: https://opencode.ai/auth）

### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/qintaiyang/go-api.git
cd go-api

# 2. 安装依赖
npm install

# 3. 编译
npm run build

# 4. 安装插件（交互式，会提示输入 API Key 和选择模型）
node bin/cli.js install
```

或者一键安装（跳过交互，使用默认模型）：

```bash
node bin/cli.js install --api-key <你的 OpenCode Go API Key>
```

### 启动 Claude Code

```bash
claude
```

每次启动 Claude Code 时，插件会自动启动代理（已运行则跳过），无需手动操作。

### 插件命令

| 命令 | 说明 |
|------|------|
| `go-api install` | 安装插件到 Claude Code（交互式配置） |
| `go-api install --api-key <key>` | 一键安装 |
| `go-api uninstall` | 卸载插件 |
| `go-api status` | 查看插件和代理状态 |
| `go-api start` | 前台启动代理 |
| `go-api start --daemon` | 后台启动代理 |

### 手动启动代理

```bash
node bin/cli.js start
```

### 卸载

```bash
node bin/cli.js uninstall
```

## 工作原理

```
Claude Code
  │
  ├─ SessionStart hook → 自动启动代理（~/.claude/plugins/go-api/）
  │
  ├─ ANTHROPIC_BASE_URL=http://localhost:4141
  │     ↓
  ├─ go-api 代理（端口 4141）
  │     ├── DeepSeek 模型 → 翻译为 OpenAI 格式 → OpenCode Go API
  │     ├── Qwen 模型     → Anthropic 透传     → OpenCode Go API
  │     └── MiniMax 等    → Anthropic 透传     → OpenCode Go API
  │
  └─ context7 MCP → 文档查询工具
```

## 功能

- **Anthropic ↔ OpenAI 格式转换** — 将 Anthropic Messages API 请求转为 OpenAI Chat Completions 格式，再将响应转回
- **流式 SSE 翻译** — 实时逐块翻译流式响应，完整保留 Anthropic 事件语义
- **智能路由** — Qwen/MiniMax 走 Anthropic 透传，DeepSeek 等走 OpenAI 翻译路径
- **工具调用** — 完整支持 Anthropic tool_use ↔ OpenAI function calls
- **思考/推理** — 保留并翻译 thinking 块，DeepSeek 模型原生支持
- **Web Search** — 支持 Claude Code 内置搜索功能
- **模型名映射** — claude-opus → deepseek-v4-pro, claude-sonnet/haiku → deepseek-v4-flash
- **动态模型列表** — 启动时自动从上游拉取最新模型
- **context7 集成** — 安装后自动注册文档查询 MCP 工具
- **交互式安装** — 安装时引导输入 API Key、选择模型

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENCODE_GO_API_KEY` | OpenCode Go API Key | - |
| `OPENCODE_GO_BASE_URL` | OpenCode Go API 地址 | `https://opencode.ai/zen/go/v1` |
| `OPENCODE_MODEL` | 默认模型 | `qwen3.6-plus` |
| `PROXY_PORT` | 代理端口 | `4141` |
| `RATE_LIMIT_ENABLED` | 启用速率限制 | `false` |

## 可用模型

| 模型 | 端点 | 用途 |
|------|------|------|
| DeepSeek V4 Pro | OpenAI | 复杂任务（Opus 级别） |
| DeepSeek V4 Flash | OpenAI | 快速任务（Haiku 级别） |
| Qwen3.7/3.6/3.5 Plus | Anthropic | 通用任务 |
| GLM-5/5.1 | OpenAI | 通用任务 |
| Kimi K2.5/K2.6 | OpenAI | 通用任务 |
| MiniMax M2.5/M2.7 | Anthropic | 通用任务 |
| MiMo V2.5/Pro/Omni | OpenAI | 通用任务 |

## 文档查询

安装插件时会自动注册 **context7** MCP 工具，可以直接向 Claude 询问库/框架的使用问题：

```
如何用 Express 设置 JWT 认证？
Next.js 的 App Router 怎么用？
```

## 许可证

MIT
