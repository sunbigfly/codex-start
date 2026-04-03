import React, { useState } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { spawn } from 'node:child_process';
import { ConfigUI } from './components/ConfigUI.js';
import { loadStore, saveStore, ensureBackup, createProfile, readCurrentConfig } from './store.js';
import { injectProfile, buildLaunchArgs, restoreBackup } from './injector.js';
import { colors, symbols } from './theme.js';
import type { Profile, AppStore } from './types.js';

// ─── 启动信息打印 ───────────────────────────────

function printLaunchInfo(profile: Profile) {
  const args = buildLaunchArgs(profile);
  const w = 44;
  console.log('');
  console.log(`  ${symbols.corner_tl}${symbols.line.repeat(w)}${symbols.corner_tr}`);
  console.log(`  ${symbols.pipe} \x1b[1;35mCodex Start\x1b[0m`);
  console.log(`  ${symbols.pipe}${symbols.dash.repeat(w)}${symbols.pipe}`);
  console.log(`  ${symbols.pipe}  Profile:   \x1b[36m${profile.name}\x1b[0m`);
  console.log(`  ${symbols.pipe}  URL:       \x1b[90m${profile.base_url}\x1b[0m`);
  if (profile.model) console.log(`  ${symbols.pipe}  Model:     \x1b[36m${profile.model}\x1b[0m`);
  if (profile.approval_policy) console.log(`  ${symbols.pipe}  Approval:  \x1b[33m${profile.approval_policy}\x1b[0m`);
  if (profile.sandbox_mode) console.log(`  ${symbols.pipe}  Sandbox:   \x1b[33m${profile.sandbox_mode}\x1b[0m`);
  if (profile.personality) console.log(`  ${symbols.pipe}  Persona:   \x1b[32m${profile.personality}\x1b[0m`);
  if (profile.web_search && profile.web_search !== 'disabled') {
    console.log(`  ${symbols.pipe}  Search:    \x1b[33m${profile.web_search}\x1b[0m`);
  }
  if (args.length > 0) console.log(`  ${symbols.pipe}  Args:      \x1b[90mcodex ${args.join(' ')}\x1b[0m`);
  console.log(`  ${symbols.corner_bl}${symbols.line.repeat(w)}${symbols.corner_br}`);
  console.log(`\n  \x1b[35m${symbols.arrow}\x1b[0m Launching codex...\n`);
}

function launchCodex(profile: Profile) {
  const store = ensureBackup(loadStore());
  
  // 关键：在注入之前先还原 config.toml，避免之前的 profile 污染全局配置
  restoreBackup(store.backup);
  
  injectProfile(profile);
  const args = buildLaunchArgs(profile);
  printLaunchInfo(profile);
  const child = spawn('codex', args, { stdio: 'inherit' });
  child.on('error', (err) => {
    console.error(`\n  \x1b[31mFailed:\x1b[0m ${err.message}`);
    process.exit(1);
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

// ─── CLI 命令路由（非 TUI，直接 console 输出） ──

function handleCli(): boolean {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    // cs → 启动默认 profile
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

  // cs config → 打开配置 TUI
  if (cmd === 'config' || cmd === 'c') return false; // 交给 TUI 处理

  // cs list / cs ls → 交互式列表
  if (cmd === 'list' || cmd === 'ls') return false; // 交给 TUI 处理

  // cs add → 交给 TUI
  if (cmd === 'add') return false;

  // cs test → 交给 TUI
  if (cmd === 'test') return false;

  // cs N → 序号快速启动
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
  console.log('    \x1b[36mcs config\x1b[0m        Open config manager');
  console.log('    \x1b[36mcs add\x1b[0m           Add new profile');
  console.log('    \x1b[36mcs test\x1b[0m          Test connectivity\n');
  return true;
}

// ─── cs list 交互式列表 TUI ──────────────────────

function ListApp() {
  const { exit } = useApp();
  const [store, setStore] = useState<AppStore>(() => ensureBackup(loadStore()));
  const [highlightedId, setHighlightedId] = useState(store.profiles[0]?.id);
  const [globalConfig] = useState(() => readCurrentConfig());

  useInput((input, key) => {
    if (key.escape) exit();
    if (input === 'a' || input === 'A') {
      pendingAddProfile = true;
      exit();
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
      }
    }
    if ((input === 'e' || input === 'E') && highlightedId) {
      pendingEditProfileId = highlightedId;
      exit();
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
        <Box gap={2}>
          <Text color={colors.dim}>[a] Add profile</Text>
          <Text color={colors.dim}>[Esc] Exit</Text>
        </Box>
      </Box>
    );
  }

  const items = store.profiles.map((p) => ({ label: p.id, value: p.id }));
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

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text color={colors.accent} bold>{symbols.dot} Codex Profiles</Text>
      </Box>

      <Box borderStyle="round" borderColor={colors.dim} flexDirection="row" width="100%">
        {/* Left: profile list */}
        <Box flexDirection="column" width={24} borderStyle="single" borderTop={false} borderBottom={false} borderLeft={false} borderColor={colors.dim} padding={1} paddingRight={2}>
          <Text color={colors.muted} bold> Profiles</Text>
          <Box marginTop={1} flexDirection="column">
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

              {/* 必定显示的四项核心属性 */}
              <Box flexDirection="row" marginBottom={1}>
                 <Box flexDirection="column" width="50%" marginRight={1}>
                   <Text color={colors.dim}>Base URL</Text>
                   <Text color={colors.muted} wrap="truncate-end">{activeProfile.base_url || '(empty)'}</Text>
                 </Box>
                 <Box flexDirection="column" width="50%" marginRight={1}>
                   <Text color={colors.dim}>API Key</Text>
                   <Text color={colors.muted} wrap="truncate-end">{activeProfile.api_key || '(empty)'}</Text>
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

      <Box marginTop={1} gap={2}>
        <Text color={colors.dim}>[Enter] Launch</Text>
        <Text color={colors.dim}>[e] Edit</Text>
        <Text color={colors.dim}>[a] Add profile</Text>
        <Text color={colors.dim}>[Space] Set default</Text>
        <Text color={colors.dim}>[Esc] Exit</Text>
      </Box>
    </Box>
  );
}

// ─── cs config TUI ──────────────────────────────

let pendingLaunchProfile: Profile | null = null;
let pendingEditProfileId: string | null = null;
let pendingAddProfile: boolean = false;

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

// ─── Entry Point ────────────────────────────────

async function main() {
  if (handleCli()) return;

  const cmd = process.argv[2] || 'config';

  if (cmd === 'list' || cmd === 'ls') {
    const { waitUntilExit } = render(<ListApp />);
    await waitUntilExit();
    if (pendingLaunchProfile) {
      launchCodex(pendingLaunchProfile);
      return;
    }
    if (pendingEditProfileId) {
      const { waitUntilExit: wExit } = render(<ConfigApp cmd="config" editId={pendingEditProfileId} />);
      await wExit();
      return;
    }
    if (pendingAddProfile) {
      const { waitUntilExit: wExit } = render(<ConfigApp cmd="add" />);
      await wExit();
      return;
    }
    return;
  }

  // config / add / test → 配置管理 TUI
  const { waitUntilExit } = render(<ConfigApp cmd={cmd} />);
  await waitUntilExit();
}

main();
