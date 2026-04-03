import React from 'react';
import { Box, Text } from 'ink';
import { colors, symbols } from '../../theme.js';
import type { Profile } from '../../types.js';
import { OVERRIDE_FIELDS, TABS, getGlobalVal } from './constants.js';
import { maskApiKey } from '../../utils.js';

export function OverridesPanel({
  profile,
  activeFieldIdx,
  focusState,
  globalConfig,
  lang,
}: {
  profile: Profile;
  activeFieldIdx: number | null;
  focusState: 'left' | 'right' | 'edit';
  globalConfig: Record<string, any>;
  lang: 'zh' | 'en';
}) {
  const currentIdx = activeFieldIdx ?? 0;
  const currentField = OVERRIDE_FIELDS[currentIdx];
  const currentTab = TABS.find((t) => t.id === currentField?.group) || TABS[0];
  
  // Viewport setup (showing 8 items at a time)
  const SHOW_COUNT = 8;
  let startIdx = 0;
  if (OVERRIDE_FIELDS.length > SHOW_COUNT) {
    if (currentIdx < 4) {
      startIdx = 0;
    } else if (currentIdx > OVERRIDE_FIELDS.length - 5) {
      startIdx = OVERRIDE_FIELDS.length - SHOW_COUNT;
    } else {
      startIdx = currentIdx - 3;
    }
  }
  const visibleFields = OVERRIDE_FIELDS.slice(startIdx, startIdx + SHOW_COUNT);

  // 动态防御与弹性排版: 精确计算所有的终端边框与内边距，确保分配给栅格的物理列数与剩余空间 100% 一致。
  const termW = process.stdout.columns || 100;
  const innerW = termW - 2; // 外层 round 边框(左+右=2)
  const leftPanelW = Math.max(14, Math.floor(innerW * 0.10)); // 左侧边栏 10% 最小 14
  const rightContainerW = innerW - leftPanelW; // 右侧大容器
  
  // 减去所有逐层 padding 消耗:
  // 1. Right Detail 容器: paddingLeft=2, paddingRight=1 (共计 3)
  // 2. OverridesPanel 表格区域: paddingX=1 (共计 2)
  // 总损耗 = 5
  const finalRowW = rightContainerW - 5;
  const safeSpace = Math.max(40, finalRowW);

  const W_KEY = Math.min(32, Math.floor(safeSpace * 0.28));
  const W_VAL = Math.floor(safeSpace * 0.32);
  const W_GLO = Math.floor(safeSpace * 0.15);
  const W_DESC = Math.max(10, safeSpace - W_KEY - W_VAL - W_GLO);

  return (
    <Box flexDirection="column" width="100%">
      {/* 履带视口的面包屑 */}
      <Box marginBottom={1} gap={1} justifyContent="space-between">
        <Box gap={1}>
          <Text color={colors.dim}>[{profile.name}]</Text>
          <Text color={colors.dim}>{'»'}</Text>
          <Text color={colors.accent} bold>{currentTab.title}</Text>
          <Text color={colors.dim}> ({currentIdx + 1}/{OVERRIDE_FIELDS.length})</Text>
        </Box>
        <Text color={colors.dim}>{startIdx > 0 ? '↑ ' : '  '} {startIdx + SHOW_COUNT < OVERRIDE_FIELDS.length ? '↓' : ' '}</Text>
      </Box>

      {/* 解放边框：极致呼吸感的悬浮态渲染 */}
      <Box flexDirection="column" paddingX={1} paddingY={0}>

        {/* 表头 */}
        <Box flexDirection="row" width="100%" alignItems="stretch" borderStyle="single" borderTop={false} borderLeft={false} borderRight={false} borderColor={colors.darkBorder} paddingBottom={1} marginBottom={1}>
          <Box width={W_KEY} flexShrink={0}><Text color={colors.heading} bold>配置键名称</Text></Box>
          <Box width={W_VAL} flexShrink={0}><Text color={colors.heading} bold>专属覆盖值</Text></Box>
          <Box width={W_GLO} flexShrink={0}><Text color={colors.heading} bold>回落全局值</Text></Box>
          <Box width={W_DESC} flexShrink={0}><Text color={colors.heading} bold wrap="truncate-end">含义说明</Text></Box>
        </Box>

        {/* 字段列表列表 */}
        <Box flexDirection="column" paddingTop={1} minHeight={20}>
          {visibleFields.map((f) => {
            const idx = OVERRIDE_FIELDS.indexOf(f);
            let val = (profile as any)[f.key] || '';
            let globalVal = getGlobalVal(globalConfig, f);
            if (f.group === 'cfg_profile') globalVal = ''; // Profile settings have no globals
            const isActive = focusState === 'right' && activeFieldIdx === idx;
            
            const isGroupStart = idx === 0 || OVERRIDE_FIELDS[idx - 1].group !== f.group;
            const groupTitle = TABS.find((t) => t.id === f.group)?.title || f.group || '';
            const isCLI = groupTitle.startsWith('CLI:');

            return (
              <Box key={f.key} flexDirection="column">
                {isGroupStart && (
                  <Box flexDirection="row" marginTop={idx === 0 ? 0 : 1} marginBottom={1}>
                    <Text backgroundColor={isCLI ? colors.warning : colors.primary} color="#11111b" bold>
                      {` ${groupTitle} `}
                    </Text>
                    {isCLI && <Text color={colors.warning} italic>  [运行时非持久化参数] </Text>}
                  </Box>
                )}
                <Box flexDirection="row" width="100%" alignItems="flex-start" paddingX={0}>
                  {/* 参数名列 */}
                  <Box width={W_KEY} flexShrink={0} paddingRight={1}>
                    <Box width={2} flexShrink={0}>
                      <Text color={isActive ? colors.primary : colors.dim} bold={isActive}>
                        {isActive ? symbols.arrow : ' '}
                      </Text>
                    </Box>
                    <Text color={isActive ? colors.primary : colors.text} bold={isActive} wrap="truncate-end">
                      {f.label}
                    </Text>
                  </Box>
                  {/* 本地值列 */}
                  <Box width={W_VAL} flexShrink={0} paddingRight={1}>
                    <Text color={val ? colors.secondary : colors.dim} bold={!!val && isActive} wrap="truncate-end">
                      {val ? val : '(not set) '}
                    </Text>
                  </Box>
                  {/* 全局值列 */}
                  <Box width={W_GLO} flexShrink={0} paddingRight={1}>
                    <Text color={isActive ? colors.muted : colors.dim} wrap="truncate-end">
                      {globalVal ? globalVal : ' '}
                    </Text>
                  </Box>
                  {/* 描述列 */}
                  <Box width={W_DESC} flexShrink={0}>
                    <Text key={String(isActive)} color={isActive ? colors.text : colors.dim} italic wrap={isActive ? "wrap" : "truncate-end"}>
                      {lang === 'en' && f.descEn ? f.descEn : f.desc}
                    </Text>
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
