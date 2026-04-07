import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { nanoid } from 'nanoid';
import { parse, stringify } from 'smol-toml';
import type { Profile, AppStore, AppHistoryEntry, HistoryDelta } from './types.js';


const STORE_DIR = join(homedir(), '.codex-start');
const STORE_FILE = join(STORE_DIR, 'data.json');
const CODEX_DIR = join(homedir(), '.codex');
const AUTH_FILE = join(CODEX_DIR, 'auth.json');
const CONFIG_FILE = join(CODEX_DIR, 'config.toml');

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function loadStore(): AppStore {
  ensureDir(STORE_DIR);
  if (!existsSync(STORE_FILE)) return { profiles: [], backup: null };
  try {
    return JSON.parse(readFileSync(STORE_FILE, 'utf-8'));
  } catch {
    // JSON 损坏时返回空 store 而不是 crash
    return { profiles: [], backup: null };
  }
}

export function saveStore(store: AppStore): void {
  ensureDir(STORE_DIR);
  writeFileSync(STORE_FILE, JSON.stringify(store, null, 2) + '\n');
}

function readCurrentBackupState(): NonNullable<AppStore['backup']> {
  const authJson = existsSync(AUTH_FILE) ? JSON.parse(readFileSync(AUTH_FILE, 'utf-8')) : {};
  const configToml = existsSync(CONFIG_FILE) ? readFileSync(CONFIG_FILE, 'utf-8') : '';
  return { authJson, configToml };
}

export function ensureBackup(store: AppStore): AppStore {
  // backup 代表“本次启动前的当前全局状态”，不是永久冻结的初始值。
  // 这样用户在 cs 外手动修改 config.toml / auth.json 后，下次启动会以这些新值为基线。
  const current = readCurrentBackupState();
  const sameAuth = JSON.stringify(store.backup?.authJson ?? {}) === JSON.stringify(current.authJson);
  const sameConfig = (store.backup?.configToml ?? '') === current.configToml;
  if (sameAuth && sameConfig) return store;
  store.backup = current;
  saveStore(store);
  return store;
}

export function createProfile(data: Omit<Profile, 'id' | 'createdAt'>): Profile {
  return { ...data, id: nanoid(8), createdAt: new Date().toISOString() } as Profile;
}

/** 克隆一个 profile，生成新 ID 并在名称后加 (copy) */
export function cloneProfile(source: Profile): Profile {
  return {
    ...source,
    id: nanoid(8),
    name: `${source.name} (copy)`,
    isDefault: false,
    createdAt: new Date().toISOString(),
  };
}

/** 导出 profiles 为 JSON 字符串（保留明文 API Key） */
export function exportProfiles(profiles: Profile[]): string {
  return JSON.stringify(profiles, null, 2);
}

/** 从 JSON 字符串导入 profiles，为每个生成新 ID */
export function importProfiles(json: string): Profile[] {
  const arr = JSON.parse(json);
  if (!Array.isArray(arr)) throw new Error('Invalid format: expected array');
  return arr.map((p: any) => ({
    ...p,
    id: nanoid(8),
    createdAt: p.createdAt || new Date().toISOString(),
    isDefault: false,
  }));
}

/** 读取当前 config.toml 的全局值（作为 UI 展示 & 默认值参考） */
export function readCurrentConfig(): Record<string, any> {
  try {
    if (!existsSync(CONFIG_FILE)) return {};
    return parse(readFileSync(CONFIG_FILE, 'utf-8'));
  } catch { return {}; }
}

export function pushHistory(store: AppStore, message: string, delta?: HistoryDelta): AppStore {
  const authJson = existsSync(AUTH_FILE) ? JSON.parse(readFileSync(AUTH_FILE, 'utf-8')) : {};
  const configToml = existsSync(CONFIG_FILE) ? readFileSync(CONFIG_FILE, 'utf-8') : '';
  const currentProfiles = JSON.parse(JSON.stringify(store.profiles || []));
  
  if (store.history && store.history.length > 0) {
    const last = store.history[0];
    const sameAuth = JSON.stringify(last.authJson) === JSON.stringify(authJson);
    const sameConfig = last.configToml === configToml;
    const sameProfiles = JSON.stringify(last.profiles || []) === JSON.stringify(currentProfiles);
    
    // If we have a delta, we ALWAYS push even if states match (e.g. redundant but labelled operation)
    if (!delta && sameAuth && sameConfig && sameProfiles) {
      return store;
    }
  }

  const entry: AppHistoryEntry = {
    id: nanoid(8),
    timestamp: new Date().toISOString(),
    message,
    authJson,
    configToml,
    profiles: currentProfiles,
    delta,
  };
  store.history = store.history || [];
  store.history.unshift(entry);
  if (store.history.length > 50) {
    store.history = store.history.slice(0, 50);
  }
  saveStore(store);
  return store;
}

export function saveGlobalConfigField(fieldBaseKey: string, val: string | boolean): void {
  // 按照 injector.ts 的逻辑改写这个或者简单地在此处处理
  let config: Record<string, any> = {};
  if (existsSync(CONFIG_FILE)) {
    try {
      config = parse(readFileSync(CONFIG_FILE, 'utf-8'));
    } catch { }
  }
  
  if (fieldBaseKey.startsWith('features.')) {
    if (!config.features) config.features = {};
    const fk = fieldBaseKey.replace('features.', '').replace('_flag', '');
    if (val === '') delete config.features[fk];
    else config.features[fk] = val === 'true' ? true : (val === 'false' ? false : val);
  } else if (fieldBaseKey === 'shell_env_inherit') {
    if (!config.shell_environment_policy) config.shell_environment_policy = {};
    if (val === '') delete config.shell_environment_policy.inherit;
    else config.shell_environment_policy.inherit = val;
  } else if (fieldBaseKey === 'disable_response_storage') {
    if (val === '') delete config.disable_response_storage;
    else config.disable_response_storage = val === 'true' || val === true;
  } else {
    // Top-level key
    if (val === '') {
      delete config[fieldBaseKey];
    } else {
      config[fieldBaseKey] = val === 'true' ? true : (val === 'false' ? false : val);
    }
  }

  writeFileSync(CONFIG_FILE, stringify(config) + '\n');
}
