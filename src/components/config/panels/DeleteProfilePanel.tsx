import React from 'react';
import { Box, Text, useInput } from 'ink';
import { colors, symbols } from '../../../theme.js';
import type { Profile } from '../../../types.js';

export function DeleteProfilePanel({
  profiles,
  onConfirm,
  onCancel
}: {
  profiles: Profile[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useInput((input, key) => {
    const lcInput = input.toLowerCase();
    if (key.escape || lcInput === 'n') {
      onCancel();
    } else if (lcInput === 'y' || key.return) {
      onConfirm();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text color={colors.danger} bold>{symbols.dot} Delete Profile</Text>
      <Box marginTop={1} gap={1} flexDirection="column">
        {profiles.length === 1 ? (
          <Text color={colors.warning}>Are you sure you want to delete profile "{profiles[0].name}"?</Text>
        ) : (
          <Text color={colors.warning}>Are you sure you want to delete {profiles.length} selected profiles?</Text>
        )}
      </Box>
      <Box marginTop={1} gap={2} flexWrap="wrap">
        <Text color={colors.dim}>[y/Enter] Confirm</Text>
        <Text color={colors.dim}>[n/Esc] Cancel</Text>
      </Box>
    </Box>
  );
}
