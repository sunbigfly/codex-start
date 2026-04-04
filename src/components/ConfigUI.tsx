import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { colors, symbols } from '../theme.js';
import type { Profile, AppStore } from '../types.js';
import { readCurrentConfig, pushHistory } from '../store.js';
import { computeNavWidth } from '../utils.js';
import { OVERRIDE_FIELDS, getGlobalVal } from './config/constants.js';
import { OverridesPanel } from './config/OverridesPanel.js';
import { FieldEditor } from './config/FieldEditor.js';
import { HistoryPanel } from './config/panels/HistoryPanel.js';
import { AddProfilePanel } from './config/panels/AddProfilePanel.js';
import { DeleteProfilePanel } from './config/panels/DeleteProfilePanel.js';
import { PreviewPanel } from './config/panels/PreviewPanel.js';
import { ImportProfilePanel } from './config/panels/ImportProfilePanel.js';
import { TestUI } from './config/panels/TestUI.js';
import { ProfileNavList } from './config/ProfileNavList.js';
import { ShortcutBar } from './config/ShortcutBar.js';
import { useConfigInput } from './config/useConfigInput.js';
import type { ActionContext } from './config/useConfigActions.js';
import { handleImport, handleDelete, handleAddProfile, handleEditField, handleHistoryRestore } from './config/useConfigActions.js';
import { restoreBackup } from '../injector.js';
import { HeaderLogo } from './HeaderLogo.js';
import { HelpUI } from './config/panels/HelpUI.js';

interface Props {
  store: AppStore;
  initialMode?: string;
  initialEditId?: string;
  onUpdate: (store: AppStore) => void;
  onExit: () => void;
}

export function ConfigUI({ store, initialMode, initialEditId, onUpdate, onExit }: Props) {
  // ─── 状态声明 ──────────────────────────────────

  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const initialIdx = useMemo(() => {
    if (!initialEditId) return 0;
    const idx = store.profiles.findIndex(p => p.id === initialEditId);
    return idx >= 0 ? idx : 0;
  }, [initialEditId, store.profiles]);

  const [selectedIdx, setSelectedIdx] = useState(initialIdx);
  const [focusState, setFocusState] = useState<'left' | 'right' | 'edit'>(initialEditId ? 'right' : 'left');
  const [rightIdx, setRightIdx] = useState(0);

  const [addMode, setAddMode] = useState(initialMode === 'add');
  const [deleteMode, setDeleteMode] = useState(false);
  const [testMode, setTestMode] = useState(initialMode === 'test' || initialMode === 'batch');
  const [historyFilter, setHistoryFilter] = useState<'global' | 'profile' | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [importMode, setImportMode] = useState(false);
  const [helpMode, setHelpMode] = useState(false);

  const initialTR = Object.fromEntries(
    Object.entries(store.testResults || {}).filter(([_, v]) => v === 'ok' || v === 'fail')
  ) as Record<string, 'ok' | 'fail' | 'running'>;
  const [testResults, setTestResults] = useState(initialTR);
  const [testDurations, setTestDurations] = useState<Record<string, number>>(store.testDurations || {});
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set());

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    const persistable = Object.fromEntries(
      Object.entries(testResults).filter(([_, v]) => v === 'ok' || v === 'fail')
    );
    const durPersist = { ...testDurations };
    for (const key of Object.keys(durPersist)) {
      if (!persistable[key]) delete durPersist[key];
    }
    onUpdate({ ...store, testResults: persistable, testDurations: durPersist });
  }, [testResults, testDurations]);

  const [globalTick, setGlobalTick] = useState(0);
  const [toastMsg, setToastMsg] = useState<{text: string, type: 'error' | 'success'} | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (text: string, type: 'success' | 'error', duration = 3000) => {
    setToastMsg({ text, type });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMsg(null), duration);
  };

  // ─── 派生值 ───────────────────────────────────

  const globalConfig = useMemo(() => readCurrentConfig(), [globalTick]);
  const profiles = store.profiles;
  const selected = profiles[selectedIdx] || null;

  // ─── Action 上下文 ────────────────────────────

  const actionCtx: ActionContext = {
    store, profiles, globalConfig, onUpdate, showToast, setGlobalTick,
  };

  // ─── 键盘输入路由 ────────────────────────────

  useConfigInput(
    { focusState, selectedIdx, rightIdx, addMode, deleteMode, testMode, previewMode, importMode, historyFilter, markedIds, lang, helpMode },
    { setFocusState, setSelectedIdx, setRightIdx, setAddMode, setDeleteMode, setTestMode, setPreviewMode, setImportMode, setHistoryFilter, setMarkedIds, setLang, setHelpMode },
    store, profiles, selected, actionCtx, onExit,
  );

  // ─── 右面板渲染 ──────────────────────────────

  const renderRightPanel = () => {
    if (historyFilter) {
      return (
        <HistoryPanel
          store={store}
          isActive={focusState === 'right'}
          filterMode={historyFilter}
          profileId={selected?.id}
          onRestore={(idx) => {
            const restoredProfiles = handleHistoryRestore(store, idx, actionCtx);
            setHistoryFilter(null);
            setFocusState('left');
          }}
          onDelete={(idx) => {
            const newHistory = [...(store.history || [])];
            if (idx === 'all') {
              newHistory.length = 0;
            } else {
              newHistory.splice(idx as number, 1);
            }
            onUpdate({ ...store, history: newHistory });
          }}
          onCancel={() => { setHistoryFilter(null); setFocusState('left'); }}
          onFocusLeft={() => setFocusState('left')}
          onToggleFilterMode={() => setHistoryFilter(prev => prev === 'global' ? 'profile' : 'global')}
        />
      );
    }

    if (previewMode && selected) {
      return (
        <PreviewPanel
          profile={selected}
          globalConfig={globalConfig}
          onClose={() => setPreviewMode(false)}
          onNextProfile={(dir) => {
            let newIdx = selectedIdx + dir;
            if (newIdx >= profiles.length) newIdx = 0;
            else if (newIdx < 0) newIdx = profiles.length - 1;
            setSelectedIdx(newIdx);
          }}
        />
      );
    }

    if (focusState === 'edit' && selected) {
      const field = OVERRIDE_FIELDS[rightIdx]!;
      const currentVal = (selected as any)[field.key] || '';
      const globalVal = getGlobalVal(globalConfig, field);
      return (
        <Box flexDirection="column" padding={1}>
          <Text color={colors.accent} bold>{symbols.dot} Editing: {selected.name} - {field.label}</Text>
          <FieldEditor
            field={field} currentValue={currentVal} globalValue={globalVal} lang={lang}
            profile={selected}
            onSave={(val) => {
              handleEditField(selected, rightIdx, val, actionCtx);
              setFocusState('right');
            }}
            onCancel={() => setFocusState('right')}
          />
        </Box>
      );
    }

    if (addMode) {
      return (
        <AddProfilePanel
          onAdd={(addUrl, addKey, addName) => {
            const result = handleAddProfile(addUrl, addKey, addName, actionCtx);
            setSelectedIdx(result.newIdx);
            setAddMode(false);
          }}
          onCancel={() => setAddMode(false)}
        />
      );
    }

    if (importMode) {
      return (
        <ImportProfilePanel
          onImport={(path) => {
            const result = handleImport(path, actionCtx);
            if (result.success && result.newIdx !== undefined) {
              setSelectedIdx(result.newIdx);
            }
            setImportMode(false);
          }}
          onCancel={() => setImportMode(false)}
        />
      );
    }

    if (deleteMode && (markedIds.size > 0 || selected)) {
      const toDeleteProfiles = markedIds.size > 0 ? profiles.filter(p => markedIds.has(p.id)) : [selected!];
      return (
        <DeleteProfilePanel
          profiles={toDeleteProfiles}
          onConfirm={() => {
            const result = handleDelete(toDeleteProfiles, selectedIdx, actionCtx);
            setSelectedIdx(result.newIdx);
            setMarkedIds(new Set());
            setDeleteMode(false);
          }}
          onCancel={() => setDeleteMode(false)}
        />
      );
    }

    return selected ? (
      <OverridesPanel profile={selected} activeFieldIdx={rightIdx} focusState={focusState} globalConfig={globalConfig} lang={lang} navWidth={computeNavWidth(profiles.map(p => p.name), 12, 14)} />
    ) : null;
  };

  // ─── TestUI 全屏接管 ─────────────────────────

  if (testMode && profiles.length > 0) {
    return (
      <TestUI
        profiles={profiles} globalConfig={globalConfig}
        testResults={testResults}
        setTestResults={setTestResults}
        testDurations={testDurations}
        setTestDurations={setTestDurations}
        onCancel={() => setTestMode(false)}
      />
    );
  }

  // ─── 空 profiles 提示 ────────────────────────

  if (profiles.length === 0 && !addMode && !historyFilter && !importMode) {
    return (
      <Box flexDirection="column" padding={1}>
        <HeaderLogo themeName={store.globalTheme || 'mocha'} />
        <Box marginBottom={1} marginTop={1}>
          <Text color={colors.accent} bold>{symbols.dot} Codex-Start</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={colors.dim}>[l] Toggle Lang  </Text><Text color={colors.muted}>No profiles. Press </Text>
          <Text color={colors.primary} bold>a</Text>
          <Text color={colors.muted}> to add.</Text>
        </Box>
      </Box>
    );
  }

  // ─── 主布局 ──────────────────────────────────

  if (helpMode) {
    const computedUiMode = historyFilter ? 'history' : (focusState === 'left' ? 'config-left' : 'config-right');
    return <HelpUI onClose={() => setHelpMode(false)} themeName={store.globalTheme || 'mocha'} uiMode={computedUiMode} />;
  }

  const navIsActive = focusState === 'left' && profiles.length > 0 && !addMode && !deleteMode && !testMode && !previewMode && !importMode && !helpMode;

  return (
    <Box flexDirection="column" padding={1}>
      <HeaderLogo themeName={store.globalTheme || 'mocha'} />
      <Box marginBottom={1} marginTop={1}>
        <Text color={colors.accent} bold>{symbols.dot} Codex-Start</Text>
      </Box>

      <Box borderStyle="round" borderColor={colors.dim} flexDirection="row" width="100%">
        <Box flexDirection="column" width={computeNavWidth(profiles.map(p => p.name), 12, 14)} borderStyle="single" borderTop={false} borderBottom={false} borderLeft={false} borderColor={colors.dim} padding={1} paddingRight={2}>
          <Text color={colors.muted} bold> Profiles</Text>
          <Box marginTop={1} flexDirection="column">
            <ProfileNavList
              profiles={profiles}
              selectedIdx={selectedIdx}
              isActive={navIsActive}
              testResults={testResults}
              testDurations={testDurations}
              markedIds={markedIds}
              addMode={addMode}
              deleteMode={deleteMode}
              onSelect={() => { setFocusState('right'); setRightIdx(0); }}
              onHighlight={(idx) => setSelectedIdx(idx)}
            />
          </Box>
        </Box>

        <Box flexDirection="column" flexGrow={1} padding={1} paddingLeft={2}>
          {renderRightPanel()}
        </Box>
      </Box>

      <Box height={1} marginY={1}>
        {toastMsg ? (
          <Text color={toastMsg.type === 'error' ? colors.warning : colors.success} bold>
            {toastMsg.type === 'error' ? '[!] ' : '[v] '} {toastMsg.text}
          </Text>
        ) : (
          <Text> </Text>
        )}
      </Box>

      <ShortcutBar
        focusState={focusState}
        historyFilter={historyFilter}
        markedIds={markedIds}
        isSubMode={addMode || deleteMode || testMode || previewMode || importMode}
      />
    </Box>
  );
}
