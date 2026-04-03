import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parse, stringify } from 'smol-toml';
import type { Profile, AppStore } from './types.js';

const CODEX_DIR = join(homedir(), '.codex');
const AUTH_FILE = join(CODEX_DIR, 'auth.json');
const CONFIG_FILE = join(CODEX_DIR, 'config.toml');

/** 注入 profile 到 config.toml 和 auth.json，只覆盖有值的字段 */
export function injectProfile(profile: Profile): void {
  // 1. auth.json
  let auth: Record<string, unknown> = {};
  if (existsSync(AUTH_FILE)) auth = JSON.parse(readFileSync(AUTH_FILE, 'utf-8'));
  auth.OPENAI_API_KEY = profile.api_key;
  writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2) + '\n');

  // 2. config.toml -- 读取现有配置，只覆盖 profile 中有值的字段
  let config: Record<string, any> = {};
  if (existsSync(CONFIG_FILE)) config = parse(readFileSync(CONFIG_FILE, 'utf-8'));

  // API provider（必填，总是写入）
  config.model_provider = 'custom';
  if (!config.model_providers) config.model_providers = {};
  if (!config.model_providers.custom) config.model_providers.custom = {};
  config.model_providers.custom.name = 'custom';
  config.model_providers.custom.base_url = profile.base_url;
  config.model_providers.custom.wire_api = profile.wire_api || 'responses';
  config.model_providers.custom.requires_openai_auth = true;

  // 可选覆盖：有值才写，空字符串不动
  const optionals: [string, string][] = [
    ['model', profile.model],
    ['model_reasoning_effort', profile.model_reasoning_effort],
    ['personality', profile.personality],
    ['model_reasoning_summary', profile.model_reasoning_summary],
    ['service_tier', profile.service_tier],
    ['approval_policy', profile.approval_policy],
    ['sandbox_mode', profile.sandbox_mode],
    ['web_search', profile.web_search],
  ];
  for (const [key, val] of optionals) {
    if (val) config[key] = val;
  }

  // disable_response_storage 特殊处理（boolean）
  if (profile.disable_response_storage === 'true') config.disable_response_storage = true;
  else if (profile.disable_response_storage === 'false') config.disable_response_storage = false;

  writeFileSync(CONFIG_FILE, stringify(config) + '\n');
}

/** 构建 codex 启动命令行参数（从最终 config.toml 读取） */
export function buildLaunchArgs(profile: Profile): string[] {
  const args: string[] = [];
  // approval_policy 通过 CLI 参数传递更直观
  const approval = profile.approval_policy;
  if (approval && approval !== 'on-request') args.push('-a', approval);
  const sandbox = profile.sandbox_mode;
  if (sandbox && sandbox !== 'workspace-write') args.push('-s', sandbox);
  if (profile.web_search === 'live') args.push('--search');
  return args;
}

export function restoreBackup(backup: AppStore['backup']): boolean {
  if (!backup) return false;
  writeFileSync(AUTH_FILE, JSON.stringify(backup.authJson, null, 2) + '\n');
  writeFileSync(CONFIG_FILE, backup.configToml);
  return true;
}
