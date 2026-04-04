/**
 * 左侧 Profile 导航列表 -- 合并了 active（SelectInput）与 inactive（静态列表）两套渲染逻辑。
 */
import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { colors, symbols } from '../../theme.js';
import type { Profile } from '../../types.js';
import { RainbowText } from '../RainbowText.js';

interface Props {
  profiles: Profile[];
  selectedIdx: number;
  /** 左面板是否持有焦点 且 不在子模式中 */
  isActive: boolean;
  testResults: Record<string, 'ok' | 'fail' | 'running'>;
  testDurations: Record<string, number>;
  markedIds: Set<string>;
  addMode: boolean;
  deleteMode: boolean;
  onSelect: () => void;
  onHighlight: (idx: number) => void;
}

function ProfileItem({
  profile: p,
  isSelected,
  isMarked,
  testResult: res,
  duration,
}: {
  profile: Profile;
  isSelected: boolean;
  isMarked: boolean;
  testResult?: 'ok' | 'fail' | 'running';
  duration?: number;
}) {
  return (
    <Text wrap="truncate-end">
      <Text color={p.isDefault ? colors.warning : colors.dim}>{p.isDefault ? `${symbols.star} ` : '   '}</Text>
      <Text color={isMarked ? colors.danger : colors.dim}>{isMarked ? `[x] ` : ''}</Text>
      {isSelected && !isMarked ? (
        <RainbowText text={p.name} />
      ) : (
        <Text color={isMarked ? colors.danger : colors.muted} strikethrough={isMarked}>{p.name}</Text>
      )}
      <Text>
        {res === 'ok' ? <Text color={colors.success}>{` ${symbols.check}`}</Text> :
         res === 'fail' ? <Text color={colors.danger}>{` ${symbols.cross}`}</Text> :
         res === 'running' ? <Text color={colors.warning}>{` ${symbols.circle}`}</Text> :
         <Text>{''}</Text>}
      </Text>
      {(res === 'ok' || res === 'fail') && <Text color={colors.dim}> {duration ? `${(duration/1000).toFixed(1)}s` : ''}</Text>}
    </Text>
  );
}

export function ProfileNavList({
  profiles, selectedIdx, isActive,
  testResults, testDurations, markedIds,
  addMode, deleteMode,
  onSelect, onHighlight,
}: Props) {
  const listItems = profiles.map(p => ({ label: p.id, value: p.id }));

  if (profiles.length === 0) {
    return <Box flexDirection="column"><Text color={colors.dim}>[No profiles]</Text></Box>;
  }

  // Active 模式: SelectInput 接管焦点
  if (isActive) {
    return (
      <SelectInput
        items={listItems}
        onSelect={onSelect}
        onHighlight={(item: any) => {
          const idx = profiles.findIndex(p => p.id === item.value);
          if (idx >= 0) { queueMicrotask(() => onHighlight(idx)); }
        }}
        indicatorComponent={({ isSelected }: any) => (
          <Text color={isSelected ? colors.primary : colors.dim}>{isSelected ? `${symbols.arrow} ` : '  '}</Text>
        )}
        itemComponent={({ isSelected, label }: any) => {
          const p = profiles.find(pr => pr.id === label);
          if (!p) return <Text>{label}</Text>;
          return (
            <Box>
              <ProfileItem
                profile={p}
                isSelected={isSelected}
                isMarked={markedIds.has(p.id)}
                testResult={testResults[p.id]}
                duration={testDurations[p.id]}
              />
            </Box>
          );
        }}
      />
    );
  }

  // Inactive 模式: 静态列表
  return (
    <Box flexDirection="column">
      {profiles.map((p, i) => {
        const isSelected = i === selectedIdx && !addMode && !deleteMode;
        return (
          <Box key={p.id}>
            <Text color={isSelected ? colors.primary : colors.dim}>{isSelected ? `${symbols.arrow} ` : '  '}</Text>
            <ProfileItem
              profile={p}
              isSelected={isSelected}
              isMarked={markedIds.has(p.id)}
              testResult={testResults[p.id]}
              duration={testDurations[p.id]}
            />
          </Box>
        );
      })}
      {addMode && (
        <Box marginTop={1}>
          <Text>
            <Text color={colors.primary}>{`${symbols.arrow} `}</Text>
            <Text color={colors.dim}>{'  '}</Text>
            <Text color={colors.primary} italic>*(New)*</Text>
          </Text>
        </Box>
      )}
    </Box>
  );
}
