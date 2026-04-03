import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import { colors, symbols } from '../../theme.js';
import type { FieldDef } from './constants.js';

export function FieldEditor({
  field,
  currentValue,
  globalValue,
  onSave,
  onCancel,
  lang,
}: {
  field: FieldDef;
  currentValue: string;
  globalValue: string;
  onSave: (val: string) => void;
  onCancel: () => void;
  lang: 'zh' | 'en';
}) {
  const [textVal, setTextVal] = useState(currentValue);
  const [isCustom, setIsCustom] = useState(false);
  const [urlWarning, setUrlWarning] = useState(false);

  useInput((_input, key) => {
    if (key.escape) onCancel();
  });

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
          <Text color={colors.dim}>  [Enter] Save  [Esc] Cancel</Text>
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
          onSelect={(item) => {
            if (item.value === '__custom__') {
              setTextVal(currentValue);
              setIsCustom(true);
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
                <Text color={isSelected ? colors.text : colors.muted} italic={label.startsWith('+')}>{label}</Text>
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
        <TextInput value={textVal} onChange={(v) => { setTextVal(v); setUrlWarning(false); }} onSubmit={() => {
          let val = textVal.trim();
          if (field.key === 'base_url' && val && val.match(/^https?:\/\//) && !val.endsWith('/v1')) {
            val = val.replace(/\/+$/, '') + '/v1';
            setTextVal(val);
            setUrlWarning(true);
            return;
          }
          onSave(val);
        }} placeholder={globalValue || 'empty = use global'} />
      </Box>
      <Text color={colors.dim}>  [Enter] Save  [Esc] Cancel  (empty = use global value)</Text>
      {urlWarning && <Text color={colors.warning}>  ⚠️ 已自动补全 /v1 后缀，请再次按下 [Enter] 确认</Text>}
    </Box>
  );
}
