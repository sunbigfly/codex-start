import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import { colors, symbols, applyTheme, themeOptions } from '../theme.js';
import type { Profile, AppStore } from '../types.js';
import { readCurrentConfig, saveStore, cloneProfile, exportProfiles } from '../store.js';
import { fuzzyMatch } from '../utils.js';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

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
    if (input === 'a' || input === 'A') {
      onAction({ type: 'add' });
    }
    if (input === '/') {
      setSearchMode(true);
      setSearchQuery('');
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
    if ((input === 'e' || input === 'E') && highlightedId) {
      onAction({ type: 'edit', profileId: highlightedId });
    }
    if ((input === 't' || input === 'T')) {
      onAction({ type: 'test' });
    }
    if ((input === 'c' || input === 'C') && highlightedId) {
      const source = store.profiles.find(p => p.id === highlightedId);
      if (source) {
        const cloned = cloneProfile(source);
        const updated = { ...store, profiles: [...store.profiles, cloned] };
        onUpdate(updated);
        saveStore(updated);
        showToast(`已克隆 "${source.name}" -> "${cloned.name}"`);
      }
    }
    if (input === 'x' || input === 'X') {
      const json = exportProfiles(store.profiles);
      const exportPath = join(homedir(), '.codex-start', 'profiles-export.json');
      writeFileSync(exportPath, json + '\n');
      showToast(`已导出 ${store.profiles.length} 个 profiles -> ${exportPath}`);
    }
    // J/K 排序
    if (input === 'J' && highlightedId) {
      const idx = store.profiles.findIndex(p => p.id === highlightedId);
      if (idx >= 0 && idx < store.profiles.length - 1) {
        const newProfiles = [...store.profiles];
        [newProfiles[idx], newProfiles[idx + 1]] = [newProfiles[idx + 1], newProfiles[idx]];
        const updated = { ...store, profiles: newProfiles };
        onUpdate(updated);
        saveStore(updated);
        showToast(`"${store.profiles[idx].name}" 已下移`);
      }
    }
    if (input === 'K' && highlightedId) {
      const idx = store.profiles.findIndex(p => p.id === highlightedId);
      if (idx > 0) {
        const newProfiles = [...store.profiles];
        [newProfiles[idx], newProfiles[idx - 1]] = [newProfiles[idx - 1], newProfiles[idx]];
        const updated = { ...store, profiles: newProfiles };
        onUpdate(updated);
        saveStore(updated);
        showToast(`"${store.profiles[idx].name}" 已上移`);
      }
    }
    if (input === 'W') {
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

  if (store.profiles.length === 0) {
    return (
      <Box padding={1} flexDirection="column" gap={1}>
        <Box>
          <Text color={colors.muted}>No profiles. Run </Text>
          <Text color={colors.primary}>cs config</Text>
          <Text color={colors.muted}> to add.</Text>
        </Box>
        <Box gap={2} flexWrap="wrap">
          <Text color={colors.dim}>[a] Add profile  [Esc] Exit</Text>
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
      <Box marginBottom={1}>
        <Text color={colors.accent} bold>{symbols.dot} Codex Profiles</Text>
      </Box>

      <Box borderStyle="round" borderColor={colors.dim} flexDirection="row" width="100%">
        {/* Left: profile list */}
        <Box flexDirection="column" width={24} borderStyle="single" borderTop={false} borderBottom={false} borderLeft={false} borderColor={colors.dim} padding={1} paddingRight={2}>
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
                      <Text color={p.isDefault ? colors.warning : colors.dim}>{p.isDefault ? `${symbols.star} ` : '  '}</Text>
                      <Text color={i === 0 ? colors.text : colors.muted}>{p.name}</Text>
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
                  if (!p) return <Text wrap="truncate-end">{label}</Text>;
                  return (
                    <Box>
                      <Text wrap="truncate-end">
                        <Text color={p.isDefault ? colors.warning : colors.dim}>{p.isDefault ? `${symbols.star} ` : '  '}</Text>
                        <Text color={isSelected ? colors.text : colors.muted} bold={isSelected}>{p.name}</Text>
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
        <Text color={colors.dim}>[Enter] Launch</Text>
        <Text color={colors.dim}>[e] Edit  [a] Add  [c] Clone</Text>
        <Text color={colors.dim}>[t] Test  [x] Export  [/] Search</Text>
        <Text color={colors.dim}>[J/K] Reorder  [Space] Default  [W] Theme  [Esc] Exit</Text>
      </Box>
    </Box>
  );
}
