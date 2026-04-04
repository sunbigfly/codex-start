/**
 * ConfigUI 业务逻辑层 -- 将散落在 useInput / renderRightPanel 中的副作用操作提取为独立函数。
 * 纯逻辑，不含 React 组件/Hook（所以 .ts 后缀）。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Profile, AppStore, HistoryDelta } from '../../types.js';
import type { FieldDef } from './constants.js';
import { OVERRIDE_FIELDS, getGlobalVal } from './constants.js';
import {
  createProfile, pushHistory, saveGlobalConfigField,
  cloneProfile, exportProfiles, importProfiles,
} from '../../store.js';
import { restoreBackup } from '../../injector.js';

// ─── 类型 ──────────────────────────────────────────────

export interface ActionContext {
  store: AppStore;
  profiles: Profile[];
  globalConfig: Record<string, any>;
  onUpdate: (store: AppStore) => void;
  showToast: (text: string, type: 'success' | 'error', duration?: number) => void;
  setGlobalTick: React.Dispatch<React.SetStateAction<number>>;
}

// ─── 单字段同步至全局 ──────────────────────────────────

export function syncFieldToGlobal(
  field: FieldDef,
  selected: Profile,
  ctx: ActionContext,
): boolean {
  if (field.group === 'cfg_profile') return false;
  const val = (selected as any)[field.key] || '';
  const globalVal = getGlobalVal(ctx.globalConfig, field) || '';

  if (!val) {
    ctx.showToast(`[${field.label}] 暂无专属配置值，无法同步至全局`, 'error');
    return false;
  }
  if (val === globalVal) {
    ctx.showToast(`[${field.label}] 专属值与当前全局值无差异，无需写入`, 'error');
    return false;
  }

  saveGlobalConfigField(field.key, val);
  ctx.setGlobalTick(t => t + 1);
  ctx.showToast(`已成功同步 [${field.label}] 持久化写入全局配置`, 'success');
  const nextStore = { ...ctx.store };
  ctx.onUpdate(nextStore);
  pushHistory(nextStore, `Save [${field.label}] to Global`, {
    type: 'global',
    target: field.label,
    changes: [{ key: field.key, from: globalVal, to: val }],
  });
  return true;
}

// ─── 批量同步至全局 ──────────────────────────────────

export function batchSyncToGlobal(
  selected: Profile,
  ctx: ActionContext,
): boolean {
  const syncFields = OVERRIDE_FIELDS.filter(f => f.group !== 'cfg_profile');
  const changes: { key: string; from: string; to: string }[] = [];
  for (const f of syncFields) {
    const val = (selected as any)[f.key] || '';
    if (!val) continue;
    const gv = getGlobalVal(ctx.globalConfig, f) || '';
    if (val === gv) continue;
    saveGlobalConfigField(f.key, val);
    changes.push({ key: f.label, from: gv, to: val });
  }
  if (changes.length === 0) {
    ctx.showToast('当前 Profile 无差异配置需要同步至全局', 'error');
    return false;
  }
  ctx.setGlobalTick(t => t + 1);
  const nextStore = { ...ctx.store };
  ctx.onUpdate(nextStore);
  pushHistory(nextStore, `Batch Sync ${selected.name} to Global (${changes.length} fields)`, {
    type: 'global',
    target: selected.name,
    changes,
  });
  ctx.showToast(`已批量同步 ${changes.length} 项配置至全局 (from ${selected.name})`, 'success');
  return true;
}

// ─── 克隆 Profile ──────────────────────────────────────

export function handleClone(
  selected: Profile,
  ctx: ActionContext,
): { newProfiles: Profile[]; newIdx: number } {
  const cloned = cloneProfile(selected);
  const newProfiles = [...ctx.profiles, cloned];
  const nextStore = { ...ctx.store, profiles: newProfiles };
  ctx.onUpdate(nextStore);
  pushHistory(nextStore, `Clone Profile: ${selected.name} -> ${cloned.name}`, {
    type: 'profile',
    target: selected.name,
    changes: [{ key: 'clone', from: selected.name, to: cloned.name }],
  });
  ctx.showToast(`已克隆 "${selected.name}" -> "${cloned.name}"`, 'success');
  return { newProfiles, newIdx: newProfiles.length - 1 };
}

// ─── 导出 Profiles ─────────────────────────────────────

export function handleExport(ctx: ActionContext): void {
  const json = exportProfiles(ctx.profiles);
  const exportPath = join(homedir(), '.codex-start', 'profiles-export.json');
  writeFileSync(exportPath, json + '\n');
  ctx.showToast(`已导出 ${ctx.profiles.length} 个 profiles -> ${exportPath}`, 'success', 4000);
}

// ─── 导入 Profiles ─────────────────────────────────────

export interface ImportResult {
  success: boolean;
  newProfiles?: Profile[];
  newIdx?: number;
}

export function handleImport(
  path: string,
  ctx: ActionContext,
): ImportResult {
  try {
    let rawInput = path.trim().replace(/^['"]+|['"]+$/g, '');
    let json = '';
    let targetPath = '';
    if (rawInput.startsWith('[') || rawInput.startsWith('{')) {
      json = rawInput;
      targetPath = 'Raw JSON Text';
    } else {
      targetPath = rawInput || join(homedir(), '.codex-start', 'profiles-export.json');
      json = readFileSync(targetPath, 'utf-8');
    }
    const imported = importProfiles(json);
    const newValid: typeof imported = [];
    let skippedCount = 0;
    let renamedCount = 0;
    for (const p of imported) {
      const existing = ctx.profiles.find(ep => ep.name === p.name);
      if (existing) {
        if (existing.base_url !== p.base_url || existing.api_key !== p.api_key) {
          p.name = p.name + ' (imported_' + Math.random().toString(36).slice(2, 6) + ')';
          newValid.push(p);
          renamedCount++;
        } else {
          skippedCount++;
        }
      } else {
        newValid.push(p);
      }
    }
    if (newValid.length > 0) {
      const nextStore = { ...ctx.store, profiles: [...ctx.profiles, ...newValid] };
      ctx.onUpdate(nextStore);
      pushHistory(nextStore, `Import Profiles (${newValid.length})`, {
        type: 'system',
        target: 'Import',
        changes: [{ key: 'count', from: ctx.profiles.length, to: ctx.profiles.length + newValid.length }],
      });
      let msg = '成功导入 ' + newValid.length + ' 个 profiles <- ' + targetPath;
      if (skippedCount > 0 || renamedCount > 0) {
        msg += ' (跳过 ' + skippedCount + ' 个完全重复, 重命名追加 ' + renamedCount + ' 个)';
      }
      ctx.showToast(msg, 'success', 4000);
      return { success: true, newProfiles: [...ctx.profiles, ...newValid], newIdx: ctx.profiles.length };
    }
    ctx.showToast('无新配置导入，目标文件中的 ' + imported.length + ' 个配置均已完全存在', 'error', 4000);
    return { success: false };
  } catch (err: any) {
    ctx.showToast(`导入失败: ${err.message}`, 'error', 4000);
    return { success: false };
  }
}

// ─── 删除 Profiles ─────────────────────────────────────

export function handleDelete(
  toDeleteProfiles: Profile[],
  selectedIdx: number,
  ctx: ActionContext,
): { remaining: Profile[]; newIdx: number } {
  const toDeleteIds = new Set(toDeleteProfiles.map(p => p.id));
  const remaining = ctx.profiles.filter(p => !toDeleteIds.has(p.id));
  if (remaining.length > 0 && !remaining.some(p => p.isDefault)) remaining[0].isDefault = true;
  const nextStore = { ...ctx.store, profiles: remaining };
  ctx.onUpdate(nextStore);
  pushHistory(nextStore, `Delete ${toDeleteProfiles.length} Profiles`, {
    type: 'profile',
    target: toDeleteProfiles.map(p => p.name).join(', '),
    changes: toDeleteProfiles.map(p => ({ key: 'deleted', from: p.name, to: null })),
  });
  return {
    remaining,
    newIdx: Math.max(0, Math.min(selectedIdx, remaining.length - 1)),
  };
}

// ─── 设置默认 Profile ──────────────────────────────────

export function handleSetDefault(
  selected: Profile,
  ctx: ActionContext,
): Profile[] {
  const oldDefault = ctx.profiles.find(p => p.isDefault)?.name || '(none)';
  const nextProfiles = ctx.profiles.map(p => ({ ...p, isDefault: p.id === selected.id }));
  const nextStore = { ...ctx.store, profiles: nextProfiles };
  ctx.onUpdate(nextStore);
  pushHistory(nextStore, `Set default: ${selected.name}`, {
    type: 'profile',
    target: selected.name,
    changes: [{ key: 'isDefault', from: oldDefault, to: selected.name }],
  });
  return nextProfiles;
}

// ─── 添加 Profile ──────────────────────────────────────

export function handleAddProfile(
  addUrl: string, addKey: string, addName: string,
  ctx: ActionContext,
): { newProfiles: Profile[]; newIdx: number } {
  const p = createProfile({
    name: addName, base_url: addUrl, api_key: addKey,
    model: '', model_reasoning_effort: '', wire_api: '',
    personality: '', model_reasoning_summary: '', service_tier: '',
    disable_response_storage: '', approval_policy: '', sandbox_mode: '',
    web_search: '', requires_openai_auth: true, isDefault: ctx.profiles.length === 0,
  } as any);
  const newProfiles = [...ctx.profiles, p];
  const nextStore = { ...ctx.store, profiles: newProfiles };
  ctx.onUpdate(nextStore);
  pushHistory(nextStore, `Add Profile: ${addName}`, {
    type: 'profile',
    target: addName,
    changes: [{ key: 'profile', from: null, to: addName }],
  });
  return { newProfiles, newIdx: ctx.profiles.length };
}

// ─── 编辑字段 ──────────────────────────────────────────

export function handleEditField(
  selected: Profile,
  fieldIdx: number,
  val: string,
  ctx: ActionContext,
): void {
  const field = OVERRIDE_FIELDS[fieldIdx];
  const currentVal = (selected as any)[field.key] || '';
  const updated = ctx.profiles.map(p => p.id === selected.id ? { ...p, [field.key]: val } : p);
  const nextStore = { ...ctx.store, profiles: updated };
  ctx.onUpdate(nextStore);
  if (currentVal !== val) {
    pushHistory(nextStore, `Edit ${selected.name}: [${field.key}]`, {
      type: 'profile',
      target: selected.name,
      changes: [{ key: field.label || field.key, from: currentVal, to: val }],
    });
  }
}

// ─── 历史恢复 ──────────────────────────────────────────

export function handleHistoryRestore(
  store: AppStore,
  idx: number,
  ctx: ActionContext,
): Profile[] {
  const item = (store.history || [])[idx];
  if (!item) return store.profiles;

  // 1. 记录现状
  pushHistory(store, `Snapshot Before Restore: ${item.message.slice(0, 20)}...`);

  // 2. 执行物理回溯
  restoreBackup({ authJson: item.authJson, configToml: item.configToml });

  const restoredProfiles = JSON.parse(JSON.stringify(item.profiles || []));

  // 3. 记录回溯后状态
  const originalProfiles = store.profiles;
  store.profiles = restoredProfiles;
  pushHistory(store, `Snapshot After Restore (active): ${item.message.slice(0, 20)}...`, {
    type: 'system',
    target: 'Restore',
    changes: [{ key: 'status', from: 'reverting', to: 'active' }],
  });

  // 4. 提交到 UI store
  ctx.setGlobalTick(t => t + 1);
  const updateData = { ...store, profiles: restoredProfiles };
  ctx.onUpdate(updateData);

  return restoredProfiles;
}

// ─── 移动 Profile 顺序 ────────────────────────────────

export function handleMoveProfile(
  dir: -1 | 1,
  selectedIdx: number,
  ctx: ActionContext,
): { newProfiles: Profile[]; newIdx: number } | null {
  const newIdx = selectedIdx + dir;
  if (newIdx < 0 || newIdx >= ctx.profiles.length) return null;
  const newProfiles = [...ctx.profiles];
  [newProfiles[selectedIdx], newProfiles[newIdx]] = [newProfiles[newIdx]!, newProfiles[selectedIdx]!];
  ctx.onUpdate({ ...ctx.store, profiles: newProfiles });
  return { newProfiles, newIdx };
}
