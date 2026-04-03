import React, { useState, useMemo } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import { spawn } from 'node:child_process';
import { ConfigUI } from './components/ConfigUI.js';
import { loadStore, saveStore, ensureBackup, createProfile, readCurrentConfig, cloneProfile, exportProfiles, importProfiles } from './store.js';
import { injectProfile, buildLaunchArgs, restoreBackup } from './injector.js';
import { colors, symbols } from './theme.js';
import { maskApiKey, fuzzyMatch } from './utils.js';
import type { Profile, AppStore } from './types.js';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// --- 启动信息打印 ---

function launchCodex(profile: Profile) {
  const store = ensureBackup(loadStore());
  restoreBackup(store.backup);
  injectProfile(profile);
  const args = buildLaunchArgs(profile);
  
  const child = spawn('codex', args, { stdio: 'inherit' });
  child.on('error', (err) => {
    console.error(`\n  \x1b[31mFailed:\x1b[0m ${err.message}`);
    process.exit(1);
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

// --- CLI 命令路由（非 TUI，直接 console 输出） ---

function handleCli(): boolean {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    const store = ensureBackup(loadStore());
    const def = store.profiles.find((p) => p.isDefault) || store.profiles[0];
    if (!def) {
      console.log('\n  No profiles yet. Run \x1b[36mcs config\x1b[0m to add one.\n');
      process.exit(0);
    }
    launchCodex(def);
    return true;
  }

  const cmd = args[0];

  if (cmd === 'config' || cmd === 'c') return false;
  if (cmd === 'list' || cmd === 'ls') return false;
  if (cmd === 'add') return false;
  if (cmd === 'test') return false;

  // cs run <name>
  if (cmd === 'run') {
    const query = args.slice(1).join(' ');
    if (!query) {
      console.log('\n  \x1b[31mUsage:\x1b[0m cs run <profile-name>\n');
      process.exit(1);
    }
    const store = ensureBackup(loadStore());
    const matches = fuzzyMatch(store.profiles, query);
    if (matches.length === 0) {
      console.log(`\n  \x1b[31mNo profile matching:\x1b[0m "${query}"\n`);
      process.exit(1);
    }
    if (matches.length > 1) {
      console.log(`\n  \x1b[33mMultiple matches for:\x1b[0m "${query}"`);
      matches.forEach(i => console.log(`    ${i + 1}. ${store.profiles[i].name}`));
      console.log('  Please be more specific.\n');
      process.exit(1);
    }
    launchCodex(store.profiles[matches[0]]);
    return true;
  }

  // cs export
  if (cmd === 'export') {
    const store = loadStore();
    if (store.profiles.length === 0) {
      console.log('\n  No profiles to export.\n');
      process.exit(0);
    }
    const json = exportProfiles(store.profiles);
    const outFile = args[1] || join(homedir(), '.codex-start', 'profiles-export.json');
    writeFileSync(outFile, json + '\n');
    console.log(`\n  \x1b[32mExported ${store.profiles.length} profiles\x1b[0m -> ${outFile}\n`);
    return true;
  }

  // cs import <file>
  if (cmd === 'import') {
    const file = args[1];
    if (!file || !existsSync(file)) {
      console.log('\n  \x1b[31mUsage:\x1b[0m cs import <json-file>\n');
      process.exit(1);
    }
    try {
      const json = readFileSync(file, 'utf-8');
      const imported = importProfiles(json);
      const store = loadStore();
      store.profiles.push(...imported);
      saveStore(store);
      console.log(`\n  \x1b[32mImported ${imported.length} profiles\x1b[0m from ${file}\n`);
    } catch (e: any) {
      console.log(`\n  \x1b[31mImport failed:\x1b[0m ${e.message}\n`);
      process.exit(1);
    }
    return true;
  }

  // cs N
  const num = parseInt(cmd, 10);
  if (!isNaN(num)) {
    const store = ensureBackup(loadStore());
    if (num < 1 || num > store.profiles.length) {
      console.log(`\n  \x1b[31mInvalid profile number ${num}\x1b[0m (have ${store.profiles.length} profiles)\n`);
      process.exit(1);
    }
    launchCodex(store.profiles[num - 1]);
    return true;
  }

  console.log(`\n  \x1b[31mUnknown command:\x1b[0m ${cmd}`);
  console.log('  Usage:');
  console.log('    \x1b[36mcs\x1b[0m              Launch default profile');
  console.log('    \x1b[36mcs list\x1b[0m          Interactive profile list');
  console.log('    \x1b[36mcs <N>\x1b[0m           Launch profile by number');
  console.log('    \x1b[36mcs run <name>\x1b[0m    Launch profile by name');
  console.log('    \x1b[36mcs config\x1b[0m        Open config manager');
  console.log('    \x1b[36mcs add\x1b[0m           Add new profile');
  console.log('    \x1b[36mcs test\x1b[0m          Test connectivity');
  console.log('    \x1b[36mcs export [file]\x1b[0m Export profiles');
  console.log('    \x1b[36mcs import <file>\x1b[0m Import profiles\n');
  return true;
}

// --- cs list 交互式列表 TUI ---

function ListApp() {
  const { exit } = useApp();
  const [store, setStore] = useState<AppStore>(() => ensureBackup(loadStore()));
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

  useInput((input, key) => {
    // 搜索模式下只允许 Esc 和 Enter，其他交给 TextInput
    if (searchMode) {
      if (key.escape) { setSearchMode(false); setSearchQuery(''); return; }
      if (key.return && filteredProfiles.length > 0) {
        // Enter 确认搜索：退出搜索模式，保留第一个匹配项为高亮
        setHighlightedId(filteredProfiles[0].id);
        setSearchMode(false);
        return;
      }
      return;
    }
    if (key.escape) exit();
    if (input === 'a' || input === 'A') {
      pendingAddProfile = true;
      exit();
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
        setStore(updated);
        saveStore(updated);
        showToast(`"${p.name}" 已设为默认`);
      }
    }
    if ((input === 'e' || input === 'E') && highlightedId) {
      pendingEditProfileId = highlightedId;
      exit();
    }
    if ((input === 't' || input === 'T')) {
      pendingTestMode = true;
      exit();
    }
    if ((input === 'c' || input === 'C') && highlightedId) {
      const source = store.profiles.find(p => p.id === highlightedId);
      if (source) {
        const cloned = cloneProfile(source);
        const updated = { ...store, profiles: [...store.profiles, cloned] };
        setStore(updated);
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
        setStore(updated);
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
        setStore(updated);
        saveStore(updated);
        showToast(`"${store.profiles[idx].name}" 已上移`);
      }
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

  // 搜索模式：显示纯文本列表（无 SelectInput 避免焦点冲突）
  // 正常模式：使用 SelectInput 交互
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
              // 搜索模式：纯静态列表，避免 SelectInput 和 TextInput 的焦点冲突
              filteredProfiles.length === 0 ? (
                <Text color={colors.dim} italic>No matches</Text>
              ) : (
                filteredProfiles.map((p, i) => (
                  <Box key={p.id} gap={1}>
                    <Text color={i === 0 ? colors.primary : colors.dim}>{i === 0 ? symbols.arrow : ' '}</Text>
                    <Text color={p.isDefault ? colors.warning : colors.dim}>{p.isDefault ? symbols.star : ' '}</Text>
                    <Text color={i === 0 ? colors.text : colors.muted} wrap="truncate-end">{p.name}</Text>
                  </Box>
                ))
              )
            ) : (
              <SelectInput
                items={items}
                onSelect={(item: any) => {
                  const p = store.profiles.find((pr) => pr.id === item.value);
                  if (p) { pendingLaunchProfile = p; exit(); }
                }}
                onHighlight={(item: any) => setHighlightedId(item.value)}
                indicatorComponent={({ isSelected }: any) => (
                  <Text color={isSelected ? colors.primary : colors.dim}>{isSelected ? symbols.arrow : ' '} </Text>
                )}
                itemComponent={({ isSelected, label }: any) => {
                  const p = store.profiles.find((pr) => pr.id === label);
                  if (!p) return <Text wrap="truncate-end">{label}</Text>;
                  return (
                    <Box gap={1}>
                      <Text color={p.isDefault ? colors.warning : colors.dim}>{p.isDefault ? symbols.star : ' '}</Text>
                      <Text color={isSelected ? colors.text : colors.muted} bold={isSelected} wrap="truncate-end">{p.name}</Text>
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
                   <Text color={colors.muted}>{maskApiKey(activeProfile.api_key)}</Text>
                 </Box>
              </Box>

              <Box flexDirection="row" marginBottom={1}>
                 <Box flexDirection="column" width="50%" marginRight={1}>
                   <Text color={colors.dim}>Engine (Model)</Text>
                   <Text color={colors.secondary}>{activeProfile.model || globalConfig.model || '(not set)'}</Text>
                 </Box>
                 <Box flexDirection="column" width="50%" marginRight={1}>
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
        <Text color={colors.dim}>[J/K] Reorder  [Space] Default  [Esc] Exit</Text>
      </Box>
    </Box>
  );
}

// --- cs config TUI ---

let pendingLaunchProfile: Profile | null = null;
let pendingEditProfileId: string | null = null;
let pendingAddProfile: boolean = false;
let pendingTestMode: boolean = false;

function ConfigApp({ cmd, editId }: { cmd: string; editId?: string }) {
  const { exit } = useApp();
  const [store, setStore] = useState<AppStore>(() => ensureBackup(loadStore()));

  return (
    <ConfigUI
      store={store}
      initialMode={cmd}
      initialEditId={editId}
      onUpdate={(newStore) => { setStore(newStore); saveStore(newStore); }}
      onExit={() => exit()}
    />
  );
}

// --- Entry Point ---

async function main() {
  if (handleCli()) return;

  const cmd = process.argv[2] || 'config';

  if (cmd === 'list' || cmd === 'ls') {
    while (true) {
      pendingLaunchProfile = null;
      pendingEditProfileId = null;
      pendingAddProfile = false;
      pendingTestMode = false;

      const { waitUntilExit } = render(<ListApp />);
      await waitUntilExit();

      if (pendingLaunchProfile) {
        launchCodex(pendingLaunchProfile);
        return;
      }
      if (pendingEditProfileId) {
        const { waitUntilExit: wExit } = render(<ConfigApp cmd="config" editId={pendingEditProfileId} />);
        await wExit();
        continue;
      }
      if (pendingAddProfile) {
        const { waitUntilExit: wExit } = render(<ConfigApp cmd="add" />);
        await wExit();
        continue;
      }
      if (pendingTestMode) {
        const { waitUntilExit: wExit } = render(<ConfigApp cmd="test" />);
        await wExit();
        continue;
      }
      return;
    }
  }

  const { waitUntilExit } = render(<ConfigApp cmd={cmd} />);
  await waitUntilExit();
}

main();
