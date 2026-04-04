import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import { colors, symbols, applyTheme, themeOptions } from '../theme.js';
import type { Profile, AppStore } from '../types.js';
import { readCurrentConfig, saveStore } from '../store.js';
import { fuzzyMatch, computeNavWidth } from '../utils.js';
import { RainbowText } from './RainbowText.js';
import { HelpUI } from './config/panels/HelpUI.js';

import { HeaderLogo } from './HeaderLogo.js';

export type ListAction = 
  | { type: 'launch'; profileId: string }
  | { type: 'edit'; profileId: string }
  | { type: 'add' }
  | { type: 'test' }
  | { type: 'exit' };

interface Props {
  store: AppStore;
  onUpdate: (store: AppStore) => void;
  onAction: (action: ListAction) => void;
}

export function ListUI({ store, onUpdate, onAction }: Props) {
  const [highlightedId, setHighlightedId] = useState(store.profiles[0]?.id);
  const [globalConfig] = useState(() => readCurrentConfig());
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [helpMode, setHelpMode] = useState(false);

  // 搜索过滤
  const filteredProfiles = useMemo(() => {
    if (!searchMode || !searchQuery) return store.profiles;
    return fuzzyMatch(store.profiles, searchQuery).map(i => store.profiles[i]);
  }, [store.profiles, searchMode, searchQuery]);

  // Toast 自动消失
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  useInput((input: string, key: any) => {
    if (helpMode) return; // 让 HelpUI 自己接管它的关闭

    if (searchMode) {
      if (key.escape) { setSearchMode(false); setSearchQuery(''); return; }
      if (key.return && filteredProfiles.length > 0) {
        setHighlightedId(filteredProfiles[0].id);
        setSearchMode(false);
        return;
      }
      return;
    }
    if (key.escape) onAction({ type: 'exit' });
    const lcInput = input.toLowerCase();

    if (lcInput === 'a') {
      onAction({ type: 'add' });
    }
    if (input === '/') {
      setSearchMode(true);
      setSearchQuery('');
      return;
    }
    if (input === '?' || input === '？') {
      setHelpMode(true);
      return;
    }
    if (input === ' ' && highlightedId) {
      const p = store.profiles.find((pr) => pr.id === highlightedId);
      if (p) {
        const updated = {
          ...store,
          profiles: store.profiles.map((pr) => ({ ...pr, isDefault: pr.id === p.id })),
        };
        onUpdate(updated);
        saveStore(updated);
        showToast(`"${p.name}" 已设为默认`);
      }
    }
    if (lcInput === 'e' && highlightedId) {
      onAction({ type: 'edit', profileId: highlightedId });
    }
    if (lcInput === 't') {
      onAction({ type: 'test' });
    }
    if (lcInput === 'w') {
      const currentTheme = store.globalTheme || 'mocha';
      const idx = themeOptions.indexOf(currentTheme);
      const nextTheme = themeOptions[(idx + 1) % themeOptions.length];
      const updated = { ...store, globalTheme: nextTheme };
      applyTheme(nextTheme);
      onUpdate(updated);
      saveStore(updated);
      showToast(`Theme: ${nextTheme}`);
      return;
    }
  });

  if (helpMode) {
    return <HelpUI onClose={() => setHelpMode(false)} themeName={store.globalTheme || 'mocha'} uiMode="list" />;
  }

  if (store.profiles.length === 0) {
    return (
      <Box padding={1} flexDirection="column" gap={1}>
        <HeaderLogo themeName={store.globalTheme || 'mocha'} />
        <Box>
          <Text color={colors.muted}>No profiles. Run </Text>
          <Text color={colors.primary}>cs config</Text>
          <Text color={colors.muted}> to add.</Text>
        </Box>
        <Box gap={2} flexWrap="wrap">
          <Text color={colors.dim}>[a] Add profile  [h/?] Help  [Esc] Exit</Text>
        </Box>
      </Box>
    );
  }

  const activeProfile = store.profiles.find((p) => p.id === highlightedId) || store.profiles[0];

  const overrides = activeProfile ? [
    { label: 'Summary', val: activeProfile.model_reasoning_summary, color: colors.warning },
    { label: 'Policy', val: activeProfile.approval_policy, color: colors.text },
    { label: 'Sandbox', val: activeProfile.sandbox_mode, color: colors.muted },
    { label: 'Web Search', val: activeProfile.web_search, color: colors.muted },
    { label: 'Persona', val: activeProfile.personality, color: colors.muted },
    { label: 'API Ch', val: activeProfile.wire_api, color: colors.muted },
    { label: 'Tier', val: activeProfile.service_tier, color: colors.muted },
  ].filter(o => !!o.val) : [];

  const chunkedOverrides = [];
  for (let i = 0; i < overrides.length; i += 3) {
    chunkedOverrides.push(overrides.slice(i, i + 3));
  }

  const items = filteredProfiles.map((p) => ({ label: p.id, value: p.id }));

  return (
    <Box flexDirection="column" padding={1}>
      <HeaderLogo themeName={store.globalTheme || 'mocha'} />
      <Box marginBottom={1} marginTop={1}>
        <Text color={colors.accent} bold>{symbols.dot} Codex-Start Profiles</Text>
      </Box>

      <Box borderStyle="round" borderColor={colors.dim} flexDirection="row" width="100%">
        {/* Left: profile list */}
        <Box flexDirection="column" width={computeNavWidth(store.profiles.map(p => p.name), 12, 14)} borderStyle="single" borderTop={false} borderBottom={false} borderLeft={false} borderColor={colors.dim} padding={1} paddingRight={2}>
          <Text color={colors.muted} bold> Profiles</Text>

          {searchMode && (
            <Box marginTop={1} gap={1}>
              <Text color={colors.primary}>/</Text>
              <TextInput value={searchQuery} onChange={setSearchQuery} placeholder="filter..." />
            </Box>
          )}

          <Box marginTop={1} flexDirection="column">
            {searchMode ? (
              filteredProfiles.length === 0 ? (
                <Text color={colors.dim} italic>No matches</Text>
              ) : (
                filteredProfiles.map((p, i) => (
                  <Box key={p.id}>
                    <Text wrap="truncate-end">
                      <Text color={i === 0 ? colors.primary : colors.dim}>{i === 0 ? `${symbols.arrow} ` : '  '}</Text>
                      <Text color={p.isDefault ? colors.warning : colors.dim}>{p.isDefault ? `${symbols.star} ` : '   '}</Text>
                      {i === 0 ? (
                        <RainbowText text={p.name} bold />
                      ) : (
                        <Text color={colors.muted}>{p.name}</Text>
                      )}
                      <Text>
                        {store.testResults && store.testResults[p.id] === 'ok' ? <Text color={colors.success}>{` ${symbols.check}`}</Text> :
                         store.testResults && store.testResults[p.id] === 'fail' ? <Text color={colors.danger}>{` ${symbols.cross}`}</Text> :
                         <Text>{''}</Text>}
                      </Text>
                      {store.testResults && (store.testResults[p.id] === 'ok' || store.testResults[p.id] === 'fail') && <Text color={colors.dim}> {store.testDurations && store.testDurations[p.id] ? `${(store.testDurations[p.id]/1000).toFixed(1)}s` : ''}</Text>}
                    </Text>
                  </Box>
                ))
              )
            ) : (
              <SelectInput
                items={items}
                onSelect={(item: any) => {
                  onAction({ type: 'launch', profileId: item.value });
                }}
                onHighlight={(item: any) => setHighlightedId(item.value)}
                indicatorComponent={({ isSelected }: any) => (
                  <Text color={isSelected ? colors.primary : colors.dim}>{isSelected ? symbols.arrow : ' '} </Text>
                )}
                itemComponent={({ isSelected, label }: any) => {
                  const p = store.profiles.find((pr) => pr.id === label);
                  if (!p) return <Text>{label}</Text>;
                  return (
                    <Box>
                      <Text wrap="truncate-end">
                        <Text color={p.isDefault ? colors.warning : colors.dim}>{p.isDefault ? `${symbols.star} ` : '   '}</Text>
                        {isSelected ? (
                          <RainbowText text={p.name} bold />
                        ) : (
                          <Text color={colors.muted}>{p.name}</Text>
                        )}
                        <Text>
                          {store.testResults && store.testResults[p.id] === 'ok' ? <Text color={colors.success}>{` ${symbols.check}`}</Text> :
                           store.testResults && store.testResults[p.id] === 'fail' ? <Text color={colors.danger}>{` ${symbols.cross}`}</Text> :
                           <Text>{''}</Text>}
                        </Text>
                        {store.testResults && (store.testResults[p.id] === 'ok' || store.testResults[p.id] === 'fail') && <Text color={colors.dim}> {store.testDurations && store.testDurations[p.id] ? `${(store.testDurations[p.id]/1000).toFixed(1)}s` : ''}</Text>}
                      </Text>
                    </Box>
                  );
                }}
              />
            )}
          </Box>
        </Box>

        {/* Right: detail */}
        <Box flexDirection="column" flexGrow={1} padding={1} paddingLeft={2}>
          {activeProfile ? (
            <Box flexDirection="column" width="100%">
              <Box gap={1} marginBottom={1}>
                <Text color={colors.primary} bold>{activeProfile.name}</Text>
                {activeProfile.isDefault && <Text color={colors.warning}>[Default]</Text>}
              </Box>

              <Box flexDirection="column" marginBottom={1} gap={1}>
                 <Box flexDirection="row" width="100%">
                   <Text color={colors.dim} bold>{'Base URL: '.padEnd(12)}</Text>
                   <Text color={colors.muted}>{activeProfile.base_url || '(empty)'}</Text>
                 </Box>
                 <Box flexDirection="row" width="100%">
                   <Text color={colors.dim} bold>{'API Key: '.padEnd(12)}</Text>
                   <Text color={colors.muted}>{activeProfile.api_key || '(empty)'}</Text>
                 </Box>
              </Box>

              <Box flexDirection="row" marginBottom={1} gap={4}>
                 <Box flexDirection="column">
                   <Text color={colors.dim}>Engine (Model)</Text>
                   <Text color={colors.secondary}>{activeProfile.model || globalConfig.model || '(not set)'}</Text>
                 </Box>
                 <Box flexDirection="column">
                   <Text color={colors.dim}>Reasoning Effort</Text>
                   <Text color={colors.warning}>{activeProfile.model_reasoning_effort || globalConfig.model_reasoning_effort || '(not set)'}</Text>
                 </Box>
              </Box>

              <Box marginBottom={1}>
                 <Text color={colors.dim}>{symbols.dash.repeat(26)}</Text>
              </Box>

              {chunkedOverrides.length === 0 ? (
                 <Box marginBottom={1}>
                   <Text color={colors.dim} italic>No other local overrides</Text>
                 </Box>
              ) : (
                <Box flexDirection="column" marginBottom={1}>
                  {chunkedOverrides.map((row, i) => (
                    <Box key={i} flexDirection="row" marginBottom={1}>
                      {row.map((ov) => (
                        <Box key={ov.label} flexDirection="column" width="30%" marginRight={1}>
                          <Text color={colors.dim}>{ov.label}</Text>
                          <Text color={ov.color}>{ov.val}</Text>
                        </Box>
                      ))}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          ) : (
            <Box><Text color={colors.dim}>No profile selected</Text></Box>
          )}
        </Box>
      </Box>

      {/* Toast 反馈区 */}
      <Box height={1} marginTop={1}>
        {toastMsg ? (
          <Text color={colors.success} bold>[v] {toastMsg}</Text>
        ) : searchMode ? (
          <Text color={colors.primary} italic>Search mode: type to filter, [Enter] confirm, [Esc] cancel</Text>
        ) : (
          <Text> </Text>
        )}
      </Box>

      <Box gap={2} flexWrap="wrap">
        <Text color={colors.dim}>[Enter] Launch  [/] Search</Text>
        <Text color={colors.dim}>[a] Add  [e] Edit  [t] Test</Text>
        <Text color={colors.dim}>[Space] Default  [w] Theme</Text>
        <Text>
          <Text color={colors.accent} bold>[?] Help</Text>
          <Text color={colors.dim}>  [Esc] Exit</Text>
        </Text>
      </Box>
    </Box>
  );
}
