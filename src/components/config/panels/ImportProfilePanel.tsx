import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { colors, symbols } from '../../../theme.js';

export function ImportProfilePanel({
  onImport,
  onCancel
}: {
  onImport: (path: string) => void;
  onCancel: () => void;
}) {
  const [importPath, setImportPath] = useState('');

  useInput((input, key) => {
    if (key.escape) onCancel();
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text color={colors.accent} bold>{symbols.dot} Import Profiles</Text>
      <Box marginTop={1} gap={1}>
        <Text color={colors.primary}>{symbols.arrow}</Text>
        <Text color={colors.text}>{'Absolute Path:'.padEnd(16)}</Text>
        <TextInput 
          value={importPath} 
          onChange={setImportPath} 
          onSubmit={() => {
            onImport(importPath.trim());
          }} 
          placeholder="JSON path or raw json text (leave empty for default ~/.codex-start/profiles-export.json)" 
        />
      </Box>
      <Box marginTop={1} gap={2} flexWrap="wrap">
        <Text color={colors.dim}>[Enter] Import</Text>
        <Text color={colors.dim}>[Esc] Cancel</Text>
      </Box>
    </Box>
  );
}
