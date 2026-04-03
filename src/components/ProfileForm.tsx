import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import { colors, symbols } from '../theme.js';
import type { Profile } from '../types.js';
import { DEFAULT_PROFILE_EXTRAS } from '../types.js';

interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  defaultValue: string;
  mask?: boolean;
  required?: boolean;
  hint?: string;
  type?: 'text' | 'select';
  options?: string[];
  section: 'required' | 'optional' | 'profile';
}

const FIELDS: FieldDef[] = [
  // ---- Required ----
  { key: 'base_url', label: 'API Base URL', placeholder: 'https://api.openai.com/v1', defaultValue: '', required: true, hint: 'e.g. https://api.deepseek.com/v1', section: 'required' },
  { key: 'api_key', label: 'API Key', placeholder: 'sk-...', defaultValue: '', mask: true, required: true, hint: 'Your API authentication key', section: 'required' },
  // ---- Optional API ----
  { key: 'name', label: 'Profile Name', placeholder: 'auto from URL', defaultValue: '', hint: 'Leave empty to auto-generate', section: 'optional' },
  { key: 'model', label: 'Model', placeholder: 'o3', defaultValue: 'o3', hint: 'Default: o3', section: 'optional' },
  { key: 'model_reasoning_effort', label: 'Reasoning Effort', placeholder: 'high', defaultValue: 'high', type: 'select', options: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'], hint: 'Reasoning depth', section: 'optional' },
  { key: 'wire_api', label: 'Wire API', placeholder: 'responses', defaultValue: 'responses', type: 'select', options: ['responses'], hint: 'Wire protocol', section: 'optional' },
  // ---- Profile-level settings ----
  { key: 'personality', label: 'Personality', placeholder: 'friendly', defaultValue: DEFAULT_PROFILE_EXTRAS.personality, type: 'select', options: ['none', 'friendly', 'pragmatic'], hint: 'Agent personality style', section: 'profile' },
  { key: 'model_reasoning_summary', label: 'Reasoning Summary', placeholder: 'auto', defaultValue: DEFAULT_PROFILE_EXTRAS.model_reasoning_summary, type: 'select', options: ['auto', 'concise', 'detailed', 'none'], hint: 'Reasoning output format', section: 'profile' },
  { key: 'service_tier', label: 'Service Tier', placeholder: 'fast', defaultValue: DEFAULT_PROFILE_EXTRAS.service_tier, type: 'select', options: ['fast', 'flex'], hint: 'fast = priority, flex = cheaper', section: 'profile' },
  { key: 'disable_response_storage', label: 'Disable Storage', placeholder: 'yes', defaultValue: 'yes', type: 'select', options: ['yes', 'no'], hint: 'Disable server-side response storage', section: 'profile' },
];

function deriveNameFromUrl(url: string): string {
  try {
    const parts = new URL(url).hostname.split('.');
    const skip = new Set(['www', 'api', 'com', 'org', 'io', 'net', 'ai', 'dev', 'co']);
    const meaningful = parts.filter((p) => !skip.has(p));
    if (meaningful.length > 0) return meaningful.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
    return parts.join('.');
  } catch { return url.slice(0, 20); }
}

interface Props {
  initial?: Partial<Profile>;
  title: string;
  onSave: (data: Record<string, string>) => void;
  onCancel: () => void;
}

export function ProfileForm({ initial, title, onSave, onCancel }: Props) {
  const [focusIndex, setFocusIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const f of FIELDS) {
      const init = (initial as any)?.[f.key];
      if (typeof init === 'boolean') v[f.key] = init ? 'yes' : 'no';
      else v[f.key] = init ?? '';
    }
    return v;
  });
  const [error, setError] = useState('');

  const currentField = FIELDS[focusIndex];
  const requiredDone = FIELDS.filter((f) => f.required).every((f) => values[f.key]);

  const validate = (): string | null => {
    if (!values.base_url) return 'API Base URL is required';
    try { new URL(values.base_url); } catch { return 'Invalid URL format'; }
    if (!values.api_key) return 'API Key is required';
    return null;
  };

  function handleSubmit() {
    const err = validate();
    if (err) { setError(err); setFocusIndex(err.includes('URL') ? 0 : 1); return; }
    const result: Record<string, string> = {};
    for (const f of FIELDS) result[f.key] = values[f.key] || f.defaultValue;
    if (!result.name) result.name = deriveNameFromUrl(result.base_url);
    onSave(result);
  }

  useInput((_input, key) => {
    if (key.escape) { onCancel(); return; }
    if (currentField.type === 'select') return;
    if (key.upArrow) { setError(''); setFocusIndex((i) => (i > 0 ? i - 1 : FIELDS.length - 1)); }
    if (key.downArrow) { setError(''); setFocusIndex((i) => (i < FIELDS.length - 1 ? i + 1 : 0)); }
  });

  function handleFieldSubmit() {
    if (focusIndex < FIELDS.length - 1) { setError(''); setFocusIndex(focusIndex + 1); }
    else handleSubmit();
  }

  const LABEL_W = 20;

  function renderField(f: FieldDef) {
    const idx = FIELDS.indexOf(f);
    const focused = idx === focusIndex;
    return (
      <Box key={f.key}>
        <Text color={colors.dim}>{symbols.pipe}</Text>
        <Text color={focused ? colors.primary : colors.dim}>{focused ? ' ' + symbols.arrow : '  '}</Text>
        <Text color={focused ? colors.text : colors.muted}>{' ' + f.label.padEnd(LABEL_W)}</Text>
        {focused ? (
          f.type === 'select' ? (
            <SelectInput
              items={(f.options || []).map((o) => ({ label: o, value: o }))}
              initialIndex={Math.max(0, (f.options || []).indexOf(values[f.key] || f.defaultValue))}
              onSelect={(item) => { setValues({ ...values, [f.key]: item.value }); handleFieldSubmit(); }}
              indicatorComponent={({ isSelected }) => (<Text color={isSelected ? colors.secondary : colors.dim}>{isSelected ? symbols.arrow : ' '}</Text>)}
              itemComponent={({ isSelected, label }) => (<Text color={isSelected ? colors.text : colors.muted}> {label}</Text>)}
            />
          ) : (
            <TextInput
              value={values[f.key]}
              onChange={(v) => setValues({ ...values, [f.key]: v })}
              onSubmit={handleFieldSubmit}
              placeholder={f.placeholder}
              mask={f.mask ? '*' : undefined}
            />
          )
        ) : (
          <Text color={values[f.key] ? colors.secondary : colors.placeholder}>
            {f.mask && values[f.key] ? '*'.repeat(Math.min(values[f.key].length, 20)) : values[f.key] || f.defaultValue || f.placeholder}
          </Text>
        )}
      </Box>
    );
  }

  const sections: { key: string; label: string; color: string; fields: FieldDef[] }[] = [
    { key: 'required', label: `${symbols.required} Required`, color: colors.required, fields: FIELDS.filter((f) => f.section === 'required') },
    { key: 'optional', label: `${symbols.circle} API Options`, color: colors.dim, fields: FIELDS.filter((f) => f.section === 'optional') },
    { key: 'profile', label: `${symbols.circle} Per-Profile Settings`, color: colors.accent, fields: FIELDS.filter((f) => f.section === 'profile') },
  ];

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Box marginBottom={1}><Text color={colors.accent} bold>{symbols.dot} {title}</Text></Box>
      <Text color={colors.dim}>{symbols.corner_tl}{symbols.line.repeat(56)}{symbols.corner_tr}</Text>

      {sections.map((sec, si) => (
        <React.Fragment key={sec.key}>
          {si > 0 && <Text color={colors.dim}>{symbols.pipe}{symbols.dash.repeat(56)}{symbols.pipe}</Text>}
          <Box><Text color={colors.dim}>{symbols.pipe}</Text><Text color={sec.color} bold> {sec.label}</Text></Box>
          {sec.fields.map(renderField)}
        </React.Fragment>
      ))}

      <Text color={colors.dim}>{symbols.corner_bl}{symbols.line.repeat(56)}{symbols.corner_br}</Text>

      <Box paddingLeft={2}><Text color={colors.dim} italic>{currentField.hint}</Text></Box>
      {error && <Box paddingLeft={2}><Text color={colors.danger} bold>{symbols.cross} {error}</Text></Box>}
      <Box paddingLeft={1} marginTop={1} gap={2}>
        <Text color={requiredDone ? colors.success : colors.warning}>{requiredDone ? symbols.check + ' Ready' : symbols.circle + ' Fill required'}</Text>
        <Text color={colors.dim}>{symbols.pipe} [Up/Down] Navigate  [Enter] Next/Save  [Esc] Cancel</Text>
      </Box>
    </Box>
  );
}
