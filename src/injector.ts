import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parse, stringify } from 'smol-toml';
import type { Profile, AppStore } from './types.js';

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

const CODEX_DIR = join(homedir(), '.codex');
const AUTH_FILE = join(CODEX_DIR, 'auth.json');
const CONFIG_FILE = join(CODEX_DIR, 'config.toml');

/** 从当前 config.toml 读取需要保留的 section（trust/notice/mcp/tui 等） */
function readPreservedSections(): Record<string, any> {
  const preserved: Record<string, any> = {};
  if (!existsSync(CONFIG_FILE)) return preserved;
  try {
    const current = parse(readFileSync(CONFIG_FILE, 'utf-8'));
    // 这些 section 是 Codex CLI 自身管理的，cs 不应覆盖
    for (const key of ['projects', 'notice', 'mcp_servers', 'tui', 'features']) {
      if (current[key] !== undefined) preserved[key] = current[key];
    }
  } catch { /* 解析失败则放弃保留 */ }
  return preserved;
}

import { OVERRIDE_FIELDS } from './components/config/constants.js';

/** 注入 profile 到 config.toml 和 auth.json，只覆盖有值的字段 */
export function injectProfile(profile: Profile): void {
  ensureDir(CODEX_DIR);
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

  // 根据 constants 中定义的所有选项来进行动态多级路径覆盖
  for (const field of OVERRIDE_FIELDS) {
    if (!field.group?.startsWith('cfg_')) continue; // 只有 cfg_ 组才落盘 config.toml

    const val = profile[field.key];
    if (val !== undefined && val !== '') {
       let finalVal: any = val;
       if (field.type === 'bool') {
          finalVal = (val === 'true' || val === true);
       }
       
       // 根据 key 拆分路径，例如 "features.prevent_idle_sleep" -> { features: { prevent_idle_sleep: ... } }
       const parts = field.label.startsWith('features.') ? field.label.split('.') : field.key.split('.');
       let cur = config;
       for (let i = 0; i < parts.length - 1; i++) {
         if (!cur[parts[i]]) cur[parts[i]] = {};
         cur = cur[parts[i]];
       }
       cur[parts[parts.length - 1]] = finalVal;
    }
  }

  // 合并保留的 section（trust 等），profile 字段优先
  const preserved = readPreservedSections();
  for (const [key, val] of Object.entries(preserved)) {
    if (config[key] === undefined) config[key] = val;
    else if (typeof val === 'object' && !Array.isArray(val)) {
      config[key] = { ...val, ...config[key] };
    }
  }
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
  ensureDir(CODEX_DIR);
  writeFileSync(AUTH_FILE, JSON.stringify(backup.authJson, null, 2) + '\n');

  // 先读取当前 config 中需要保留的 section（trust 等）
  const preserved = readPreservedSections();

  // 写入 backup 的 config
  writeFileSync(CONFIG_FILE, backup.configToml);

  // 把保留的 section 合并回去
  if (Object.keys(preserved).length > 0) {
    try {
      const restored = parse(readFileSync(CONFIG_FILE, 'utf-8'));
      for (const [key, val] of Object.entries(preserved)) {
        if (restored[key] === undefined) restored[key] = val;
        else if (typeof val === 'object' && !Array.isArray(val)) {
          restored[key] = { ...(val as Record<string, any>), ...(restored[key] as Record<string, any>) };
        }
      }
      writeFileSync(CONFIG_FILE, stringify(restored) + '\n');
    } catch { /* backup 格式异常就不合并了 */ }
  }
  return true;
}
