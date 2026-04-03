import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { colors, symbols } from '../../../theme.js';
import { maskApiKey } from '../../../utils.js';

export function AddProfilePanel({
  onAdd,
  onCancel
}: {
  onAdd: (url: string, key: string, name: string) => void;
  onCancel: () => void;
}) {
  const [addStep, setAddStep] = useState(0);
  const [addUrl, setAddUrl] = useState('');
  const [addKey, setAddKey] = useState('');
  const [addName, setAddName] = useState('');
  const [urlWarning, setUrlWarning] = useState('');

  useInput((input, key) => {
    if (key.escape) onCancel();
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text color={colors.accent} bold>{symbols.dot} Add Profile</Text>
      <Box marginTop={1} flexDirection="column">
        {addStep >= 0 && (
          <Box gap={1}>
            <Text color={addStep === 0 ? colors.primary : colors.success}>{addStep === 0 ? symbols.arrow : symbols.check}</Text>
            <Text color={colors.text}>{'API Base URL:'.padEnd(16)}</Text>
            {addStep === 0 ? (
              <Box flexDirection="column">
                <TextInput value={addUrl} onChange={(v) => { setAddUrl(v); setUrlWarning(''); }} onSubmit={() => { 
                  let finalUrl = addUrl.trim();
                  if (!finalUrl) return;
                  if (finalUrl.match(/^https?:\/\//) && !finalUrl.endsWith('/v1')) {
                    finalUrl = finalUrl.replace(/\/+$/, '') + '/v1';
                    setAddUrl(finalUrl);
                    setUrlWarning('已自动补全 /v1 后缀，请再次按下 [Enter] 确认 (Auto appended /v1)');
                    return;
                  }
                  setAddStep(1); 
                }} placeholder="https://api.openai.com/v1" />
                {urlWarning && <Text color={colors.warning}>[!] {urlWarning}</Text>}
              </Box>
            ) : (
              <Text color={colors.secondary}>{addUrl}</Text>
            )}
          </Box>
        )}
        {addStep >= 1 && (
          <Box gap={1}>
            <Text color={addStep === 1 ? colors.primary : colors.success}>{addStep === 1 ? symbols.arrow : symbols.check}</Text>
            <Text color={colors.text}>{'API Key:'.padEnd(16)}</Text>
            {addStep === 1 ? (
              <TextInput value={addKey} onChange={setAddKey} onSubmit={() => { 
                if (!addKey) return; 
                setAddStep(2); 
              }} placeholder="sk-..." />
            ) : (
              <Text color={colors.dim}>{maskApiKey(addKey)}</Text>
            )}
          </Box>
        )}
        {addStep >= 2 && (
          <Box gap={1}>
            <Text color={addStep === 2 ? colors.primary : colors.success}>{addStep === 2 ? symbols.arrow : symbols.check}</Text>
            <Text color={colors.text}>{'Profile Name:'.padEnd(16)}</Text>
            {addStep === 2 ? (
              <TextInput value={addName} onChange={setAddName} onSubmit={() => {
                const finalName = addName.trim();
                if (!finalName) return; // Prompt user to enter a name
                onAdd(addUrl, addKey, finalName);
              }} placeholder="Please enter a profile name" />
            ) : (
              <Text color={colors.secondary}>{addName}</Text>
            )}
          </Box>
        )}
      </Box>
      <Box marginTop={1}><Text color={colors.dim}>[Enter] Next  [Esc] Cancel</Text></Box>
    </Box>
  );
}
