import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import { spawn } from 'node:child_process';
import { colors, symbols } from '../../../theme.js';
import type { Profile } from '../../../types.js';
import { ensureBackup, loadStore } from '../../../store.js';
import { restoreBackup, injectProfile } from '../../../injector.js';

export function TestProfilePanel({
  profile,
  globalConfig,
  setTestResults,
  onCancel,
}: {
  profile: Profile;
  globalConfig: Record<string, any>;
  setTestResults: (updater: (prev: Record<string, 'ok' | 'fail' | 'running'>) => Record<string, 'ok' | 'fail' | 'running'>) => void;
  onCancel: (runBatch?: boolean) => void;
}) {
  const [testModel, setTestModel] = useState('');
  const [testModelCustomMode, setTestModelCustomMode] = useState(false);
  const [testStatus, setTestStatus] = useState<'input' | 'running' | 'success' | 'fail'>('input');
  const [testOutput, setTestOutput] = useState('');

  useInput((input, key) => {
    if (testStatus !== 'running') {
      if (key.escape) onCancel();
    }
  });

  if (testStatus === 'input') {
    const doTest = (modelVal: string) => {
      const actualModel = modelVal || globalConfig.model || 'o3';
      setTestStatus('running');
      setTestOutput('');

      const currentStore = ensureBackup(loadStore());
      restoreBackup(currentStore.backup);
      injectProfile({ ...profile, model: actualModel });

      const child = spawn('codex', ['exec', 'Reply with exactly: CONNECTIVITY_OK'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '', stderr = '';
      child.stdout?.on('data', (d: any) => { stdout += d.toString(); });
      child.stderr?.on('data', (d: any) => { stderr += d.toString(); });

      child.on('error', (err: any) => {
        setTestStatus('fail');
        setTestOutput(`Failed to start: ${err.message}`);
      });

      child.on('close', (code: number | null) => {
        if (code === 0 && stdout.trim()) {
          setTestStatus('success');
          setTestOutput(stdout.trim().slice(0, 250));
          setTestResults(prev => ({ ...prev, [profile.id]: 'ok' }));
        } else {
          setTestStatus('fail');
          setTestOutput((stderr.trim() || stdout.trim() || `exit code ${code}`).slice(0, 500));
          setTestResults(prev => ({ ...prev, [profile.id]: 'fail' }));
        }
        restoreBackup(currentStore.backup);
      });
    };

    const fallbackModel = globalConfig.model || 'o3';
    const customOptions = new Set(['o3', 'o1', 'o3-mini', 'gpt-4o', 'gpt-4.5-preview', 'claude-3.7-sonnet', 'claude-3.5-sonnet', 'deepseek-chat', 'deepseek-reasoner', 'qwen-max', 'gemini-2.5-pro']);
    let customItems: { label: string, value: string }[] = [];
    if (testModel && !customOptions.has(testModel)) {
       customItems.push({ label: `${testModel} (Current)`, value: testModel });
    }

    const items = [
      { label: `(Default) - use global: ${fallbackModel}`, value: '' },
      ...Array.from(customOptions).map((o) => ({ label: o, value: o })),
      ...customItems,
      { label: '+ Custom Input...', value: '__custom__' },
      { label: '🚀 全局联通性抽检跑测 (Batch test all)', value: '__batch__' },
    ];

    return (
      <Box flexDirection="column" padding={1}>
        <Text color={colors.accent} bold>{symbols.dot} Test Profile: {profile.name}</Text>
        <Box marginTop={1} gap={1} flexDirection="column">
          {testModelCustomMode ? (
             <Box gap={1}>
               <Text color={colors.primary}>{symbols.arrow} Model:</Text>
               <TextInput
                 value={testModel}
                 onChange={setTestModel}
                 onSubmit={() => doTest(testModel)}
                 placeholder={`(Empty will use ${fallbackModel}) e.g. o3`}
               />
             </Box>
          ) : (
              <SelectInput
                items={items}
                initialIndex={Math.max(0, items.findIndex((i) => i.value === testModel))}
                onSelect={(item) => {
                  if (item.value === '__custom__') {
                    setTestModelCustomMode(true);
                  } else if (item.value === '__batch__') {
                    onCancel(true); // emit start batch signal
                  } else {
                    doTest(String(item.value));
                  }
                }}
                indicatorComponent={({ isSelected }) => (<Text color={isSelected ? colors.primary : colors.dim}>{isSelected ? symbols.arrow : ' '} </Text>)}
                itemComponent={({ isSelected, label }) => {
                  const isActive = items.find((i) => i.label === label)?.value === testModel;
                  return (
                    <Box gap={1}>
                      {isActive && <Text color={colors.success}>{symbols.check}</Text>}
                      <Text color={isSelected ? colors.text : colors.muted} italic={label.startsWith('+')}>{label}</Text>
                    </Box>
                  );
                }}
              />
          )}
        </Box>
        <Box marginTop={1}>
           <Text color={colors.dim}>
             {testModelCustomMode ? '[Enter] Start test  [Esc] Cancel  (Empty = Global)' : '[Enter] Select & Start test  [Esc] Cancel'}
           </Text>
        </Box>
      </Box>
    );
  }

  const isRunning = testStatus === 'running';
  const isSuccess = testStatus === 'success';
  const statusColor = isRunning ? colors.warning : isSuccess ? colors.success : colors.danger;
  const statusIcon = isRunning ? symbols.circle : isSuccess ? symbols.check : symbols.cross;

  return (
    <Box flexDirection="column" padding={1}>
      <Text color={colors.accent} bold>{symbols.dot} Test Profile: {profile.name}</Text>
      <Box marginTop={1} gap={1}>
        <Text color={statusColor}>{statusIcon}</Text>
        <Text color={statusColor} bold>{isRunning ? 'Testing connection...' : isSuccess ? 'Connection OK' : 'Connection Failed'}</Text>
      </Box>

      {testOutput && (
        <Box flexDirection="column" marginTop={1} paddingLeft={2}>
          {testOutput.split('\n').map((line, i) => (
            <Text key={i} color={isSuccess ? colors.secondary : colors.muted}>{line}</Text>
          ))}
        </Box>
      )}

      {!isRunning && (
        <Box marginTop={1} gap={2}>
          <Text color={colors.dim}>[Esc] Back to settings</Text>
        </Box>
      )}
    </Box>
  );
}
