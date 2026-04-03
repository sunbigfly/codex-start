import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { colors, symbols, applyTheme, themeOptions } from '../theme.js';
import type { Profile, AppStore } from '../types.js';
import { readCurrentConfig, createProfile, pushHistory, saveGlobalConfigField, cloneProfile, exportProfiles } from '../store.js';
import { computeNavWidth } from '../utils.js';
import { OVERRIDE_FIELDS, getGlobalVal } from './config/constants.js';
import { OverridesPanel } from './config/OverridesPanel.js';
import { FieldEditor } from './config/FieldEditor.js';
import { HistoryPanel } from './config/panels/HistoryPanel.js';
import { AddProfilePanel } from './config/panels/AddProfilePanel.js';
import { DeleteProfilePanel } from './config/panels/DeleteProfilePanel.js';
import { PreviewPanel } from './config/panels/PreviewPanel.js';
import { TestUI } from './config/panels/TestUI.js';
import { restoreBackup } from '../injector.js';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

interface Props {
  store: AppStore;
  initialMode?: string;
  initialEditId?: string;
  onUpdate: (store: AppStore) => void;
  onExit: () => void;
}

export function ConfigUI({ store, initialMode, initialEditId, onUpdate, onExit }: Props) {
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
  const [historyMode, setHistoryMode] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // testResults / testDurations 使用 useEffect 同步持久化（不在 setState 回调里做 side effect）
  const initialTR = Object.fromEntries(
    Object.entries(store.testResults || {}).filter(([_, v]) => v === 'ok' || v === 'fail')
  ) as Record<string, 'ok' | 'fail' | 'running'>;
  const [testResults, setTestResults] = useState(initialTR);
  const [testDurations, setTestDurations] = useState<Record<string, number>>(store.testDurations || {});

  // 使用 useEffect 将 testResults 和 testDurations 同步持久化到 store
  // mounted ref 跳过首次渲染，避免 mount 时无谓写盘
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

  const globalConfig = useMemo(() => readCurrentConfig(), [globalTick]);
  const profiles = store.profiles;
  const selected = profiles[selectedIdx] || null;

  // 移动 profile 顺序
  const moveProfile = (dir: -1 | 1) => {
    const newIdx = selectedIdx + dir;
    if (newIdx < 0 || newIdx >= profiles.length) return;
    const newProfiles = [...profiles];
    [newProfiles[selectedIdx], newProfiles[newIdx]] = [newProfiles[newIdx], newProfiles[selectedIdx]];
    onUpdate({ ...store, profiles: newProfiles });
    setSelectedIdx(newIdx);
  };

  useInput((input: string, key: any) => {
    if (historyMode || testMode || addMode || deleteMode || focusState === 'edit' || previewMode) return;

    if (focusState === 'right') {
      if (key.escape || key.leftArrow) { setFocusState('left'); return; }
      if (key.upArrow) { setRightIdx(v => Math.max(0, v - 1)); return; }
      if (key.downArrow) { setRightIdx(v => Math.min(OVERRIDE_FIELDS.length - 1, v + 1)); return; }
      if (key.tab || (key as any).shiftTab) {
        const isShiftTab = key.shift || (key as any).shiftTab;
        const currGroup = OVERRIDE_FIELDS[rightIdx].group;
        if (isShiftTab) {
          const currGroupFirstIdx = OVERRIDE_FIELDS.findIndex(f => f.group === currGroup);
          if (currGroupFirstIdx <= 0) {
            const lastGroup = OVERRIDE_FIELDS[OVERRIDE_FIELDS.length - 1].group;
            setRightIdx(OVERRIDE_FIELDS.findIndex(f => f.group === lastGroup));
          } else {
            const prevGroup = OVERRIDE_FIELDS[currGroupFirstIdx - 1].group;
            setRightIdx(OVERRIDE_FIELDS.findIndex(f => f.group === prevGroup));
          }
        } else {
          let nextIdx = OVERRIDE_FIELDS.findIndex((f, idx) => idx > rightIdx && f.group !== currGroup);
          if (nextIdx === -1) nextIdx = 0;
          setRightIdx(nextIdx);
        }
        return;
      }
      if (input === 'g') {
        const field = OVERRIDE_FIELDS[rightIdx];
        if (field.group === 'cfg_profile' || !selected) return;
        const val = (selected as any)[field.key] || '';
        const globalVal = getGlobalVal(globalConfig, field) || '';
        
        if (!val) {
          showToast(`[${field.label}] 暂无专属配置值，无法同步至全局`, 'error');
          return;
        }
        if (val === globalVal) {
          showToast(`[${field.label}] 专属值与当前全局值无差异，无需写入`, 'error');
          return;
        }

        pushHistory(store, `Save [${field.label}] to Global`);
        saveGlobalConfigField(field.key, val);
        setGlobalTick(t => t + 1);
        showToast(`已成功同步 [${field.label}] 持久化写入全局配置`, 'success');
        onUpdate({ ...store });
        return;
      }
      if (input === 'p') { setPreviewMode(true); return; }
      if (input === 'l') { setLang(v => v === 'zh' ? 'en' : 'zh'); return; }
      if (key.return || key.rightArrow) { setFocusState('edit'); return; }
      return;
    }

    // focusState === 'left'
    if (key.escape) { onExit(); return; }
    if (input === 'l') { setLang(v => v === 'zh' ? 'en' : 'zh'); return; }
    if (input === 'a') { setAddMode(true); return; }
    if (input === 'd' && selected) { setDeleteMode(true); return; }
    if (input === 'c' && selected) {
      // Clone profile
      const cloned = cloneProfile(selected);
      const newProfiles = [...profiles, cloned];
      onUpdate({ ...store, profiles: newProfiles });
      setSelectedIdx(newProfiles.length - 1);
      showToast(`已克隆 "${selected.name}" -> "${cloned.name}"`, 'success');
      return;
    }
    if (input === 'x') {
      // Export profiles
      const json = exportProfiles(profiles);
      const exportPath = join(homedir(), '.codex-start', 'profiles-export.json');
      writeFileSync(exportPath, json + '\n');
      showToast(`已导出 ${profiles.length} 个 profiles -> ${exportPath}`, 'success', 4000);
      return;
    }
    if (input === 'h') {
      if (!store.history || store.history.length === 0) {
        pushHistory(store, 'Initial Backup');
        onUpdate({ ...store });
      }
      setHistoryMode(true);
      return;
    }
    if (input === ' ' && selected) {
      onUpdate({ ...store, profiles: profiles.map((p) => ({ ...p, isDefault: p.id === selected.id })) });
      return;
    }
    if (input === 't') { setTestMode(true); return; }
    // Shift+方向键移动 profile 顺序 (用 J/K)
    if (input === 'J' && selected) { moveProfile(1); return; }
    if (input === 'K' && selected) { moveProfile(-1); return; }
    if (input === 'W') {
      const currentTheme = store.globalTheme || 'mocha';
      const idx = themeOptions.indexOf(currentTheme);
      const nextTheme = themeOptions[(idx + 1) % themeOptions.length];
      const updated = { ...store, globalTheme: nextTheme };
      applyTheme(nextTheme);
      onUpdate(updated);
      showToast(`Theme: ${nextTheme}`, 'success');
      return;
    }
    if ((key.return || key.rightArrow) && selected) { setFocusState('right'); return; }
  });

  const renderRightPanel = () => {
    if (historyMode) {
      return (
        <HistoryPanel
          store={store}
          onRestore={(idx) => {
            const item = (store.history || [])[idx];
            if (item) {
              pushHistory(store, `Revert to history ${item.message.slice(0, 20)}`);
              restoreBackup({ authJson: item.authJson, configToml: item.configToml });
              setGlobalTick(t => t + 1);
              setHistoryMode(false);
              onUpdate({ ...store });
            }
          }}
          onCancel={() => setHistoryMode(false)}
        />
      );
    }

    if (previewMode && selected) {
      return (
        <PreviewPanel profile={selected} globalConfig={globalConfig} onClose={() => setPreviewMode(false)} />
      );
    }

    if (focusState === 'edit' && selected) {
      const field = OVERRIDE_FIELDS[rightIdx];
      const currentVal = (selected as any)[field.key] || '';
      const globalVal = getGlobalVal(globalConfig, field);
      return (
        <Box flexDirection="column" padding={1}>
          <Text color={colors.accent} bold>{symbols.dot} Editing: {selected.name} - {field.label}</Text>
          <FieldEditor
            field={field} currentValue={currentVal} globalValue={globalVal} lang={lang}
            profile={selected}
            onSave={(val) => {
              const updated = profiles.map((p) => p.id === selected.id ? { ...p, [field.key]: val } : p);
              onUpdate({ ...store, profiles: updated });
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
               const p = createProfile({
                 name: addName, base_url: addUrl, api_key: addKey,
                 model: '', model_reasoning_effort: '', wire_api: '',
                 personality: '', model_reasoning_summary: '', service_tier: '',
                 disable_response_storage: '', approval_policy: '', sandbox_mode: '',
                 web_search: '', requires_openai_auth: true, isDefault: profiles.length === 0,
               } as any);
               onUpdate({ ...store, profiles: [...profiles, p] });
               setSelectedIdx(profiles.length);
               setAddMode(false);
          }}
          onCancel={() => setAddMode(false)}
        />
      );
    }

    if (deleteMode && selected) {
      return (
        <DeleteProfilePanel
          profile={selected}
          onConfirm={() => {
             const remaining = profiles.filter((_, i) => i !== selectedIdx);
             if (selected.isDefault && remaining.length > 0) remaining[0].isDefault = true;
             onUpdate({ ...store, profiles: remaining });
             setSelectedIdx(Math.max(0, Math.min(selectedIdx, remaining.length - 1)));
             setDeleteMode(false);
          }}
          onCancel={() => setDeleteMode(false)}
        />
      );
    }

    return selected ? (
      <OverridesPanel profile={selected} activeFieldIdx={rightIdx} focusState={focusState} globalConfig={globalConfig} lang={lang} navWidth={computeNavWidth(profiles.map(p => p.name), 9)} />
    ) : null;
  };

  // TestUI takes over the entire screen
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

  if (profiles.length === 0 && !addMode && !historyMode) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={colors.accent} bold>{symbols.dot} Codex Start</Text>
        <Box marginTop={1}>
          <Text color={colors.dim}>[l] Toggle Lang  </Text><Text color={colors.muted}>No profiles. Press </Text>
          <Text color={colors.primary} bold>a</Text>
          <Text color={colors.muted}> to add.</Text>
        </Box>
      </Box>
    );
  }

  const listItems = profiles.map((p) => ({ label: p.id, value: p.id }));

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text color={colors.accent} bold>{symbols.dot} Codex Start</Text>
      </Box>

      <Box borderStyle="round" borderColor={colors.dim} flexDirection="row" width="100%">
        <Box flexDirection="column" width={computeNavWidth(profiles.map(p => p.name), 9)} borderStyle="single" borderTop={false} borderBottom={false} borderLeft={false} borderColor={colors.dim} padding={1} paddingRight={2}>
          <Text color={colors.muted} bold> Profiles</Text>
          <Box marginTop={1} flexDirection="column">
            {focusState === 'left' && profiles.length > 0 && !addMode && !deleteMode && !historyMode && !testMode && !previewMode ? (
              <SelectInput
                items={listItems}
                onSelect={() => { setFocusState('right'); setRightIdx(0); }}
                onHighlight={(item: any) => {
                  const idx = profiles.findIndex((p) => p.id === item.value);
                  if (idx >= 0) { queueMicrotask(() => setSelectedIdx(idx)); }
                }}
                indicatorComponent={({ isSelected }: any) => (
                  <Text color={isSelected ? colors.primary : colors.dim}>{isSelected ? `${symbols.arrow} ` : '  '}</Text>
                )}
                itemComponent={({ isSelected, label }: any) => {
                  const p = profiles.find((pr) => pr.id === label);
                  if (!p) return <Text>{label}</Text>;
                  const res = testResults[p.id];
                  return (
                    <Box>
                      <Text>
                        <Text color={p.isDefault ? colors.warning : colors.dim}>{p.isDefault ? `${symbols.star} ` : '   '}</Text>
                        <Text>
                          {res === 'ok' ? <Text color={colors.success}>{`${symbols.check} `}</Text> :
                           res === 'fail' ? <Text color={colors.danger}>{`${symbols.cross} `}</Text> :
                           res === 'running' ? <Text color={colors.warning}>{`${symbols.circle} `}</Text> :
                           <Text>{'  '}</Text>}
                        </Text>
                        <Text color={isSelected ? colors.text : colors.muted}>{p.name}</Text>
                      </Text>
                    </Box>
                  );
                }}
              />
            ) : focusState === 'left' && profiles.length === 0 ? (
              <Box flexDirection="column"><Text color={colors.dim}>[No profiles]</Text></Box>
            ) : (
              <Box flexDirection="column">
                {profiles.map((p, i) => {
                  const isSelected = i === selectedIdx && !addMode && !deleteMode;
                  const res = testResults[p.id];
                  return (
                    <Box key={p.id}>
                      <Text>
                        <Text color={isSelected ? colors.primary : colors.dim}>{isSelected ? `${symbols.arrow} ` : '  '}</Text>
                        <Text color={p.isDefault ? colors.warning : colors.dim}>{p.isDefault ? `${symbols.star} ` : '   '}</Text>
                        <Text>
                          {res === 'ok' ? <Text color={colors.success}>{`${symbols.check} `}</Text> :
                           res === 'fail' ? <Text color={colors.danger}>{`${symbols.cross} `}</Text> :
                           res === 'running' ? <Text color={colors.warning}>{`${symbols.circle} `}</Text> :
                           <Text>{'  '}</Text>}
                        </Text>
                        <Text color={colors.muted}>{p.name}</Text>
                      </Text>
                    </Box>
                  )
                })}
                {addMode && (
                  <Box marginTop={1}>
                    <Text>
                      <Text color={colors.primary}>{`${symbols.arrow} `}</Text>
                      <Text color={colors.dim}>{'  '}</Text>
                      <Text color={colors.primary} italic>*(New)*</Text>
                    </Text>
                  </Box>
                )}
              </Box>
            )}
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

      {(() => {
        const isSubMode = addMode || deleteMode || historyMode || testMode || previewMode;
        if (isSubMode) return null;

        return focusState === 'left' ? (
          <Box gap={2} flexWrap="wrap">
            <Text color={colors.dim}>{'[Enter/\u2192] Edit'}</Text>
            <Text color={colors.dim}>[a] Add</Text>
            <Text color={colors.dim}>[c] Clone</Text>
            <Text color={colors.dim}>[d] Delete</Text>
            <Text color={colors.dim}>[t] Test</Text>
            <Text color={colors.dim}>[x] Export</Text>
            <Text color={colors.dim}>[h] History</Text>
            <Text color={colors.dim}>[J/K] Reorder</Text>
            <Text color={colors.dim}>[Space] Default</Text>
            <Text color={colors.dim}>[W] Theme</Text>
            <Text color={colors.dim}>[l] Lang</Text>
            <Text color={colors.dim}>[Esc] Exit</Text>
          </Box>
        ) : (
          <Box gap={2} flexWrap="wrap">
            <Text color={colors.dim}>{'[Enter/\u2192] Edit'}</Text>
            <Text color={colors.dim}>[g] Save to Global</Text>
            <Text color={colors.dim}>[p] Preview</Text>
            <Text color={colors.dim}>[Up/Down] Navigate</Text>
            <Text color={colors.dim}>[Tab] Jump Category</Text>
            <Text color={colors.dim}>[l] Language</Text>
            <Text color={colors.dim}>{'[Esc/\u2190] Back'}</Text>
          </Box>
        );
      })()}
    </Box>
  );

}
