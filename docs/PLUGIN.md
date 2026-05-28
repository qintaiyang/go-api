# go-api Claude Code 插件

## 安装

```bash
# 1. 构建项目
npm run build

# 2. 安装插件（写入 Claude Code settings.json）
go-api install

# 3. 启动 Claude Code
claude
```

插件安装时会提示你输入 API Key 并选择模型，自动完成所有配置。

## 命令

| 命令 | 说明 |
|------|------|
| `go-api install` | 安装插件到 Claude Code（交互式配置） |
| `go-api install --api-key <key>` | 一键安装，跳过交互 |
| `go-api uninstall` | 卸载插件 |
| `go-api status` | 查看插件和代理状态 |
| `go-api start` | 前台启动代理 |
| `go-api start --daemon` | 后台启动代理（供 `init` hook 使用） |

## 工作原理

1. **`install`** 写入 `.claude/settings.json`：
   - `hooks.SessionStart` — 每次会话启动时自动运行代理
   - `env` — API Key、模型配置等
   - `mcpServers.context7` — 注册文档查询工具
2. 启动 Claude Code 时自动执行 `SessionStart` hook → 后台启动代理
3. Claude Code 的请求通过 `ANTHROPIC_BASE_URL` 指向本地代理
4. 代理将 Anthropic 格式请求翻译为 OpenAI 格式，转发到 OpenCode API

## 文档查询

安装插件时会自动注册 **context7** 文档查询工具。安装后，你可以直接在 Claude 中询问库/框架的使用问题：

```
如何用 Express 设置 JWT 认证？
Next.js 的 App Router 怎么用？
Prisma 的关联查询怎么写？
```

Claude 会自动调用 context7 工具查询最新文档并回答。

## 模型映射

插件自动将 Claude 模型名映射到 upstream 模型：

| Claude 模型名 | 实际模型 |
|--------------|---------|
| `claude-opus-*` | `deepseek-v4-pro` |
| `claude-sonnet-*` | `deepseek-v4-flash` |
| `claude-haiku-*` | `deepseek-v4-flash` |

## 模型列表

启动时自动从上游 API 拉取最新模型列表。如果无法获取，使用内置的预配置列表。

## Web Search

插件支持 Claude Code 的 Web Search 功能。当模型判断需要搜索时，会自动调用 `web_search` 工具获取最新信息。代理的翻译层会正确传递工具调用。

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENCODE_GO_API_KEY` | OpenCode API Key | - |
| `OPENCODE_GO_BASE_URL` | OpenCode API 基础地址 | `https://opencode.ai/zen/go/v1` |
| `OPENCODE_MODEL` | 默认模型 | `qwen3.6-plus` |
| `PROXY_PORT` | 代理端口 | `4141` |
| `RATE_LIMIT_ENABLED` | 启用速率限制 | `false` |

## 卸载

```bash
go-api uninstall
```

这将：
- 清理 `.claude/settings.json` 中的插件配置
- 停止正在运行的代理
- 创建 settings.json 备份（`.claude/settings.json.bak`）
