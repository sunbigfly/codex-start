/**
 * ConfigUI 键盘输入路由 Hook -- 将 220 行的 useInput 从主组件中完整提取。
 * 按 focusState（left / right）分派到对应的处理函数。
 */
import { useInput } from 'ink';
import type { Profile, AppStore } from '../../types.js';
import { OVERRIDE_FIELDS, getGlobalVal } from './constants.js';
import { pushHistory } from '../../store.js';
import { applyTheme, themeOptions } from '../../theme.js';
import type { ActionContext } from './useConfigActions.js';
import {
  syncFieldToGlobal, batchSyncToGlobal, handleClone, handleExport,
  handleSetDefault, handleMoveProfile,
} from './useConfigActions.js';

export interface ConfigInputState {
  focusState: 'left' | 'right' | 'edit';
  selectedIdx: number;
  rightIdx: number;
  addMode: boolean;
  deleteMode: boolean;
  testMode: boolean;
  previewMode: boolean;
  importMode: boolean;
  historyFilter: 'global' | 'profile' | null;
  markedIds: Set<string>;
  lang: 'zh' | 'en';
  helpMode: boolean;
}

export interface ConfigInputSetters {
  setFocusState: React.Dispatch<React.SetStateAction<'left' | 'right' | 'edit'>>;
  setSelectedIdx: React.Dispatch<React.SetStateAction<number>>;
  setRightIdx: React.Dispatch<React.SetStateAction<number>>;
  setAddMode: React.Dispatch<React.SetStateAction<boolean>>;
  setDeleteMode: React.Dispatch<React.SetStateAction<boolean>>;
  setTestMode: React.Dispatch<React.SetStateAction<boolean>>;
  setPreviewMode: React.Dispatch<React.SetStateAction<boolean>>;
  setImportMode: React.Dispatch<React.SetStateAction<boolean>>;
  setHistoryFilter: React.Dispatch<React.SetStateAction<'global' | 'profile' | null>>;
  setMarkedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setLang: React.Dispatch<React.SetStateAction<'zh' | 'en'>>;
  setHelpMode: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useConfigInput(
  state: ConfigInputState,
  setters: ConfigInputSetters,
  store: AppStore,
  profiles: Profile[],
  selected: Profile | null,
  ctx: ActionContext,
  onExit: () => void,
) {
  const {
    focusState, selectedIdx, rightIdx,
    addMode, deleteMode, testMode, previewMode, importMode,
    historyFilter, markedIds, helpMode,
  } = state;

  const {
    setFocusState, setSelectedIdx, setRightIdx,
    setAddMode, setDeleteMode, setTestMode, setPreviewMode, setImportMode,
    setHistoryFilter, setMarkedIds, setLang, setHelpMode,
  } = setters;

  useInput((input: string, key: any) => {
    if (helpMode) return; // 让 HelpUI 自己接管它的关闭

    // 子模式完全接管输入
    if (testMode || addMode || deleteMode || focusState === 'edit' || previewMode || importMode) return;

    // ─── 右面板焦点 ──────────────────────────────
    if (focusState === 'right') {
      handleRightPanel(input, key);
      return;
    }

    // ─── 左面板焦点 ──────────────────────────────
    handleLeftPanel(input, key);
  });

  // ─── 右面板键盘处理 ──────────────────────────────

  function handleRightPanel(input: string, key: any) {
    // 历史过滤模式下的特殊处理
    if (historyFilter) {
      if (input === '?' || input === '？') { setHelpMode(true); return; }
      if (key.tab || (key as any).shiftTab || key.leftArrow) {
        setFocusState('left');
        return;
      }
      if (key.escape) {
        setHistoryFilter(null);
        setFocusState('left');
        return;
      }
      return;
    }

    if (key.escape || key.leftArrow) { setFocusState('left'); return; }
    if (key.upArrow) { setRightIdx(v => Math.max(0, v - 1)); return; }
    if (key.downArrow) { setRightIdx(v => Math.min(OVERRIDE_FIELDS.length - 1, v + 1)); return; }

    // Tab/Shift-Tab 跳组
    if (key.tab || (key as any).shiftTab) {
      handleTabNavigation(key);
      return;
    }

    const lcInput = input.toLowerCase();

    // 单字段同步至全局
    if (lcInput === 's') {
      if (!selected) return;
      const field = OVERRIDE_FIELDS[rightIdx];
      syncFieldToGlobal(field, selected, ctx);
      return;
    }

    // 批量同步至全局
    if (lcInput === 'g' && selected) {
      batchSyncToGlobal(selected, ctx);
      return;
    }

    if (lcInput === 'h') {
      setHistoryFilter('profile');
      setFocusState('right');
      return;
    }
    if (input === '?' || input === '？') { setHelpMode(true); return; }
    if (lcInput === 'p') { setPreviewMode(true); return; }
    if (lcInput === 'l') { setLang(v => v === 'zh' ? 'en' : 'zh'); return; }
    if (key.return || key.rightArrow) { setFocusState('edit'); return; }
  }

  // ─── Tab 跳组导航 ──────────────────────────────

  function handleTabNavigation(key: any) {
    const isShiftTab = key.shift || (key as any).shiftTab;
    const currGroup = OVERRIDE_FIELDS[rightIdx]!.group;
    if (isShiftTab) {
      const currGroupFirstIdx = OVERRIDE_FIELDS.findIndex(f => f.group === currGroup);
      if (currGroupFirstIdx <= 0) {
        const lastGroup = OVERRIDE_FIELDS[OVERRIDE_FIELDS.length - 1]!.group;
        setRightIdx(OVERRIDE_FIELDS.findIndex(f => f.group === lastGroup));
      } else {
        const prevGroup = OVERRIDE_FIELDS[currGroupFirstIdx - 1]!.group;
        setRightIdx(OVERRIDE_FIELDS.findIndex(f => f.group === prevGroup));
      }
    } else {
      let nextIdx = OVERRIDE_FIELDS.findIndex((f, idx) => idx > rightIdx && f.group !== currGroup);
      if (nextIdx === -1) nextIdx = 0;
      setRightIdx(nextIdx);
    }
  }

  // ─── 左面板键盘处理 ──────────────────────────────

  function handleLeftPanel(input: string, key: any) {
    if (key.escape) {
      if (historyFilter) { setHistoryFilter(null); return; }
      if (markedIds.size > 0) {
        setMarkedIds(new Set());
      } else {
        onExit();
      }
      return;
    }

    // 历史模式下阻止 profile 修改操作
    if (historyFilter) {
      if (input === '?' || input === '？') { setHelpMode(true); return; }
      if (key.tab || (key as any).shiftTab || key.return || key.rightArrow) { setFocusState('right'); return; }
      if (['a', 'c', 'd', 't', 'x', 'i', 'h', 'g', 'l', 'm', 'w', 'j', 'k', ' '].includes(input.toLowerCase())) return;
    }

    const lcInput = input.toLowerCase();

    if (lcInput === 'l') { setLang(v => v === 'zh' ? 'en' : 'zh'); return; }
    if (lcInput === 'a') { setAddMode(true); return; }

    if (lcInput === 'm' && selected) {
      const newSet = new Set(markedIds);
      if (newSet.has(selected.id)) newSet.delete(selected.id);
      else newSet.add(selected.id);
      setMarkedIds(newSet);
      return;
    }

    if (lcInput === 'd' && (markedIds.size > 0 || selected)) { setDeleteMode(true); return; }

    if (lcInput === 'c' && selected) {
      const result = handleClone(selected, ctx);
      setSelectedIdx(result.newIdx);
      return;
    }

    if (lcInput === 'x') { handleExport(ctx); return; }

    if (lcInput === 'i') { setImportMode(true); return; }

    if (lcInput === 'h') {
      if (!store.history || store.history.length === 0) {
        pushHistory(store, 'Initial Backup', { type: 'system', changes: [] });
        ctx.onUpdate({ ...store });
      }
      setHistoryFilter(profiles.length === 0 ? 'global' : 'profile');
      setFocusState('right');
      return;
    }
    if (input === '?' || input === '？') { setHelpMode(true); return; }

    if (lcInput === 'g' && selected) {
      batchSyncToGlobal(selected, ctx);
      return;
    }

    if (historyFilter && (key.tab || (key as any).shiftTab || key.rightArrow)) {
      setFocusState('right');
      return;
    }

    if (input === ' ' && selected) {
      handleSetDefault(selected, ctx);
      return;
    }

    if (lcInput === 't') { setTestMode(true); return; }
    if (lcInput === 'j' && selected) {
      const result = handleMoveProfile(1, selectedIdx, ctx);
      if (result) setSelectedIdx(result.newIdx);
      return;
    }
    if (lcInput === 'k' && selected) {
      const result = handleMoveProfile(-1, selectedIdx, ctx);
      if (result) setSelectedIdx(result.newIdx);
      return;
    }
    if (lcInput === 'w') {
      const currentTheme = store.globalTheme || 'mocha';
      const idx = themeOptions.indexOf(currentTheme);
      const nextTheme = themeOptions[(idx + 1) % themeOptions.length]!;
      const updated = { ...store, globalTheme: nextTheme };
      applyTheme(nextTheme);
      ctx.onUpdate(updated);
      ctx.showToast(`Theme: ${nextTheme}`, 'success');
      return;
    }
    if ((key.return || key.rightArrow || key.tab) && selected) { setFocusState('right'); return; }
  }
}
