import React from 'react';
import { Box, Text, useInput } from 'ink';
import { colors, symbols } from '../../../theme.js';
import type { Profile } from '../../../types.js';

export function DeleteProfilePanel({
  profile,
  onConfirm,
  onCancel
}: {
  profile: Profile;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useInput((input, key) => {
    if (key.escape || input === 'n' || input === 'N') {
      onCancel();
    } else if (input === 'y' || input === 'Y' || key.return) {
      onConfirm();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text color={colors.danger} bold>{symbols.dot} Delete Profile</Text>
      <Box marginTop={1} gap={1} flexDirection="column">
        <Text color={colors.warning}>Are you sure you want to delete profile "{profile.name}"?</Text>
      </Box>
      <Box marginTop={1} gap={2} flexWrap="wrap">
        <Text color={colors.dim}>[y/Enter] Confirm</Text>
        <Text color={colors.dim}>[n/Esc] Cancel</Text>
      </Box>
    </Box>
  );
}
