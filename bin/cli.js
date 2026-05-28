#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);

// Parse --port from args and set env var so config.ts picks it up
let portFromArgs;
const remaining = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && i + 1 < args.length) {
    portFromArgs = args[i + 1];
    i++;
  } else if (args[i].startsWith('--port=')) {
    portFromArgs = args[i].split('=')[1];
  } else {
    remaining.push(args[i]);
  }
}

if (portFromArgs) {
  process.env.PROXY_PORT = portFromArgs;
}

const command = remaining[0];

if (command === 'start' || !command) {
  const isDaemon = remaining.includes('--daemon');
  const serverPath = path.join(__dirname, '..', 'dist', 'index.js');

  if (isDaemon) {
    // 后台模式 — 通过插件管理启动
    const fs = require('fs');
    if (!fs.existsSync(serverPath)) {
      console.error('Server not found. Run "npm run build" first.');
      process.exit(1);
    }
    // 使用动态 require 避免 dist 未构建时出错
    const { startDaemon } = require(path.join(__dirname, '..', 'dist', 'plugin', 'manager'));
    startDaemon(parseInt(process.env.PROXY_PORT || '4141', 10)).then((ready) => {
      if (ready) {
        console.log(`Proxy started on port ${process.env.PROXY_PORT || '4141'}`);
      } else {
        console.warn('Proxy may not be fully ready yet.');
      }
    });
    return;
  }

  // 前台模式（原有逻辑）
  const child = spawn('node', [serverPath], {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('error', (err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
} else if (command === 'install' || command === 'uninstall' || command === 'status') {
  const { handleCommand } = require(path.join(__dirname, '..', 'dist', 'plugin', 'index'));
  handleCommand(remaining).catch((err) => {
    console.error('Plugin command failed:', err.message);
    process.exit(1);
  });
} else if (command === '--help' || command === '-h' || command === 'help') {
  console.log(`
go-api - OpenCode Go API Proxy

Proxy service that translates Anthropic API format to OpenCode Go API format.
Use OpenCode models with Claude Code and other Anthropic-compatible tools.

Endpoints:
  POST /v1/messages              Anthropic Messages API
  POST /v1/chat/completions      OpenAI Chat Completions API
  POST /v1/embeddings            OpenAI Embeddings API
  GET  /v1/models                List available models
  GET  /health                   Health check

Usage:
  go-api start                  Start the proxy server
  go-api start --port 8080  Start on a custom port
  go-api                        (same as start)
  go-api --help                 Show this help message

Environment Variables:
  OPENCODE_GO_API_KEY     OpenCode Go API key (fallback if client doesn't provide one)
  OPENCODE_GO_BASE_URL    OpenCode Go API base URL (default: https://opencode.ai/zen/go/v1)
  OPENCODE_MODEL          Default model (default: qwen3.6-plus)
  PROXY_PORT              Proxy port (default: 4141)
  RATE_LIMIT_ENABLED      Enable rate limiting (default: false)
  RATE_LIMIT_WINDOW_MS    Rate limit window in ms (default: 60000)
  RATE_LIMIT_MAX          Max requests per window (default: 30)

Available Models:
  qwen3.6-plus          Qwen 3.6 Plus (default)
  qwen3.5-plus          Qwen 3.5 Plus
  minimax-m2.7          MiniMax M2.7
  minimax-m2.5          MiniMax M2.5
  glm-5.1               GLM 5.1
  glm-5                 GLM 5
  kimi-k2.6             Kimi K2.6
  kimi-k2.5             Kimi K2.5
  mimo-v2-pro           MiMo V2 Pro
  mimo-v2-omni          MiMo V2 Omni
  mimo-v2.5-pro         MiMo V2.5 Pro
  mimo-v2.5             MiMo V2.5
  deepseek-v4-pro       DeepSeek V4 Pro (Anthropic)
  deepseek-v4-flash     DeepSeek V4 Flash (Anthropic)

Example:
  go-api start
  go-api start --port 8080

Claude Code Integration:
  ANTHROPIC_BASE_URL=http://localhost:4141 \\
  ANTHROPIC_AUTH_TOKEN=your-opencode-key \\
  ANTHROPIC_MODEL=qwen3.6-plus \\
  claude

Plugin Commands:
  go-api install                        Install the plugin (writes Claude settings)
  go-api install --api-key <key>        Install and set API key in one step
  go-api uninstall                      Uninstall the plugin
  go-api status                         Check plugin and proxy status
  go-api start --daemon                 Start proxy in background (for hooks)
`);
} else {
  console.error(`Unknown command: ${command}`);
  console.error('Usage: go-api start');
  console.error('Run "go-api --help" for more information.');
  process.exit(1);
}
