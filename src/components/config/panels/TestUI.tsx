import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { spawn } from 'node:child_process';
import { colors, symbols } from '../../../theme.js';
import type { Profile } from '../../../types.js';
import { ALL_MODELS } from '../constants.js';
import { ensureBackup, loadStore } from '../../../store.js';
import { restoreBackup, injectProfile } from '../../../injector.js';
import { computeNavWidth } from '../../../utils.js';
import { RainbowText } from '../../RainbowText.js';
import { HelpUI } from './HelpUI.js';

import { HeaderLogo } from '../../HeaderLogo.js';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
function useSpinner() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setFrame(f => (f + 1) % SPINNER_FRAMES.length), 80);
    return () => clearInterval(timer);
  }, []);
  return SPINNER_FRAMES[frame];
}

const stripAnsi = (str: string) => {
  return str
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '') // Remove ANSI escape codes
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '') // Remove advanced ANSI controls 
    .replace(/\r\n/g, '\n') // IMPORTANT: Normalize Windows linebreaks so they don't trigger \r strip logic
    .replace(/[\b\v\f\x00-\x08\x0E-\x1F]/g, ''); // Strip backspaces and other invisible controls (DO NOT strip \r or \n here)
};

type TestStatus = 'ok' | 'fail' | 'running';
const TEST_TIMEOUT_MS = 120_000;

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
  const spinnerFrame = useSpinner();
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [profileIdx, setProfileIdx] = useState(0);
  const [modelIdx, setModelIdx] = useState(0);
  const [focus, setFocus] = useState<'left' | 'right'>('left');
  const abortControllerRef = useRef<AbortController | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(profiles.map(p => [p.id, true]))
  );
  const [batchStrategy, setBatchStrategy] = useState<'unified' | 'individual'>('unified');
  const [phase, setPhase] = useState<'setup' | 'running' | 'done'>('setup');
  const [customInput, setCustomInput] = useState(false);
  const [helpMode, setHelpMode] = useState(false);
  const [customModel, setCustomModel] = useState('');
  const [singleOutput, setSingleOutput] = useState('');
  const [batchOutputs, setBatchOutputs] = useState<Record<string, string[]>>({});
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
  const runTest = useCallback((profile: Profile, model: string, signal?: AbortSignal, onData?: (chunk: string) => void, skipRestore?: boolean): Promise<{ ok: boolean; output: string; durationMs: number }> => {
    return new Promise(resolve => {
      const startTime = Date.now();
      const store = ensureBackup(loadStore());
      restoreBackup(store.backup);
      injectProfile({ ...profile, model });

      const child = spawn('codex', ['exec', 'Reply with exactly: CONNECTIVITY_OK', '--skip-git-repo-check'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '', stderr = '';
      let finished = false;

      const finishAndResolve = (result: { ok: boolean; output: string; durationMs: number }) => {
        if (finished) return;
        finished = true;
        if (signal) signal.removeEventListener('abort', handleAbort);
        if (!skipRestore) restoreBackup(store.backup);
        resolve(result);
      };

      const handleAbort = () => {
        child.kill('SIGKILL');
        finishAndResolve({ ok: false, output: 'Cancelled by user', durationMs: Date.now() - startTime });
      };

      if (signal) {
        if (signal.aborted) return handleAbort();
        signal.addEventListener('abort', handleAbort);
      }

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        finishAndResolve({ ok: false, output: `Timeout after ${TEST_TIMEOUT_MS / 1000}s`, durationMs: Date.now() - startTime });
      }, TEST_TIMEOUT_MS);

      child.stdout?.on('data', (d: any) => { 
        const chunk = stripAnsi(d.toString());
        stdout += chunk; 
        if (onData) onData(chunk);
      });
      child.stderr?.on('data', (d: any) => { 
        const chunk = stripAnsi(d.toString());
        stderr += chunk;
        if (onData) onData(chunk);
      });
      child.on('error', (e: any) => {
        clearTimeout(timer);
        finishAndResolve({ ok: false, output: `Error: ${e.message}`, durationMs: Date.now() - startTime });
      });
      child.on('close', (code: number | null) => {
        clearTimeout(timer);
        const ok = code === 0 && !!stdout.trim();
        finishAndResolve({
          ok,
          output: ok ? stdout.trim().slice(0, 250) : (stderr.trim() || stdout.trim() || `exit ${code}`).slice(0, 500),
          durationMs: Date.now() - startTime,
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
    abortControllerRef.current = new AbortController();

    setTestResults(prev => ({ ...prev, [p.id]: 'running' }));

    let buffer = '';
    let lastRender = Date.now();
    let timer: NodeJS.Timeout | null = null;

    const flushOutput = (append: string) => {
      setSingleOutput(prev => {
        let text = prev + append;
        // 模拟 \r 即控制台回车动作：在任意遇到的行里，如果含有\r，则前面的内容被覆盖，只保留最后一个 \r 后面的内容
        const lines = text.split('\n').map(l => {
          const lastCr = l.lastIndexOf('\r');
          return lastCr >= 0 ? l.slice(lastCr + 1) : l;
        });
        return lines.join('\n').slice(-3000);
      });
      buffer = '';
      lastRender = Date.now();
    };

    const result = await runTest(p, model, abortControllerRef.current.signal, (chunk) => {
      buffer += chunk;
      const now = Date.now();
      if (now - lastRender > 1000) {
        flushOutput(buffer);
      } else if (!timer) {
        timer = setTimeout(() => {
          flushOutput(buffer);
          timer = null;
        }, 1000);
      }
    });
    
    if (timer) clearTimeout(timer);
    if (buffer) {
      flushOutput(buffer);
    }
    
    setTestResults(prev => ({ ...prev, [p.id]: result.ok ? 'ok' : 'fail' }));
    setTestDurations(prev => ({ ...prev, [p.id]: result.durationMs }));
    setSingleOutput(result.output);
    setPhase('done');
    abortControllerRef.current = null;
  }, [profiles, profileIdx, runTest, setTestResults, setTestDurations]);

  const startBatchTest = async (overrideUnifiedModel?: string) => {
    const unifiedModel = overrideUnifiedModel || resolveModel();
    const targets = profiles
      .filter(p => checked[p.id])
      .map(p => ({ id: p.id, model: batchStrategy === 'unified' ? unifiedModel : (p.model || fallback) }));
    if (targets.length === 0) return;
    
    setBatchTargets(targets);
    setPhase('running');
    abortControllerRef.current = new AbortController();

    // 清空本次所有待测目标上一轮的旧成绩，让它们完全成为干净的 Pending 状态
    setTestResults(prev => {
      const next = { ...prev };
      for (const t of targets) delete next[t.id];
      return next;
    });
    setTestDurations(prev => {
      const next = { ...prev };
      for (const t of targets) delete next[t.id];
      return next;
    });

    const store = ensureBackup(loadStore());
    const promises = [];
    
    // 清理之前的单独流出并且为新的各奔东西腾地
    setSingleOutput('');
    setBatchOutputs({});

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (abortControllerRef.current?.signal.aborted) break;
      const p = profiles.find(pr => pr.id === t.id);
      if (!p) continue;
      
      // 核心并行策略：错峰延迟发车（防止配置文件在刚启动时被并发写入冲掉串台）
      // 除了第一个立马发车，后续每个目标启动前静静等待 1500 毫秒
      if (i > 0) {
        await new Promise(r => setTimeout(r, 1500));
      }
      // 等待完毕后先严密防守：如果是被打断的，立即停飞撤摊以免产生永远死在 running 却不发车的僵尸幽灵！
      if (abortControllerRef.current?.signal.aborted) break;

      // 真正将要起爆的最后一刻，再挂起牌子宣告启航。这样死断中途也绝不虚挂！
      setTestResults(prev => ({ ...prev, [p.id]: 'running' }));

      let profileBuffer = '';
      let timer: NodeJS.Timeout | null = null;
      let lastRender = Date.now();

      const updateLatest = (str: string) => {
        profileBuffer += str;
        // 把 \r 换成 \n 降维，并切出最新的四条带有效字符的行，这样既充实也不会溢出专属槽
        const lines = profileBuffer.replace(/\r/g, '\n').split('\n').filter(Boolean);
        const latest4 = lines.slice(-4);
        if (latest4.length) setBatchOutputs(prev => ({ ...prev, [p.id]: latest4 }));
        if (lines.length > 20) profileBuffer = latest4.join('\n') + '\n'; // 清理内存留存四条多一点就行
        lastRender = Date.now();
      };

      // 不 await 这个测试的完成，直接推向后台让它们齐步并肩地消耗网络等待时间
      const testPromise = runTest(p, t.model, abortControllerRef.current.signal, (chunk) => {
        const now = Date.now();
        if (now - lastRender > 1000) updateLatest(chunk);
        else if (!timer) timer = setTimeout(() => { updateLatest(chunk); timer = null; }, 1000);
      }, true).then(result => {
        setTestResults(prev => ({ ...prev, [p.id]: result.ok ? 'ok' : 'fail' }));
        setTestDurations(prev => ({ ...prev, [p.id]: result.durationMs }));
        if (!result.ok && result.output) {
           updateLatest(`\n[Err] ${result.output.split('\n')[0]}`);
        }
      });
      promises.push(testPromise);
    }
    
    // 发完所有的车之后，在此等待所有的并发网络请求归位
    await Promise.all(promises);
    
    // 统一跑完所有并发后再干净地归位大环境
    restoreBackup(store.backup);
    setPhase('done');
    abortControllerRef.current = null;
  };

  // Input
  useInput((input: string, key: any) => {
    if (helpMode) return; // 让 HelpUI 自己接管它的关闭

    if (phase === 'running') {
      if (key.escape) {
        abortControllerRef.current?.abort();
      }
      return;
    }
    if (phase === 'done') { if (key.escape) setPhase('setup'); return; }
    if (customInput) { if (key.escape) setCustomInput(false); return; }

    if (input === '?' || input === '？') {
      setHelpMode(true);
      return;
    }

    const lcInput = input.toLowerCase();

    if (lcInput === 'b') { setMode(m => m === 'single' ? 'batch' : 'single'); return; }
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
      if (lcInput === 'a' && mode === 'batch') {
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
      if (mode === 'batch' && lcInput === 'u') { setBatchStrategy('unified'); return; }
      if (mode === 'batch' && lcInput === 'i') { setBatchStrategy('individual'); return; }
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
  const showList = mode === 'single' || batchStrategy === 'unified';
  const targets = mode === 'batch' ? profiles.filter(p => checked[p.id]) : [profiles[profileIdx]].filter(Boolean);
  const okN = targets.filter(p => testResults[p.id] === 'ok').length;
  const failN = targets.filter(p => testResults[p.id] === 'fail').length;
  const runningN = targets.filter(p => testResults[p.id] === 'running').length;
  const pendingN = targets.length - okN - failN - runningN;

  if (helpMode) {
    return <HelpUI onClose={() => setHelpMode(false)} themeName={globalConfig.globalTheme || 'mocha'} uiMode="test" />;
  }

  return (
    <Box flexDirection="column" padding={1}>
      <HeaderLogo themeName={globalConfig.globalTheme || 'mocha'} />
      <Box marginBottom={1} marginTop={1} gap={2}>
        <Text color={colors.accent} bold>{symbols.dot} Connectivity Test</Text>
        <Text color={mode === 'single' ? colors.primary : colors.dim} bold={mode === 'single'}>[Single]</Text>
        <Text color={mode === 'batch' ? colors.primary : colors.dim} bold={mode === 'batch'}>[Batch]</Text>
      </Box>

      <Box borderStyle="round" borderColor={colors.dim} flexDirection="row" width="100%">
        {/* Left: Profiles */}
        <Box flexDirection="column" width={computeNavWidth(profiles.map(p => p.name), mode === 'batch' ? 14 : 10, 10)} borderStyle="single" borderTop={false} borderBottom={false} borderLeft={false} borderColor={colors.dim} padding={1} paddingRight={2}>
          <Text color={colors.muted} bold>Profiles</Text>
          <Box marginTop={1} flexDirection="column">
            {profiles.map((p, i) => {
              const hl = i === profileIdx;
              const res = testResults[p.id];
              return (
                <Box key={p.id}>
                  <Text wrap="truncate-end">
                    {focus === 'left' && hl ? <Text color={colors.primary}>{`${symbols.arrow} `}</Text> : <Text>{'  '}</Text>}
                    {mode === 'batch' && <Text color={checked[p.id] ? colors.success : colors.dim}>{`[${checked[p.id] ? 'x' : ' '}] `}</Text>}
                    <Text color={p.isDefault ? colors.warning : colors.dim}>{p.isDefault ? `${symbols.star} ` : '   '}</Text>
                    {hl ? (
                      <RainbowText text={p.name} bold={focus === 'left'} />
                    ) : (
                      <Text color={colors.muted}>{p.name}</Text>
                    )}
                    <Text>
                      {res === 'ok' ? <Text color={colors.success}>{` ${symbols.check}`}</Text> :
                       res === 'fail' ? <Text color={colors.danger}>{` ${symbols.cross}`}</Text> :
                       res === 'running' ? <Text color={colors.warning}>{` ${spinnerFrame}`}</Text> :
                       <Text>{''}</Text>}
                    </Text>
                    {(res === 'ok' || res === 'fail') && <Text color={colors.dim}>{fmtDur(p.id)}</Text>}
                  </Text>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Right: Model + Strategy OR Running Status */}
        <Box flexDirection="column" flexGrow={1} padding={1} paddingLeft={2}>
          {phase === 'setup' ? (
            <>
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
                  <TextInput value={customModel} onChange={setCustomModel} onSubmit={(val: string) => {
                    setCustomInput(false);
                    if (val) setCustomModel(val);
                    if (mode === 'single') startSingleTest(val || fallback);
                    else startBatchTest(val || fallback);
                  }} placeholder="e.g. gpt-5.4" />
                </Box>
              )}
              {mode === 'batch' && batchStrategy === 'individual' && (
                <Box flexDirection="column" marginTop={1}>
                  <Text color={colors.secondary}>Each profile uses its configured model</Text>
                  <Text color={colors.dim}>(Fallback: {fallback})</Text>
                </Box>
              )}
            </>
          ) : (
            <Box flexDirection="column">
              <Text color={colors.text} bold>{mode === 'batch' ? 'Batch Testing' : 'Testing'} {mode === 'single' ? profiles[profileIdx]?.name : `${targets.length} profiles`}</Text>
              
              {mode === 'batch' && (
                <Box marginTop={1} gap={2}>
                  <Text color={colors.primary}>[ Total: {targets.length} ]</Text>
                  <Text color={colors.success}>{symbols.check} OK: {okN}</Text>
                  <Text color={colors.danger}>{symbols.cross} Fail: {failN}</Text>
                  {runningN > 0 && <Text color={colors.accent}>{spinnerFrame} Running: {runningN}</Text>}
                  {pendingN > 0 && <Text color={colors.warning}>{symbols.circle} Pending: {pendingN}</Text>}
                </Box>
              )}

              {mode === 'single' ? (
                <Box flexDirection="column" marginTop={1} padding={1} borderStyle="single" borderColor={colors.darkBorder}>
                  <Text color={colors.muted} bold>Live Task Logs</Text>
                  <Box flexDirection="column" marginTop={1} gap={1}>
                    <Box flexDirection="column" minHeight={15}>
                      <Text color={phase === 'running' ? colors.text : colors.dim}>
                        {phase === 'running' ? `${spinnerFrame} ` : '  '}<Text color={colors.primary} bold>[{profiles[profileIdx]?.name}]</Text>
                        {testResults[profiles[profileIdx]?.id] === 'ok' ? <Text color={colors.success}>{` ${symbols.check}`}</Text> :
                         testResults[profiles[profileIdx]?.id] === 'fail' ? <Text color={colors.danger}>{` ${symbols.cross}`}</Text> :
                         null}
                        {(testResults[profiles[profileIdx]?.id] === 'ok' || testResults[profiles[profileIdx]?.id] === 'fail') && <Text color={colors.dim}>{fmtDur(profiles[profileIdx]?.id)}</Text>}
                      </Text>
                      {singleOutput ? singleOutput.trim().split('\n').filter(Boolean).slice(-15).map((line, i) => {
                        const safeLine = line.length > 80 ? line.slice(0, 77) + '...' : line;
                        return (
                          <Text key={i} color={phase === 'running' ? colors.muted : (testResults[profiles[profileIdx]?.id] === 'ok' ? colors.secondary : colors.text)} wrap="truncate-end">
                            {`    ${safeLine}`}
                          </Text>
                        );
                      }) : (
                        <Text color={colors.dim}>{`    [Waiting for output...]`}</Text>
                      )}
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Box flexDirection="column" marginTop={1} padding={1} borderStyle="single" borderColor={colors.darkBorder}>
                  <Text color={colors.muted} bold>Live Task Logs</Text>
                  <Box flexDirection="column" marginTop={1} gap={1}>
                    {targets.map(t => {
                      const p = profiles.find(pr => pr.id === t.id);
                      if (!p) return null;
                      const lines = batchOutputs[p.id] || ['Loading...'];
                      const isRunning = testResults[p.id] === 'running';
                      return (
                        <Box key={p.id} flexDirection="column" minHeight={5}>
                          <Text color={isRunning ? colors.text : colors.dim}>
                            {isRunning ? `${spinnerFrame} ` : '  '}<Text color={colors.primary} bold>[{p.name}]</Text>
                            {testResults[p.id] === 'ok' ? <Text color={colors.success}>{` ${symbols.check}`}</Text> :
                             testResults[p.id] === 'fail' ? <Text color={colors.danger}>{` ${symbols.cross}`}</Text> :
                             null}
                            {(testResults[p.id] === 'ok' || testResults[p.id] === 'fail') && <Text color={colors.dim}>{fmtDur(p.id)}</Text>}
                          </Text>
                          {lines.map((l, idx) => {
                             // 切断 80 确保哪怕没有 Ink 原生保护终端，也不会自动变长软换行软换行抖动
                             const safeLine = l.length > 80 ? l.slice(0, 77) + '...' : l;
                             return (
                               <Text key={idx} color={colors.dim} wrap="truncate-end">
                                 {`    ${safeLine}`}
                               </Text>
                             );
                          })}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>

      <Box marginTop={1} gap={2} flexWrap="wrap">
        {phase !== 'setup' ? (
          <Text color={colors.dim}>{phase === 'running' ? '[Esc] Cancel' : '[Esc] Back'}</Text>
        ) : mode === 'single' ? (
          <>
            <Text color={colors.dim}>[Enter] Test  [b] Batch mode</Text>
            <Text color={colors.dim}>[Tab/Arrow] Select model</Text>
            <Text>
              <Text color={colors.accent} bold>[?] Help</Text>
              <Text color={colors.dim}>  [Esc] Back</Text>
            </Text>
          </>
        ) : (
          <>
            <Text color={colors.dim}>[Enter] Run batch  [b] Single mode</Text>
            <Text color={colors.dim}>[u/i] Strategy  [Space] Toggle  [a] All</Text>
            <Text>
              <Text color={colors.accent} bold>[?] Help</Text>
              <Text color={colors.dim}>  [Esc] Back</Text>
            </Text>
          </>
        )}
      </Box>
    </Box>
  );
}
