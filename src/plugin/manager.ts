import { spawn, type ChildProcess } from 'child_process';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { homedir } from 'os';

const PLUGIN_DIR = join(homedir(), '.go-api');
const PID_FILE = join(PLUGIN_DIR, 'plugin.pid');
const SERVER_PORT = parseInt(process.env.PROXY_PORT || '4141', 10);

let currentProcess: ChildProcess | null = null;

function ensureDir(): void {
  if (!existsSync(PLUGIN_DIR)) mkdirSync(PLUGIN_DIR, { recursive: true });
}

function getServerPath(): string {
  return join(__dirname, '..', '..', 'dist', 'index.js');
}

async function waitForHealth(port: number, timeoutMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${port}/health`);
      if (res.ok) return true;
    } catch {
      // 服务器尚未就绪
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

export async function startDaemon(port = SERVER_PORT): Promise<boolean> {
  if (currentProcess || readPid()) {
    const healthy = await waitForHealth(port, 3000);
    if (healthy) return true;
    stop();
  }

  const serverPath = getServerPath();
  if (!existsSync(serverPath)) {
    console.error(`Server not found at ${serverPath}. Run 'npm run build' first.`);
    return false;
  }

  currentProcess = spawn(process.execPath, [serverPath, '--port', String(port)], {
    stdio: 'ignore',
    detached: true,
    env: { ...process.env, PROXY_PORT: String(port) },
  });

  currentProcess.unref();
  writePid(currentProcess.pid!);

  const ready = await waitForHealth(port);
  if (!ready) {
    console.warn('Warning: Proxy started but health check timed out.');
  }
  return ready;
}

export function stop(): void {
  if (currentProcess) {
    currentProcess.kill('SIGTERM');
    currentProcess = null;
  }
  const pid = readPid();
  if (pid) {
    try { process.kill(pid, 'SIGTERM'); } catch { /* 进程已结束 */ }
  }
  try { unlinkSync(PID_FILE); } catch { /* 文件不存在 */ }
}

export function isRunning(port = SERVER_PORT): boolean {
  return existsSync(PID_FILE) || !!currentProcess;
}

function readPid(): number | null {
  try {
    return parseInt(readFileSync(PID_FILE, 'utf-8').trim(), 10);
  } catch {
    return null;
  }
}

function writePid(pid: number): void {
  ensureDir();
  writeFileSync(PID_FILE, String(pid));
}
