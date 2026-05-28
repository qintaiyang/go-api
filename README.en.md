# go-api

A Claude Code plugin that translates Anthropic API format to OpenCode Go API format. Use open-source models (DeepSeek, Qwen, GLM, Kimi, etc.) with Claude Code.

## Installation

```bash
git clone https://github.com/qintaiyang/go-api.git
cd go-api
npm install
npm run build
node bin/cli.js install
```

## Usage

```bash
claude
```

The proxy starts automatically on each Claude session via SessionStart hook.

## Commands

| Command | Description |
|---------|-------------|
| `go-api install` | Install the plugin (interactive) |
| `go-api install --api-key <key>` | Install with API key (non-interactive) |
| `go-api uninstall` | Uninstall the plugin |
| `go-api status` | Check plugin and proxy status |
| `go-api start` | Start proxy (foreground) |
| `go-api start --daemon` | Start proxy (background) |

## License

MIT
