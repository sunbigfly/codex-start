import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import { colors, symbols } from '../../theme.js';
import type { FieldDef } from './constants.js';
import type { Profile } from '../../types.js';
import { request } from 'node:https';
import { request as httpRequest } from 'node:http';

export function FieldEditor({
  field,
  currentValue,
  globalValue,
  onSave,
  onCancel,
  lang,
  profile,
}: {
  field: FieldDef;
  currentValue: string;
  globalValue: string;
  onSave: (val: string) => void;
  onCancel: () => void;
  lang: 'zh' | 'en';
  profile?: Profile;
}) {
  const [textVal, setTextVal] = useState(currentValue);
  const [isCustom, setIsCustom] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[] | null>(null);
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  useInput((_input, key) => {
    if (key.escape) onCancel();
  });

  // 从 API 拉取模型列表
  const fetchModels = () => {
    if (!profile?.base_url || !profile?.api_key) {
      setFetchStatus('error');
      return;
    }
    setFetchStatus('loading');
    const baseUrl = profile.base_url.replace(/\/+$/, '');
    // 去掉 /v1 后缀重新拼接
    const modelsUrl = baseUrl.endsWith('/v1')
      ? `${baseUrl}/models`
      : `${baseUrl}/v1/models`;

    try {
      const url = new URL(modelsUrl);
      const reqFn = url.protocol === 'https:' ? request : httpRequest;
      const req = reqFn(modelsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${profile.api_key}`,
          'Content-Type': 'application/json',
        },
        timeout: 10_000,
      }, (res) => {
        let data = '';
        res.on('data', (chunk: any) => { data += chunk.toString(); });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const models = (json.data || json.models || [])
              .map((m: any) => m.id || m.name || '')
              .filter((x: string) => x)
              .sort();
            if (models.length > 0) {
              setFetchedModels(models);
              setFetchStatus('idle');
            } else {
              setFetchStatus('error');
            }
          } catch {
            setFetchStatus('error');
          }
        });
      });
      req.on('error', () => setFetchStatus('error'));
      req.on('timeout', () => { req.destroy(); setFetchStatus('error'); });
      req.end();
    } catch {
      setFetchStatus('error');
    }
  };

  if (field.type === 'combo') {
    if (isCustom) {
      return (
        <Box flexDirection="column" paddingLeft={2}>
          <Box gap={1} marginBottom={1}>
            <Text color={colors.accent} bold>{field.label}</Text>
            <Text color={colors.dim}>-- {lang === 'en' && field.descEn ? field.descEn : field.desc}</Text>
          </Box>
          {globalValue && <Text color={colors.placeholder}>  Global: {globalValue}</Text>}
          <Box gap={1}>
            <Text color={colors.primary}>{symbols.arrow}</Text>
            <TextInput value={textVal} onChange={setTextVal} onSubmit={() => { onSave(textVal); setIsCustom(false); }} placeholder="Custom value..." />
          </Box>
          <Box gap={2} flexWrap="wrap">
            <Text color={colors.dim}>[Enter] Save</Text>
            <Text color={colors.dim}>[Esc] Cancel</Text>
          </Box>
        </Box>
      );
    }

    // 如果有远程拉取的模型列表，使用它
    if (fetchedModels) {
      const items = [
        { label: '(not set) -- use global', value: '' },
        ...fetchedModels.map(m => ({ label: m, value: m })),
        { label: '+ Custom Input...', value: '__custom__' },
        { label: '<- Back to presets', value: '__back__' },
      ];
      return (
        <Box flexDirection="column" paddingLeft={2}>
          <Box gap={1} marginBottom={1}>
            <Text color={colors.accent} bold>{field.label}</Text>
            <Text color={colors.success}> (API Models: {fetchedModels.length})</Text>
          </Box>
          {globalValue && <Text color={colors.placeholder}>  Global: {globalValue}</Text>}
          <SelectInput
            items={items}
            initialIndex={Math.max(0, items.findIndex((i) => i.value === currentValue))}
            onSelect={(item) => {
              if (item.value === '__custom__') { setTextVal(currentValue); setIsCustom(true); }
              else if (item.value === '__back__') { setFetchedModels(null); }
              else { onSave(String(item.value)); }
            }}
            indicatorComponent={({ isSelected }) => (<Text color={isSelected ? colors.primary : colors.dim}>{isSelected ? symbols.arrow : ' '} </Text>)}
            itemComponent={({ isSelected, label }) => {
              const isActive = items.find((i) => i.label === label)?.value === currentValue;
              return (
                <Box gap={1}>
                  {isActive && <Text color={colors.success}>{symbols.check}</Text>}
                  <Text color={isSelected ? colors.text : colors.muted} italic={label.startsWith('+') || label.startsWith('<')}>{label}</Text>
                </Box>
              );
            }}
          />
        </Box>
      );
    }

    const standardOpts = new Set(field.options || []);
    let customItems: { label: string, value: string }[] = [];
    if (currentValue && !standardOpts.has(currentValue)) {
       customItems.push({ label: `${currentValue} (Current)`, value: currentValue });
    }

    const items = [
      { label: '(not set) -- use global', value: '' },
      ...(field.options || []).map((o: string) => ({ label: o, value: o })),
      ...customItems,
      { label: '+ Custom Input...', value: '__custom__' },
      { label: '~ Fetch from API...', value: '__fetch__' },
    ];

    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Box gap={1} marginBottom={1}>
          <Text color={colors.accent} bold>{field.label}</Text>
          <Text color={colors.dim}>-- {lang === 'en' && field.descEn ? field.descEn : field.desc}</Text>
        </Box>
        {globalValue && <Text color={colors.placeholder}>  Global: {globalValue}</Text>}
        {fetchStatus === 'loading' && <Text color={colors.warning}>  Fetching models from API...</Text>}
        {fetchStatus === 'error' && <Text color={colors.danger}>  Failed to fetch models (check base_url & api_key)</Text>}
        <SelectInput
          items={items}
          initialIndex={Math.max(0, items.findIndex((i) => i.value === currentValue))}
          onSelect={(item) => {
            if (item.value === '__custom__') {
              setTextVal(currentValue);
              setIsCustom(true);
            } else if (item.value === '__fetch__') {
              fetchModels();
            } else {
              onSave(String(item.value));
            }
          }}
          indicatorComponent={({ isSelected }) => (<Text color={isSelected ? colors.primary : colors.dim}>{isSelected ? symbols.arrow : ' '} </Text>)}
          itemComponent={({ isSelected, label }) => {
            const isActive = items.find((i) => i.label === label)?.value === currentValue;
            return (
              <Box gap={1}>
                {isActive && <Text color={colors.success}>{symbols.check}</Text>}
                <Text color={isSelected ? colors.text : colors.muted} italic={label.startsWith('+') || label.startsWith('~')}>{label}</Text>
              </Box>
            );
          }}
        />
      </Box>
    );
  }

  if (field.type === 'bool') {
    const items = [
      { label: '(not set) -- use global', value: '' },
      { label: 'true', value: 'true' },
      { label: 'false', value: 'false' },
    ];
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Box gap={1} marginBottom={1}>
          <Text color={colors.accent} bold>{field.label}</Text>
          <Text color={colors.dim}>-- {lang === 'en' && field.descEn ? field.descEn : field.desc}</Text>
        </Box>
        {globalValue && <Text color={colors.placeholder}>  Global: {globalValue}</Text>}
        <SelectInput
          items={items}
          initialIndex={Math.max(0, items.findIndex((i) => i.value === currentValue))}
          onSelect={(item) => onSave(String(item.value))}
          indicatorComponent={({ isSelected }) => (<Text color={isSelected ? colors.primary : colors.dim}>{isSelected ? symbols.arrow : ' '} </Text>)}
          itemComponent={({ isSelected, label }) => (<Text color={isSelected ? colors.text : colors.muted}>{label}</Text>)}
        />
      </Box>
    );
  }

  if (field.type === 'select') {
    const items = [
      { label: '(not set) -- use global', value: '' },
      ...(field.options || []).map((o: string) => ({ label: o, value: o })),
    ];
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Box gap={1} marginBottom={1}>
          <Text color={colors.accent} bold>{field.label}</Text>
          <Text color={colors.dim}>-- {lang === 'en' && field.descEn ? field.descEn : field.desc}</Text>
        </Box>
        {globalValue && <Text color={colors.placeholder}>  Global: {globalValue}</Text>}
        <SelectInput
          items={items}
          initialIndex={Math.max(0, items.findIndex((i) => i.value === currentValue))}
          onSelect={(item) => onSave(String(item.value))}
          indicatorComponent={({ isSelected }) => (<Text color={isSelected ? colors.primary : colors.dim}>{isSelected ? symbols.arrow : ' '} </Text>)}
          itemComponent={({ isSelected, label }) => {
            const isActive = items.find((i) => i.label === label)?.value === currentValue;
            return (
              <Box gap={1}>
                {isActive && <Text color={colors.success}>{symbols.check}</Text>}
                <Text color={isSelected ? colors.text : colors.muted}>{label}</Text>
              </Box>
            );
          }}
        />
      </Box>
    );
  }

  // text
  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Box gap={1} marginBottom={1}>
        <Text color={colors.accent} bold>{field.label}</Text>
        <Text color={colors.dim}>-- {lang === 'en' && field.descEn ? field.descEn : field.desc}</Text>
      </Box>
      {globalValue && <Text color={colors.placeholder}>  Global: {globalValue}</Text>}
      <Box gap={1}>
        <Text color={colors.primary}>{symbols.arrow}</Text>
        <TextInput value={textVal} onChange={setTextVal} onSubmit={() => {
          let val = textVal.trim();
          if (field.key === 'base_url' && val && val.match(/^https?:\/\//) && !val.endsWith('/v1')) {
            val = val.replace(/\/+$/, '') + '/v1';
            setTextVal(val);
          }
          onSave(val);
        }} placeholder={globalValue || 'empty = use global'} />
      </Box>
      <Box gap={2} flexWrap="wrap">
        <Text color={colors.dim}>[Enter] Save</Text>
        <Text color={colors.dim}>[Esc] Cancel</Text>
        <Text color={colors.dim}>(empty = use global value)</Text>
      </Box>
    </Box>
  );
}
