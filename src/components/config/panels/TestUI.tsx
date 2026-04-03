import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { spawn } from 'node:child_process';
import { colors, symbols } from '../../../theme.js';
import type { Profile } from '../../../types.js';
import { ALL_MODELS } from '../constants.js';
import { ensureBackup, loadStore } from '../../../store.js';
import { restoreBackup, injectProfile } from '../../../injector.js';

type TestStatus = 'ok' | 'fail' | 'running';
const TEST_TIMEOUT_MS = 15_000;

interface Props {
  profiles: Profile[];
  globalConfig: Record<string, any>;
  testResults: Record<string, TestStatus>;
  setTestResults: (updater: (prev: Record<string, TestStatus>) => Record<string, TestStatus>) => void;
  testDurations: Record<string, number>;
  setTestDurations: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
  onCancel: () => void;
}

export function TestUI({ profiles, globalConfig, testResults, setTestResults, testDurations, setTestDurations, onCancel }: Props) {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [profileIdx, setProfileIdx] = useState(0);
  const [modelIdx, setModelIdx] = useState(0);
  const [focus, setFocus] = useState<'left' | 'right'>('left');
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(profiles.map(p => [p.id, true]))
  );
  const [batchStrategy, setBatchStrategy] = useState<'unified' | 'individual'>('unified');
  const [phase, setPhase] = useState<'setup' | 'running' | 'done'>('setup');
  const [customInput, setCustomInput] = useState(false);
  const [customModel, setCustomModel] = useState('');
  const [singleOutput, setSingleOutput] = useState('');
  const [batchTargets, setBatchTargets] = useState<{ id: string; model: string }[]>([]);

  const fallback = globalConfig.model || 'gpt-5.4';
  const modelItems = [
    { label: `(Default) ${fallback}`, value: '' },
    ...ALL_MODELS.map(m => ({ label: m, value: m })),
    { label: '+ Custom Input...', value: '__custom__' },
  ];

  const resolveModel = (overrideModel?: string) => {
    if (customModel) return customModel;
    const val = modelItems[modelIdx]?.value || '';
    return val || overrideModel || fallback;
  };

  // 通用执行测试的函数，含超时控制和耗时记录
  const runTest = useCallback((profile: Profile, model: string): Promise<{ ok: boolean; output: string; durationMs: number }> => {
    return new Promise(resolve => {
      const startTime = Date.now();
      const store = ensureBackup(loadStore());
      restoreBackup(store.backup);
      injectProfile({ ...profile, model });

      const child = spawn('codex', ['exec', 'Reply with exactly: CONNECTIVITY_OK'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '', stderr = '';
      let finished = false;

      const timer = setTimeout(() => {
        if (!finished) {
          finished = true;
          child.kill('SIGTERM');
          const dur = Date.now() - startTime;
          restoreBackup(store.backup);
          resolve({ ok: false, output: `Timeout after ${(dur / 1000).toFixed(1)}s`, durationMs: dur });
        }
      }, TEST_TIMEOUT_MS);

      child.stdout?.on('data', (d: any) => { stdout += d.toString(); });
      child.stderr?.on('data', (d: any) => { stderr += d.toString(); });
      child.on('error', (e: any) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        const dur = Date.now() - startTime;
        restoreBackup(store.backup);
        resolve({ ok: false, output: `Error: ${e.message}`, durationMs: dur });
      });
      child.on('close', (code: number | null) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        const dur = Date.now() - startTime;
        const ok = code === 0 && !!stdout.trim();
        restoreBackup(store.backup);
        resolve({
          ok,
          output: ok ? stdout.trim().slice(0, 250) : (stderr.trim() || stdout.trim() || `exit ${code}`).slice(0, 500),
          durationMs: dur,
        });
      });
    });
  }, []);

  // Single test
  const startSingleTest = useCallback(async (model: string) => {
    const p = profiles[profileIdx];
    if (!p) return;
    setPhase('running');
    setSingleOutput('');
    setTestResults(prev => ({ ...prev, [p.id]: 'running' }));
    const result = await runTest(p, model);
    setTestResults(prev => ({ ...prev, [p.id]: result.ok ? 'ok' : 'fail' }));
    setTestDurations(prev => ({ ...prev, [p.id]: result.durationMs }));
    setSingleOutput(result.output);
    setPhase('done');
  }, [profiles, profileIdx, runTest, setTestResults, setTestDurations]);

  // Batch test (useEffect-driven)
  useEffect(() => {
    if (phase !== 'running' || batchTargets.length === 0) return;
    let active = true;
    (async () => {
      for (const t of batchTargets) {
        if (!active) break;
        const p = profiles.find(pr => pr.id === t.id);
        if (!p) continue;
        setTestResults(prev => ({ ...prev, [p.id]: 'running' }));
        const result = await runTest(p, t.model);
        if (!active) break;
        setTestResults(prev => ({ ...prev, [p.id]: result.ok ? 'ok' : 'fail' }));
        setTestDurations(prev => ({ ...prev, [p.id]: result.durationMs }));
      }
      if (active) { setBatchTargets([]); setPhase('done'); }
    })();
    return () => { active = false; };
  }, [batchTargets, profiles, runTest, setTestResults, setTestDurations, phase]);

  const startBatchTest = () => {
    const unifiedModel = resolveModel();
    const targets = profiles
      .filter(p => checked[p.id])
      .map(p => ({ id: p.id, model: batchStrategy === 'unified' ? unifiedModel : (p.model || fallback) }));
    if (targets.length === 0) return;
    setBatchTargets(targets);
    setPhase('running');
  };

  // Input
  useInput((input, key) => {
    if (phase === 'running') return;
    if (phase === 'done') { if (key.escape) setPhase('setup'); return; }
    if (customInput) { if (key.escape) setCustomInput(false); return; }

    if (input === 'b') { setMode(m => m === 'single' ? 'batch' : 'single'); return; }
    if (key.escape) { focus === 'right' ? setFocus('left') : onCancel(); return; }

    if (focus === 'left') {
      if (key.upArrow) { setProfileIdx(i => Math.max(0, i - 1)); return; }
      if (key.downArrow) { setProfileIdx(i => Math.min(profiles.length - 1, i + 1)); return; }
      if (key.rightArrow || key.tab) { setFocus('right'); return; }
      if (input === ' ' && mode === 'batch') {
        const p = profiles[profileIdx];
        setChecked(prev => ({ ...prev, [p.id]: !prev[p.id] }));
        return;
      }
      if (input === 'a' && mode === 'batch') {
        const all = profiles.every(p => checked[p.id]);
        setChecked(Object.fromEntries(profiles.map(p => [p.id, !all])));
        return;
      }
      if (key.return) {
        mode === 'single' ? startSingleTest(resolveModel(profiles[profileIdx]?.model)) : startBatchTest();
        return;
      }
    }

    if (focus === 'right') {
      if (key.leftArrow) { setFocus('left'); return; }
      if (mode === 'batch' && input === 'u') { setBatchStrategy('unified'); return; }
      if (mode === 'batch' && input === 'i') { setBatchStrategy('individual'); return; }
      const showList = mode === 'single' || batchStrategy === 'unified';
      if (showList) {
        if (key.upArrow) { setModelIdx(i => Math.max(0, i - 1)); return; }
        if (key.downArrow) { setModelIdx(i => Math.min(modelItems.length - 1, i + 1)); return; }
      }
      if (key.return) {
        if (showList && modelItems[modelIdx]?.value === '__custom__') { setCustomInput(true); return; }
        mode === 'single' ? startSingleTest(resolveModel(profiles[profileIdx]?.model)) : startBatchTest();
      }
    }
  });

  // 格式化耗时
  const fmtDur = (id: string) => {
    const ms = testDurations[id];
    if (ms == null) return '';
    return ` ${(ms / 1000).toFixed(1)}s`;
  };

  // Running / Done render
  if (phase === 'running' || phase === 'done') {
    const targets = mode === 'batch' ? profiles.filter(p => checked[p.id]) : [profiles[profileIdx]].filter(Boolean);
    const okN = targets.filter(p => testResults[p.id] === 'ok').length;
    const failN = targets.filter(p => testResults[p.id] === 'fail').length;
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={colors.accent} bold>{symbols.dot} {mode === 'batch' ? 'Batch Testing' : 'Testing'} {mode === 'single' ? profiles[profileIdx]?.name : `${targets.length} profiles`}</Text>
        {mode === 'batch' && (
          <Box marginTop={1} gap={2}>
            <Text color={colors.primary}>[ Total: {targets.length} ]</Text>
            <Text color={colors.success}>{symbols.check} OK: {okN}</Text>
            <Text color={colors.danger}>{symbols.cross} Fail: {failN}</Text>
            <Text color={colors.warning}>{symbols.circle} Pending: {targets.length - okN - failN}</Text>
          </Box>
        )}
        <Box marginTop={1} flexDirection="column" paddingLeft={1}>
          {targets.map(p => {
            const res = testResults[p.id];
            return (
              <Box key={p.id} gap={1}>
                {res === 'ok' ? <Text color={colors.success}>{symbols.check}</Text>
                  : res === 'fail' ? <Text color={colors.danger}>{symbols.cross}</Text>
                  : res === 'running' ? <Text color={colors.warning}>{symbols.circle}</Text>
                  : <Text color={colors.dim}>[..]</Text>}
                <Text color={res === 'running' ? colors.text : colors.muted}>{p.name}</Text>
                {(res === 'ok' || res === 'fail') && <Text color={res === 'ok' ? colors.success : colors.danger}>{fmtDur(p.id)}</Text>}
              </Box>
            );
          })}
        </Box>
        {mode === 'single' && singleOutput && (
          <Box flexDirection="column" marginTop={1} paddingLeft={2}>
            {singleOutput.split('\n').map((line, i) => (
              <Text key={i} color={testResults[profiles[profileIdx]?.id] === 'ok' ? colors.secondary : colors.muted}>{line}</Text>
            ))}
          </Box>
        )}
        <Box marginTop={1}><Text color={colors.dim}>{phase === 'running' ? 'Testing...' : '[Esc] Back'}</Text></Box>
      </Box>
    );
  }

  // Setup render
  const showList = mode === 'single' || batchStrategy === 'unified';
  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1} gap={2}>
        <Text color={colors.accent} bold>{symbols.dot} Connectivity Test</Text>
        <Text color={mode === 'single' ? colors.primary : colors.dim} bold={mode === 'single'}>[Single]</Text>
        <Text color={mode === 'batch' ? colors.primary : colors.dim} bold={mode === 'batch'}>[Batch]</Text>
      </Box>

      <Box borderStyle="round" borderColor={focus === 'left' ? colors.primary : colors.darkBorder} flexDirection="row" width="100%">
        {/* Left: Profiles */}
        <Box flexDirection="column" width="20%" minWidth={16} flexShrink={0} borderStyle="single" borderTop={false} borderBottom={false} borderLeft={false} borderColor={colors.darkBorder} padding={1}>
          <Text color={colors.muted} bold>Profiles</Text>
          <Box marginTop={1} flexDirection="column">
            {profiles.map((p, i) => {
              const hl = i === profileIdx;
              const res = testResults[p.id];
              return (
                <Box key={p.id} gap={1}>
                  {focus === 'left' && hl ? <Text color={colors.primary}>{symbols.arrow}</Text> : <Text> </Text>}
                  {mode === 'batch' && <Text color={checked[p.id] ? colors.success : colors.dim}>[{checked[p.id] ? 'x' : ' '}]</Text>}
                  {res === 'ok' && <Text color={colors.success}>{symbols.check}</Text>}
                  {res === 'fail' && <Text color={colors.danger}>{symbols.cross}</Text>}
                  {res === 'running' && <Text color={colors.warning}>{symbols.circle}</Text>}
                  <Text color={hl && focus === 'left' ? colors.text : colors.muted} wrap="truncate-end">{p.name}</Text>
                  {(res === 'ok' || res === 'fail') && <Text color={colors.dim}>{fmtDur(p.id)}</Text>}
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Right: Model + Strategy */}
        <Box flexDirection="column" flexGrow={1} padding={1} paddingLeft={2}>
          {mode === 'batch' && (
            <Box marginBottom={1} gap={2}>
              <Text color={batchStrategy === 'unified' ? colors.primary : colors.dim} bold={batchStrategy === 'unified'}>[u] Unified Model</Text>
              <Text color={batchStrategy === 'individual' ? colors.primary : colors.dim} bold={batchStrategy === 'individual'}>[i] Per-profile</Text>
            </Box>
          )}
          {showList && !customInput && (
            <>
              <Text color={colors.muted} bold>Model:</Text>
              <Box marginTop={1} flexDirection="column">
                {modelItems.map((item, i) => {
                  const hl = i === modelIdx && focus === 'right';
                  return (
                    <Box key={`${item.value}-${i}`} gap={1}>
                      <Text color={hl ? colors.primary : colors.dim}>{hl ? symbols.arrow : ' '}</Text>
                      <Text color={hl ? colors.text : colors.muted} italic={item.value === '__custom__'}>{item.label}</Text>
                    </Box>
                  );
                })}
              </Box>
            </>
          )}
          {customInput && (
            <Box gap={1} marginTop={1}>
              <Text color={colors.primary}>{symbols.arrow} Model:</Text>
              <TextInput value={customModel} onChange={setCustomModel} onSubmit={(val) => {
                setCustomInput(false);
                if (val) setCustomModel(val);
                if (mode === 'single') startSingleTest(val || fallback);
              }} placeholder="e.g. gpt-5.4" />
            </Box>
          )}
          {mode === 'batch' && batchStrategy === 'individual' && (
            <Box flexDirection="column" marginTop={1}>
              <Text color={colors.secondary}>Each profile uses its configured model</Text>
              <Text color={colors.dim}>(Fallback: {fallback})</Text>
            </Box>
          )}
        </Box>
      </Box>

      <Box marginTop={1} gap={2} flexWrap="wrap">
        {mode === 'single' ? (
          <>
            <Text color={colors.dim}>[Enter] Test</Text>
            <Text color={colors.dim}>[b] Batch mode</Text>
            <Text color={colors.dim}>[Tab/Arrow] Select model</Text>
            <Text color={colors.dim}>[Esc] Back</Text>
          </>
        ) : (
          <>
            <Text color={colors.dim}>[Enter] Run batch</Text>
            <Text color={colors.dim}>[Space] Toggle  [a] All</Text>
            <Text color={colors.dim}>[b] Single mode  [u/i] Strategy</Text>
            <Text color={colors.dim}>[Esc] Back</Text>
          </>
        )}
      </Box>
    </Box>
  );
}
