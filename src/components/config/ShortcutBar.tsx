/**
 * 底部快捷键提示栏 -- 根据当前焦点状态和模式显示对应的可用操作。
 */
import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../theme.js';

interface Props {
  focusState: 'left' | 'right' | 'edit';
  historyFilter: 'global' | 'profile' | null;
  markedIds: Set<string>;
  isSubMode: boolean;
}

export function ShortcutBar({ focusState, historyFilter, markedIds, isSubMode }: Props) {
  if (isSubMode) return null;

  if (historyFilter) {
    return (
      <Box gap={2} flexWrap="wrap">
        <Box flexGrow={1} />
        <Text color={colors.dim}>{focusState === 'left' ? '[Tab/\u2192] History Keys' : '[Tab/\u2190] Profile Keys'}</Text>
        <Text color={colors.dim}>[Esc] Exit History</Text>
      </Box>
    );
  }

  if (focusState === 'left') {
    return (
      <Box gap={2} flexWrap="wrap">
        <Text color={colors.dim}>{'[Tab/\u2192] Edit  [J/K] Reorder'}</Text>
        <Text color={colors.dim}>[c] Clone  {markedIds.size > 0 ? `[d] Batch Del (${markedIds.size})` : '[d] Delete'}  [m] Mark</Text>
        <Text color={colors.dim}>[g] Sync to Global  [h] History</Text>
        <Text color={colors.dim}>[i] Import  [x] Export  [t] Test</Text>
        <Text color={colors.dim}>[Space] Default  [w] Theme  [l] Lang</Text>
        <Text>
          <Text color={colors.accent} bold>[?] Help</Text>
          <Text color={colors.dim}>  [Esc] Exit</Text>
        </Text>
      </Box>
    );
  }

  return (
    <Box gap={2} flexWrap="wrap">
      <Text color={colors.dim}>{'[Enter/\u2192] Edit Field  [Tab] Jump Category'}</Text>
      <Text color={colors.dim}>[s] Save to Global  [g] Sync All to Global</Text>
      <Text color={colors.dim}>[p] Preview  [h] History</Text>
      <Text color={colors.dim}>[Up/Down] Navigate  [l] Language</Text>
      <Text>
        <Text color={colors.accent} bold>[?] Help</Text>
        <Text color={colors.dim}>{'  [Esc/\u2190] Back'}</Text>
      </Text>
    </Box>
  );
}
