import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { spawn } from 'node:child_process';
import { colors, symbols } from '../../../theme.js';
import type { Profile } from '../../../types.js';
import { ensureBackup, loadStore } from '../../../store.js';
import { restoreBackup, injectProfile } from '../../../injector.js';

export function BatchTestPanel({
  profiles,
  globalConfig,
  testResults,
  setTestResults,
  onCancel
}: {
  profiles: Profile[];
  globalConfig: Record<string, any>;
  testResults: Record<string, 'ok' | 'fail' | 'running'>;
  setTestResults: (updater: (prev: Record<string, 'ok' | 'fail' | 'running'>) => Record<string, 'ok' | 'fail' | 'running'>) => void;
  onCancel: () => void;
}) {
  const [isRunning, setIsRunning] = useState(true);

  useEffect(() => {
    let active = true;
    const runAll = async () => {
      const currentStore = ensureBackup(loadStore());
      for (let i = 0; i < profiles.length; i++) {
        if (!active) break;
        const p = profiles[i];
        setTestResults(prev => ({ ...prev, [p.id]: 'running' }));
        restoreBackup(currentStore.backup);
        injectProfile({ ...p, model: p.model || globalConfig.model || 'o3' });

        const success = await new Promise<boolean>(resolve => {
          const child = spawn('codex', ['exec', 'Reply with exactly: CONNECTIVITY_OK'], { stdio: ['ignore', 'pipe', 'pipe'] });
          let out = '';
          child.stdout?.on('data', (d: any) => { out += d.toString(); });
          child.on('error', () => resolve(false));
          child.on('close', (code: number | null) => resolve(code === 0 && Boolean(out.trim())));
        });
        
        if (!active) break;
        setTestResults(prev => ({ ...prev, [p.id]: success ? 'ok' : 'fail' }));
      }
      if (active) {
        restoreBackup(currentStore.backup);
        setIsRunning(false);
      }
    };
    runAll();
    return () => { active = false; };
  }, [profiles, globalConfig]);

  useInput((input, key) => {
    if (!isRunning) {
      if (key.escape || key.return || input === 'b') onCancel();
    }
  });

  const total = profiles.length;
  const successCount = profiles.filter(p => testResults[p.id] === 'ok').length;
  const failCount = profiles.filter(p => testResults[p.id] === 'fail').length;
  const pendingCount = total - successCount - failCount;

  return (
    <Box flexDirection="column" padding={1}>
      <Text color={colors.accent} bold>{symbols.dot} Batch Testing Configurations...</Text>
      <Box marginTop={1} flexDirection="column" gap={1}>
        <Text color={colors.warning}>{isRunning ? '🚀 Verifying connectivity across all profiles...' : '✅ Batch testing completed!'}</Text>
        <Box flexDirection="row" gap={2} paddingY={1} borderStyle="single" borderTop={false} borderLeft={false} borderRight={false} borderColor={colors.darkBorder}>
          <Text color={colors.primary}>[ Total: {total} ]</Text>
          <Text color={colors.success}>{symbols.check} Success: {successCount}</Text>
          <Text color={colors.danger}>{symbols.cross} Failed: {failCount}</Text>
          <Text color={colors.warning}>{symbols.circle} Pending: {pendingCount}</Text>
        </Box>
      </Box>
      <Box marginTop={1} flexDirection="column" paddingLeft={2}>
          {profiles.map(p => {
            const res = testResults[p.id];
            return (
              <Box key={p.id} gap={1} flexDirection="row">
                {res === 'ok' ? <Text color={colors.success}>{symbols.check}</Text>
                : res === 'fail' ? <Text color={colors.danger}>{symbols.cross}</Text>
                : res === 'running' ? <Text color={colors.warning}>{symbols.circle}</Text>
                : <Text color={colors.dim}>[wait]</Text>}
                <Text color={res === 'running' ? colors.text : colors.muted} wrap="truncate-end">{p.name}</Text>
              </Box>
            )
          })}
      </Box>
      {!isRunning && (
          <Box marginTop={1}>
              <Text color={colors.dim}>[Esc/Enter/b] Back to settings</Text>
          </Box>
      )}
    </Box>
  );
}
