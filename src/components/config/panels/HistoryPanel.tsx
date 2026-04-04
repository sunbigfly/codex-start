import React, { useState, useMemo, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors, symbols } from '../../../theme.js';
import type { AppStore, Profile } from '../../../types.js';

type ConfirmAction = false | 'restore' | 'delete' | 'clear';

export function HistoryPanel({
  store,
  isActive,
  filterMode,
  profileId,
  onRestore,
  onDelete,
  onCancel,
  onFocusLeft,
  onToggleFilterMode
}: {
  store: AppStore;
  isActive: boolean;
  filterMode: 'global' | 'profile';
  profileId?: string;
  onRestore: (historyIdx: number) => void;
  onDelete: (idx: number | 'all') => void;
  onCancel: () => void;
  onFocusLeft: () => void;
  onToggleFilterMode: () => void;
}) {
  const [historyIdx, setHistoryIdx] = useState(0);
  const [confirmMode, setConfirmMode] = useState<ConfirmAction>(false);

  const hist = useMemo(() => {
    const raw = store.history || [];
    if (filterMode === 'global') {
      // Global Mode: 仅显示涉及全局文件变更或全局系统动作的操作
      return raw.filter((h, idx) => {
        const nextH = raw[idx + 1];
        const isInitial = h.message.includes('Initial');
        const isRestore = h.message.includes('Restore') || h.message.includes('Revert');
        const isGlobalMsg = h.message.toLowerCase().includes('global') || h.message.toLowerCase().includes('import');
        // 如果文件内容发生了物理变化，或者是初始/回溯点，则显示
        const configChanged = nextH && (h.configToml !== nextH.configToml || h.authJson !== nextH.authJson);
        return isInitial || isRestore || isGlobalMsg || configChanged;
      });
    } else if (filterMode === 'profile' && profileId) {
      // Profile Mode: 仅显示与该 Profile 相关的变更
      const profile = store.profiles.find(p => p.id === profileId);
      if (!profile) return [];
      const pname = profile.name;
      
      return raw.filter((h, idx) => {
        // 全局回溯点和初始点为了安全起见，通常需要在所有视图中可见（因为它们影响了全部）
        if (h.message.includes('Initial') || h.message.includes('Restore') || h.message.includes('Revert')) return true;
        
        // 消息中直接提到了该 Profile 的名字 (例如 Edit profile A...)
        if (h.message.includes(pname)) return true;
        
        // 深度对比：该 Profile 的配置内容是否在这一步发生了变化
        const nextH = raw[idx + 1];
        if (!nextH) return false;
        const curP = h.profiles?.find(p => p.id === profileId);
        const oldP = nextH.profiles?.find(p => p.id === profileId);
        return JSON.stringify(curP) !== JSON.stringify(oldP);
      });
    }
    return raw;
  }, [store.history, filterMode, profileId, store.profiles]);

  // Handle case where history updates and index goes out of bounds
  useEffect(() => {
    if (historyIdx >= hist.length && hist.length > 0) {
      setHistoryIdx(hist.length - 1);
    }
  }, [hist.length, historyIdx]);

  useInput((input, key) => {
    if (!isActive) return;

    if (confirmMode) {
      if (input.toLowerCase() === 'y') {
        if (confirmMode === 'restore') {
           const actualIndexInStore = (store.history || []).findIndex(h => h.id === hist[historyIdx].id);
           onRestore(actualIndexInStore >= 0 ? actualIndexInStore : 0);
        }
        if (confirmMode === 'delete') {
           const actualIndexInStore = (store.history || []).findIndex(h => h.id === hist[historyIdx].id);
           if (actualIndexInStore >= 0) onDelete(actualIndexInStore);
           if (historyIdx > 0 && historyIdx >= hist.length - 1) setHistoryIdx(Math.max(0, hist.length - 2));
           setConfirmMode(false);
        }
        if (confirmMode === 'clear') {
           onDelete('all');
           setHistoryIdx(0);
           setConfirmMode(false);
        }
      } else if (input.toLowerCase() === 'n' || key.escape) {
        setConfirmMode(false);
      }
      return;
    }

    const lcInput = input.toLowerCase();

    if (key.escape) { onCancel(); return; }
    if (lcInput === 'g') { onToggleFilterMode(); setHistoryIdx(0); return; }
    if (key.leftArrow || key.tab || (key as any).shiftTab) { onFocusLeft(); return; }
    if (key.upArrow) { setHistoryIdx(i => Math.max(0, i - 1)); return; }
    if (key.downArrow) { setHistoryIdx(i => Math.min(hist.length > 0 ? hist.length - 1 : 0, i + 1)); return; }
    if (key.return || lcInput === 'r') {
      const item = hist[historyIdx];
      if (item) {
        setConfirmMode('restore');
      }
    }
    if (lcInput === 'd' || key.delete || key.backspace) {
      if (hist.length > 0) setConfirmMode('delete');
    }
    if (lcInput === 'c') {
      if (hist.length > 0) setConfirmMode('clear');
    }
  });

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const selectedHist = hist[historyIdx];

  const { rollbackDiff, stepDiff } = useMemo(() => {
    if (!selectedHist) return { rollbackDiff: null, stepDiff: null };
    const currentProfs = store.profiles || [];
    const histProfs = selectedHist.profiles || [];
    
    // 1. Rollback Impact (Snapshot vs Current) - Always calculated relative to live state
    const curMap = new Map(currentProfs.map(p => [p.id, p]));
    const histMap = new Map(histProfs.map(p => [p.id, p]));

    const rollbackDestroy = currentProfs.filter(p => !histMap.has(p.id));
    const rollbackRecover = histProfs.filter(p => !curMap.has(p.id));
    const rollbackRevert = histProfs.map(p => {
      const c = curMap.get(p.id);
      if (!c) return null;
      if (JSON.stringify(c) === JSON.stringify(p)) return null;
      const changes: { key: string, from: any, to: any }[] = [];
      const allKeys = new Set([...Object.keys(p), ...Object.keys(c)]);
      for (const k of allKeys) {
        if (k === 'id' || k === 'createdAt') continue;
        const curVal = (c as any)[k];
        const histVal = (p as any)[k];
        if (curVal !== histVal) changes.push({ key: k, from: curVal, to: histVal });
      }
      return { profile: p, changes };
    }).filter(Boolean) as {profile: Profile, changes: any[]}[];

    const rollback = { destroy: rollbackDestroy, recover: rollbackRecover, revert: rollbackRevert };

    // 2. Step Delta - Prefer explicit delta, fallback to comparison
    let step: any = null;
    if (selectedHist.delta) {
       // Using explicitly recorded delta
       step = { isExplicit: true, ...selectedHist.delta };
    } else {
      // Legacy fallback: compare with previous snapshot
      const selfIdx = (store.history || []).findIndex(h => h.id === selectedHist.id);
      const nextHist = (store.history || [])[selfIdx + 1];
      if (nextHist && nextHist.profiles) {
        const prevMap = new Map(nextHist.profiles.map(p => [p.id, p]));
        const stepChanges = histProfs.map(p => {
          const prev = prevMap.get(p.id);
          const changes: { key: string, from: any, to: any }[] = [];
          if (!prev) return { profile: p, type: 'new' as const, changes: Object.keys(p).filter(k => k !== 'id').map(k => ({ key: k, from: null, to: (p as any)[k] })) };
          if (JSON.stringify(prev) === JSON.stringify(p)) return null;
          for (const k of new Set([...Object.keys(p), ...Object.keys(prev)])) {
            if (k === 'id' || k === 'createdAt') continue;
            if ((p as any)[k] !== (prev as any)[k]) changes.push({ key: k, from: (prev as any)[k], to: (p as any)[k] });
          }
          return { profile: p, type: 'edit' as const, changes };
        }).filter(Boolean);
        const stepDeletes = nextHist.profiles.filter(p => !histMap.has(p.id)).map(p => ({ profile: p, type: 'delete' as const }));
        step = { isExplicit: false, changes: stepChanges, deletes: stepDeletes };
      }
    }

    return { rollbackDiff: rollback, stepDiff: step };
  }, [selectedHist, store.profiles, store.history]);

  let startIdx = historyIdx - 2;
  if (startIdx + 6 > hist.length) startIdx = hist.length - 6;
  if (startIdx < 0) startIdx = 0;

  const headerText = filterMode === 'global' ? '[System-wide Snapshot Recovery] (Global)' : `[Profile History] (${store.profiles.find(p => p.id === profileId)?.name || 'Unknown'})`;

  return (
    <Box flexDirection="column" padding={1} width="100%">
      <Text color={isActive ? colors.danger : colors.dim} bold>{symbols.dot} {headerText}</Text>
      
      <Box marginTop={1} flexDirection="column" gap={0} width="100%">
        {hist.length === 0 ? (
          <Text color={colors.muted}>No history available yet.</Text>
        ) : (
          <>
            <Box flexDirection="row" marginBottom={1}>
              <Box width={3}><Text> </Text></Box>
              <Box width={22}><Text color={isActive ? colors.dim : colors.muted} bold>Time</Text></Box>
              <Box width={14}><Text color={isActive ? colors.dim : colors.muted} bold>Profiles</Text></Box>
              <Box flexGrow={1}><Text color={isActive ? colors.dim : colors.muted} bold>Action</Text></Box>
            </Box>
            {hist.slice(startIdx, startIdx + 6).map((h, relativeIdx) => {
              const actualIdx = startIdx + relativeIdx;
              const pCount = h.profiles ? `${h.profiles.length} items` : 'System only';
              const isSelected = actualIdx === historyIdx;
              return (
                <Box key={h.id} flexDirection="row" width="100%">
                  <Box width={3}>
                    <Text color={isSelected && isActive ? colors.primary : colors.dim}>
                      {isSelected ? ` ${symbols.arrow}` : '  '}
                    </Text>
                  </Box>
                  <Box width={22}>
                    <Text color={isSelected ? (isActive ? colors.text : colors.dim) : colors.muted} wrap="truncate-end">
                      {formatTime(h.timestamp)}
                    </Text>
                  </Box>
                  <Box width={14}>
                    <Text color={isSelected ? (isActive ? colors.secondary : colors.dim) : colors.muted} wrap="truncate-end">
                      {pCount}
                    </Text>
                  </Box>
                  <Box flexGrow={1}>
                    <Text color={isSelected ? (isActive ? colors.text : colors.dim) : colors.muted} wrap="truncate-end">
                      {h.message}
                    </Text>
                  </Box>
                </Box>
              );
            })}
          </>
        )}
      </Box>

      {selectedHist && (
        <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor={isActive ? colors.dim : colors.muted} paddingX={1}>
          <Box flexDirection="row" justifyContent="space-between">
            <Text color={isActive ? colors.accent : colors.dim} bold>Snapshot Detailed Analysis</Text>
            {stepDiff && <Text color={colors.dim} italic>({stepDiff.isExplicit ? stepDiff.changes.length : (stepDiff.changes.length + stepDiff.deletes.length)} recorded)</Text>}
          </Box>
          
          {/* 1. Step Changes (What this snapshot did) */}
          <Box flexDirection="column" marginTop={1}>
            <Text color={colors.dim} underline>● Step Delta (What this record captured):</Text>
            {stepDiff ? (
              <Box flexDirection="column" marginTop={0}>
                {stepDiff.isExplicit ? (
                  /* New Explicit Delta Rendering */
                  <Box flexDirection="column" paddingLeft={2}>
                    <Text color={colors.primary}>{symbols.dot} {stepDiff.target || 'System'}:</Text>
                    {stepDiff.changes.map((ch: any) => {
                      const fromStr = String(ch.from || '(empty)').slice(0, 15) + (String(ch.from || '').length > 15 ? '..' : '');
                      const toStr = String(ch.to || '(empty)').slice(0, 15) + (String(ch.to || '').length > 15 ? '..' : '');
                      return (
                        <Box key={ch.key} paddingLeft={2}>
                          <Text color={colors.dim}>{ch.key}: </Text>
                          <Text color={colors.dim}>{fromStr}</Text>
                          <Text color={colors.dim}> {symbols.arrow} </Text>
                          <Text color={colors.primary} bold>{toStr}</Text>
                        </Box>
                      );
                    })}
                  </Box>
                ) : (
                  /* Legacy Inferred Diff Rendering */
                  <>
                    {stepDiff.changes.map((c: any) => (
                      <Box key={`step_${c.profile.id}`} flexDirection="column" paddingLeft={2}>
                        <Text color={colors.primary}>{c.type === 'new' ? symbols.check : symbols.dot} {c.profile.name} {c.type === 'new' ? '(New)' : ''}</Text>
                        {c.changes.map((ch: any) => {
                          const fromStr = String(ch.from || '(empty)').slice(0, 15) + (String(ch.from || '').length > 15 ? '..' : '');
                          const toStr = String(ch.to || '(empty)').slice(0, 15) + (String(ch.to || '').length > 15 ? '..' : '');
                          return (
                            <Box key={ch.key} paddingLeft={2}>
                              <Text color={colors.dim}>{ch.key}: </Text>
                              <Text color={colors.dim}>{fromStr}</Text>
                              <Text color={colors.dim}> {symbols.arrow} </Text>
                              <Text color={colors.primary} bold>{toStr}</Text>
                            </Box>
                          );
                        })}
                      </Box>
                    ))}
                    {stepDiff.deletes.map((d: any) => (
                      <Box key={`step_del_${d.profile.id}`} paddingLeft={2}>
                        <Text color={colors.warning}>{symbols.cross} Deleted {d.profile.name}</Text>
                      </Box>
                    ))}
                  </>
                )}
              </Box>
            ) : (
               <Box paddingLeft={2}>
                 <Text color={colors.dim} italic>(Initial baseline or no previous record)</Text>
               </Box>
            )}
          </Box>

          <Box height={1} borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} borderColor={colors.dim} marginY={0} />

          {/* 2. Rollback Impact (Impact of restoring) */}
          <Box flexDirection="column">
            <Text color={isActive ? colors.warning : colors.dim} underline>● Rollback Preview (If you restore this):</Text>
            {rollbackDiff && (rollbackDiff.destroy.length > 0 || rollbackDiff.recover.length > 0 || rollbackDiff.revert.length > 0) ? (
              <Box flexDirection="column">
                {rollbackDiff.destroy.length > 0 && (
                  <Box paddingLeft={2}>
                    <Text color={isActive ? colors.danger : colors.muted}>{symbols.cross} Will destroy {rollbackDiff.destroy.length} profile(s)</Text>
                  </Box>
                )}
                {rollbackDiff.recover.length > 0 && (
                  <Box paddingLeft={2}>
                    <Text color={isActive ? colors.success : colors.muted}>{symbols.check} Will recover {rollbackDiff.recover.length} profile(s)</Text>
                  </Box>
                )}
                {rollbackDiff.revert.map(r => (
                  <Box key={`rev_${r.profile.id}`} flexDirection="column" paddingLeft={2}>
                    <Text color={isActive ? colors.warning : colors.muted}>{symbols.circle} Will revert {r.profile.name}:</Text>
                    {r.changes.map((ch: any) => {
                      const fromStr = String(ch.from || '(empty)').slice(0, 15) + (String(ch.from || '').length > 15 ? '..' : '');
                      const toStr = String(ch.to || '(empty)').slice(0, 15) + (String(ch.to || '').length > 15 ? '..' : '');
                      return (
                        <Box key={ch.key} paddingLeft={2}>
                          <Text color={colors.dim}>{ch.key}: </Text>
                          <Text color={colors.danger} strikethrough>{fromStr}</Text>
                          <Text color={colors.dim}> {symbols.arrow} </Text>
                          <Text color={colors.success} bold>{toStr}</Text>
                        </Box>
                      );
                    })}
                  </Box>
                ))}
              </Box>
            ) : (
              <Box paddingLeft={2}>
                <Text color={colors.dim} italic>Configuration already matches current state</Text>
              </Box>
            )}
          </Box>
          
          <Box marginTop={1}>
            <Text color={colors.dim} wrap="truncate-end" dimColor>[Global]: config.toml & auth.json will be forcefully restored.</Text>
          </Box>
        </Box>
      )}

      {isActive && (
        <Box marginTop={1} gap={2} flexWrap="wrap">
          {confirmMode === 'restore' ? (
            <Text color={colors.danger} bold>Are you sure you want to restore? [y/n]</Text>
          ) : confirmMode === 'delete' ? (
            <Text color={colors.warning} bold>Delete this snapshot? [y/n]</Text>
          ) : confirmMode === 'clear' ? (
            <Text color={colors.danger} bold>Clear ALL snapshots? [y/n]</Text>
          ) : (
            <>
              <Text color={colors.dim}>[Enter/r] Select to Restore  [d/Backspace] Delete</Text>
              <Text color={colors.dim}>[c] Clear All  [g] {filterMode === 'global' ? 'Profile History' : 'Global History'}</Text>
              <Text>
                <Text color={colors.accent} bold>[?] Help</Text>
                <Text color={colors.dim}>  [Esc] Cancel</Text>
              </Text>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
