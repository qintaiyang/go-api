import process from 'node:process';
import { log, COLORS } from './logger';

export const config = {
  apiKey: process.env.OPENCODE_GO_API_KEY || '',
  baseUrl: process.env.OPENCODE_GO_BASE_URL || 'https://opencode.ai/zen/go/v1',
  defaultModel: process.env.OPENCODE_MODEL || 'qwen3.6-plus',
  port: parseInt(process.env.PROXY_PORT || '4141', 10),

  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED === 'true',
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '30', 10),
  },
};

export let ALL_MODELS = [
  'qwen3.6-plus',
  'qwen3.5-plus',
  'glm-5.1',
  'glm-5',
  'kimi-k2.5',
  'kimi-k2.6',
  'mimo-v2-pro',
  'mimo-v2-omni',
  'mimo-v2.5-pro',
  'mimo-v2.5',
  'minimax-m2.7',
  'minimax-m2.5',
  'deepseek-v4-pro',
  'deepseek-v4-flash',
];

const ANTHROPIC_NATIVE = new Set([
  'minimax-m2.7',
  'minimax-m2.5',
  'qwen3.7-max',
  'qwen3.6-plus',
  'qwen3.5-plus',
]);

// Models that do NOT support vision/image input. Add new text-only models here.
export const NO_VISION = new Set([
  'deepseek-v4-pro',
  'deepseek-v4-flash',
]);

export function getModelEndpoint(model: string): string {
  if (ANTHROPIC_NATIVE.has(model)) {
    return `${config.baseUrl}/messages`;
  }
  return `${config.baseUrl}/chat/completions`;
}

export function isAnthropicNativeModel(model: string): boolean {
  return ANTHROPIC_NATIVE.has(model);
}

export async function refreshModels(): Promise<void> {
  try {
    const response = await fetch(`${config.baseUrl}/models`, {
      headers: { 'Authorization': `Bearer ${config.apiKey}` },
    });
    if (!response.ok) {
      log('WARN', `Failed to refresh models: HTTP ${response.status}`, COLORS.yellow);
      return;
    }
    const data = await response.json() as { data: Array<{ id: string }> };
    if (Array.isArray(data?.data) && data.data.length >= 3) {
      ALL_MODELS = [...new Set(data.data.map((m) => m.id).filter(Boolean))].sort();
      log('INFO', `Models refreshed: ${ALL_MODELS.length} available`, COLORS.green);
    } else {
      log('WARN', `Upstream returned too few models (${data?.data?.length}), keeping current list`, COLORS.yellow);
    }
  } catch (err) {
    log('WARN', `Failed to refresh models: ${err}`, COLORS.yellow);
  }
}
