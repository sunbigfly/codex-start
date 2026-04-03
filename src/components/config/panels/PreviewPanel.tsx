import React from 'react';
import { Box, Text, useInput } from 'ink';
import { colors, symbols } from '../../../theme.js';
import type { Profile } from '../../../types.js';

interface Props {
  profile: Profile;
  globalConfig: Record<string, any>;
  onClose: () => void;
}

export function PreviewPanel({ profile, globalConfig, onClose }: Props) {
  useInput((_input: string, key: any) => {
    if (key.escape) onClose();
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
  const renderEntry = (key: string, val: any, depth = 0): React.ReactNode[] => {
    const indent = '  '.repeat(depth);
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      return [
        <Text key={`${key}-h`} color={colors.muted}>{indent}[{key}]</Text>,
        ...Object.entries(val).flatMap(([k, v]) => renderEntry(k, v, depth + 1)),
      ];
    }
    const isOverridden = optionals.some(([k]) => k === key && (profile as any)[k]);
    return [
      <Box key={key} gap={1}>
        <Text color={colors.dim}>{indent}</Text>
        <Text color={isOverridden ? colors.secondary : colors.muted}>{key}</Text>
        <Text color={colors.dim}>=</Text>
        <Text color={isOverridden ? colors.primary : colors.text}>{String(val)}</Text>
        {isOverridden && <Text color={colors.warning} italic> (override)</Text>}
      </Box>
    ];
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Text color={colors.accent} bold>{symbols.dot} Config Preview: {profile.name}</Text>
      <Box marginTop={1} flexDirection="column">
        {Object.entries(preview).flatMap(([k, v]) => renderEntry(k, v))}
      </Box>
      <Box marginTop={1}><Text color={colors.dim}>[Esc] Back</Text></Box>
    </Box>
  );
}
