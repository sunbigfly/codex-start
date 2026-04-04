import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors, symbols } from '../../../theme.js';
import type { Profile } from '../../../types.js';

interface Props {
  profile: Profile;
  globalConfig: Record<string, any>;
  onClose: () => void;
  onNextProfile?: (dir: 1 | -1) => void;
}

export function PreviewPanel({ profile, globalConfig, onClose, onNextProfile }: Props) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setOffset(0);
  }, [profile.id]);

  const termH = process.stdout.rows || 24;
  const pageSize = Math.max(12, termH - 10);

  useInput((input: string, key: any) => {
    if (key.escape) onClose();
    if (key.upArrow) setOffset(v => Math.max(0, v - 1));
    if (key.downArrow) setOffset(v => v + 1);
    
    const lcInput = input.toLowerCase();
    // Page up / Page down
    if (key.pageDown || lcInput === 'f' || input === ' ') setOffset(v => v + pageSize);
    if (key.pageUp || lcInput === 'b') setOffset(v => Math.max(0, v - pageSize));
    
    // Top / Bottom
    if (input === 'g') setOffset(0);
    if (input === 'G') setOffset(9999); // maxOffset clamped later

    if (key.tab && onNextProfile) {
      if (key.shift || (key as any).shiftTab) onNextProfile(-1);
      else onNextProfile(1);
    }
  });

  // 模拟计算注入后的 config 快照
  const preview: Record<string, any> = { ...globalConfig };
  preview.model_provider = 'custom';
  if (!preview.model_providers) preview.model_providers = {};
  preview.model_providers.custom = {
    name: 'custom',
    base_url: profile.base_url,
    wire_api: profile.wire_api || 'responses',
    requires_openai_auth: true,
  };

  const optionals: [string, string][] = [
    ['model', profile.model],
    ['model_reasoning_effort', profile.model_reasoning_effort],
    ['personality', profile.personality],
    ['model_reasoning_summary', profile.model_reasoning_summary],
    ['service_tier', profile.service_tier],
    ['approval_policy', profile.approval_policy],
    ['sandbox_mode', profile.sandbox_mode],
    ['web_search', profile.web_search],
  ];
  for (const [key, val] of optionals) {
    if (val) preview[key] = val;
  }
  if (profile.disable_response_storage === 'true') preview.disable_response_storage = true;
  else if (profile.disable_response_storage === 'false') preview.disable_response_storage = false;

  // 渲染为 key=value 对，高亮被 profile 覆盖的
  const renderEntry = (key: string, val: any, depth = 0, path = ''): React.ReactNode[] => {
    const indent = '  '.repeat(depth);
    const currPath = path ? `${path}.${key}` : key;
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      return [
        <Text key={`${currPath}-h`} color={colors.muted}>{indent}[{key}]</Text>,
        ...Object.entries(val).flatMap(([k, v]) => renderEntry(k, v, depth + 1, currPath)),
      ];
    }
    const isOverridden = optionals.some(([k]) => k === key && (profile as any)[k]);
    return [
      <Box key={`${currPath}-val`}>
        <Text color={isOverridden ? colors.secondary : colors.muted}>{indent}{key}</Text>
        <Text color={colors.dim}> = </Text>
        <Text color={isOverridden ? colors.primary : colors.text}>{String(val)}</Text>
        {isOverridden && <Text color={colors.warning} italic> (override)</Text>}
      </Box>
    ];
  };

  const allLines = Object.entries(preview).flatMap(([k, v]) => renderEntry(k, v));
  // termH and pageSize moved up
  const maxOffset = Math.max(0, allLines.length - pageSize);
  const clampedOffset = Math.min(offset, maxOffset);
  const visibleLines = allLines.slice(clampedOffset, clampedOffset + pageSize);

  return (
    <Box flexDirection="column" padding={0}>
      <Text color={colors.accent} bold>{symbols.dot} Config Preview: {profile.name}</Text>
      <Box marginTop={1} flexDirection="column" minHeight={pageSize}>
        {visibleLines}
      </Box>
      <Box marginTop={1}>
        <Text color={colors.dim}>[Esc] Back  </Text>
        <Text color={colors.dim}>[Tab] Switch  </Text>
        {allLines.length > pageSize && (
          <Text color={colors.muted}>[{clampedOffset + 1}-{Math.min(clampedOffset + pageSize, allLines.length)} / {allLines.length}] (↑/↓:Line  Space/b:Page  g/G:Top/Bot)</Text>
        )}
      </Box>
    </Box>
  );
}
