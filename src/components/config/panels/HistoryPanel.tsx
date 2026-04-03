import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors, symbols } from '../../../theme.js';
import type { AppStore } from '../../../types.js';

export function HistoryPanel({
  store,
  onRestore,
  onCancel
}: {
  store: AppStore;
  onRestore: (historyIdx: number) => void;
  onCancel: () => void;
}) {
  const [historyIdx, setHistoryIdx] = useState(0);
  const hist = store.history || [];

  useInput((input, key) => {
    if (key.escape) { onCancel(); return; }
    if (key.upArrow) { setHistoryIdx(i => Math.max(0, i - 1)); return; }
    if (key.downArrow) { setHistoryIdx(i => Math.min(hist.length > 0 ? hist.length - 1 : 0, i + 1)); return; }
    if (key.return || input === 'r') {
      const item = hist[historyIdx];
      if (item) {
        onRestore(historyIdx);
      }
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text color={colors.accent} bold>{symbols.dot} Global Config History</Text>
      <Box marginTop={1} flexDirection="column" gap={1}>
        {hist.length === 0 ? (
          <Text color={colors.muted}>No history available yet.</Text>
        ) : (
          hist.map((h, i) => (
            <Box key={h.id} gap={1} flexDirection="row">
              {i === historyIdx ? <Text color={colors.primary}>{symbols.arrow}</Text> : <Text>  </Text>}
              <Text color={colors.dim}>[{new Date(h.timestamp).toLocaleString()}]</Text>
              <Text color={i === historyIdx ? colors.text : colors.muted} wrap="truncate-end">{h.message}</Text>
            </Box>
          ))
        )}
      </Box>
      <Box marginTop={1} gap={2}>
        <Text color={colors.dim}>[Enter/r] Restore to selected</Text>
        <Text color={colors.dim}>[Esc] Back</Text>
      </Box>
    </Box>
  );
}
