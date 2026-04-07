import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parse, stringify } from 'smol-toml';
import type { Profile, AppStore } from './types.js';
import { OVERRIDE_FIELDS } from './components/config/constants.js';

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

const CODEX_DIR = join(homedir(), '.codex');
const AUTH_FILE = join(CODEX_DIR, 'auth.json');
const CONFIG_FILE = join(CODEX_DIR, 'config.toml');
const PRESERVED_SECTION_KEYS = ['projects', 'notice', 'mcp_servers', 'tui', 'features'] as const;

/** 从当前 config.toml 读取需要保留的 section（trust/notice/mcp/tui 等） */
function readPreservedSections(): Record<string, any> {
  const preserved: Record<string, any> = {};
  if (!existsSync(CONFIG_FILE)) return preserved;
  try {
    const current = parse(readFileSync(CONFIG_FILE, 'utf-8'));
    // 这些 section 是 Codex CLI 自身管理的，cs 不应覆盖
    for (const key of PRESERVED_SECTION_KEYS) {
      if (current[key] !== undefined) preserved[key] = current[key];
    }
  } catch { /* 解析失败则放弃保留 */ }
  return preserved;
}

function readConfigToml(): Record<string, any> {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    return parse(readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function parseConfigToml(raw: string): Record<string, any> {
  if (!raw.trim()) return {};
  try {
    return parse(raw);
  } catch {
    return {};
  }
}

function readAuthJson(): Record<string, unknown> {
  if (!existsSync(AUTH_FILE)) return {};
  try {
    return JSON.parse(readFileSync(AUTH_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function normalizeFieldValue(value: any, type?: string): any {
  if (type === 'bool') {
    return value === 'true' || value === true;
  }
  return value;
}

function getFieldPath(field: typeof OVERRIDE_FIELDS[number]): string[] {
  return field.label.startsWith('features.') ? field.label.split('.') : field.key.split('.');
}

function hasOwn(obj: Record<string, any>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function hasPath(obj: Record<string, any>, parts: string[]): boolean {
  let cur: any = obj;
  for (const part of parts) {
    if (!cur || typeof cur !== 'object' || !hasOwn(cur, part)) return false;
    cur = cur[part];
  }
  return true;
}

function getPath(obj: Record<string, any>, parts: string[]): any {
  let cur: any = obj;
  for (const part of parts) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

function setPath(obj: Record<string, any>, parts: string[], value: any): void {
  let cur: Record<string, any> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (!cur[part] || typeof cur[part] !== 'object' || Array.isArray(cur[part])) cur[part] = {};
    cur = cur[part] as Record<string, any>;
  }
  cur[parts[parts.length - 1]!] = value;
}

function deletePath(obj: Record<string, any>, parts: string[]): void {
  const walk = (target: Record<string, any>, idx: number): boolean => {
    const part = parts[idx]!;
    if (!hasOwn(target, part)) return Object.keys(target).length === 0;
    if (idx === parts.length - 1) {
      delete target[part];
      return Object.keys(target).length === 0;
    }
    const child = target[part];
    if (!child || typeof child !== 'object' || Array.isArray(child)) return false;
    const empty = walk(child as Record<string, any>, idx + 1);
    if (empty) delete target[part];
    return Object.keys(target).length === 0;
  };

  walk(obj, 0);
}

function sameValue(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function getManagedConfigPaths(profile: Profile): string[][] {
  const paths: string[][] = [
    ['model_provider'],
    ['model_providers', 'custom', 'name'],
    ['model_providers', 'custom', 'base_url'],
    ['model_providers', 'custom', 'wire_api'],
    ['model_providers', 'custom', 'requires_openai_auth'],
  ];

  for (const field of OVERRIDE_FIELDS) {
    if (!field.group?.startsWith('cfg_')) continue;
    const val = profile[field.key];
    if (val === undefined || val === '') continue;
    paths.push(getFieldPath(field));
  }

  return paths;
}

function applyProfileToConfig(config: Record<string, any>, profile: Profile): Record<string, any> {
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
    if (val === undefined || val === '') continue;
    setPath(config, getFieldPath(field), normalizeFieldValue(val, field.type));
  }

  return config;
}

function restoreProfileScopedBackup(backup: NonNullable<AppStore['backup']>, profile: Profile): boolean {
  const currentAuth = readAuthJson();
  const restoredAuth = cloneValue(currentAuth);

  if (currentAuth.OPENAI_API_KEY === profile.api_key) {
    if (Object.prototype.hasOwnProperty.call(backup.authJson, 'OPENAI_API_KEY')) {
      restoredAuth.OPENAI_API_KEY = backup.authJson.OPENAI_API_KEY;
    } else {
      delete restoredAuth.OPENAI_API_KEY;
    }
  }
  writeFileSync(AUTH_FILE, JSON.stringify(restoredAuth, null, 2) + '\n');

  const currentConfig = readConfigToml();
  const backupConfig = parseConfigToml(backup.configToml);
  const injectedConfig = applyProfileToConfig(cloneValue(backupConfig), profile);
  const restoredConfig = cloneValue(currentConfig);

  for (const path of getManagedConfigPaths(profile)) {
    if (!hasPath(injectedConfig, path) || !hasPath(currentConfig, path)) continue;
    const currentVal = getPath(currentConfig, path);
    const injectedVal = getPath(injectedConfig, path);

    // 只有当前值仍然等于本次注入值时，才说明这项没被用户后来改动，可以安全回滚。
    if (!sameValue(currentVal, injectedVal)) continue;

    if (hasPath(backupConfig, path)) {
      setPath(restoredConfig, path, cloneValue(getPath(backupConfig, path)));
    } else {
      deletePath(restoredConfig, path);
    }
  }

  writeFileSync(CONFIG_FILE, stringify(restoredConfig) + '\n');
  return true;
}

/** 注入 profile 到 config.toml 和 auth.json，只覆盖有值的字段 */
export function injectProfile(profile: Profile): void {
  ensureDir(CODEX_DIR);
  // 1. auth.json
  const auth = readAuthJson();
  auth.OPENAI_API_KEY = profile.api_key;
  writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2) + '\n');

  // 2. config.toml -- 读取现有配置，只覆盖 profile 中有值的字段
  const config = applyProfileToConfig(readConfigToml(), profile);

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

export function restoreBackup(backup: AppStore['backup'], profile?: Profile): boolean {
  if (!backup) return false;
  ensureDir(CODEX_DIR);
  if (profile) return restoreProfileScopedBackup(backup, profile);

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
