import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { nanoid } from 'nanoid';
import { parse, stringify } from 'smol-toml';
import type { Profile, AppStore, AppHistoryEntry } from './types.js';

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
  return JSON.parse(readFileSync(STORE_FILE, 'utf-8'));
}

export function saveStore(store: AppStore): void {
  ensureDir(STORE_DIR);
  writeFileSync(STORE_FILE, JSON.stringify(store, null, 2) + '\n');
}

export function ensureBackup(store: AppStore): AppStore {
  if (store.backup) return store;
  const authJson = existsSync(AUTH_FILE) ? JSON.parse(readFileSync(AUTH_FILE, 'utf-8')) : {};
  const configToml = existsSync(CONFIG_FILE) ? readFileSync(CONFIG_FILE, 'utf-8') : '';
  store.backup = { authJson, configToml };
  saveStore(store);
  return store;
}

export function createProfile(data: Omit<Profile, 'id' | 'createdAt'>): Profile {
  return { ...data, id: nanoid(8), createdAt: new Date().toISOString() };
}

/** 读取当前 config.toml 的全局值（作为 UI 展示 & 默认值参考） */
export function readCurrentConfig(): Record<string, any> {
  try {
    if (!existsSync(CONFIG_FILE)) return {};
    return parse(readFileSync(CONFIG_FILE, 'utf-8'));
  } catch { return {}; }
}

export function pushHistory(store: AppStore, message: string): AppStore {
  const authJson = existsSync(AUTH_FILE) ? JSON.parse(readFileSync(AUTH_FILE, 'utf-8')) : {};
  const configToml = existsSync(CONFIG_FILE) ? readFileSync(CONFIG_FILE, 'utf-8') : '';
  const entry: AppHistoryEntry = {
    id: nanoid(8),
    timestamp: new Date().toISOString(),
    message,
    authJson,
    configToml,
  };
  store.history = store.history || [];
  store.history.unshift(entry); // 最新的在前面
  // 限制最多保存 20 条以防止文件过大
  if (store.history.length > 20) {
    store.history = store.history.slice(0, 20);
  }
  saveStore(store);
  return store; // store 是引用的，可以直接返回
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
