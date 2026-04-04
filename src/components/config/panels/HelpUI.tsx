import React from 'react';
import { Box, Text, useInput } from 'ink';
import { colors, symbols } from '../../../theme.js';
import { HeaderLogo } from '../../HeaderLogo.js';

interface Props {
  onClose: () => void;
  themeName?: string;
  uiMode: 'list' | 'config-left' | 'config-right' | 'test' | 'history';
}

export function HelpUI({ onClose, themeName = 'mocha', uiMode }: Props) {
  useInput((input, key) => {
    if (key.escape || input === '?' || input === '？' || input.toLowerCase() === 'q') {
      onClose();
    }
  });

  const SECTION_WIDTH = 48; // 保证宽屏横排时内容不溢出

  return (
    <Box flexDirection="column" padding={1} width="100%">
      <HeaderLogo themeName={themeName} />
      <Box marginBottom={1} marginTop={1}>
        <Text color={colors.accent} bold>{symbols.dot} 选项说明与使用指南 (Help & Manual)</Text>
      </Box>

      {/* 核心容器：复用父 UI 经典的无上边双栏 Round 架构 */}
      <Box borderStyle="round" borderColor={colors.dim} flexDirection="row" width="100%">
        
        {/* 左栏导航区：展示通用快捷键 */}
        <Box flexDirection="column" width="50%" borderStyle="single" borderTop={false} borderBottom={false} borderLeft={false} borderColor={colors.dim} padding={1} paddingRight={2}>
          <Text color={colors.muted} bold> 通用快捷键 (Global Keys)</Text>
          <Box marginTop={1} flexDirection="column" gap={0}>
            <Text><Text color={colors.primary} bold>{'[Esc] Exit'.padEnd(16)}</Text><Text color={colors.dim}>返回上一级 / 取消当前操作</Text></Text>
            <Text><Text color={colors.primary} bold>{'[?] Help'.padEnd(16)}</Text><Text color={colors.dim}>打开 / 关闭帮助说明</Text></Text>
            <Text><Text color={colors.primary} bold>{'[Space] Default'.padEnd(16)}</Text><Text color={colors.dim}>将当前选中的配置设为默认启动项</Text></Text>
            <Text><Text color={colors.primary} bold>{'[w] Theme'.padEnd(16)}</Text><Text color={colors.dim}>切换界面色彩主题</Text></Text>
            {uiMode !== 'list' && <Text><Text color={colors.primary} bold>{'[l] Lang'.padEnd(16)}</Text><Text color={colors.dim}>切换界面注释的中/英显示</Text></Text>}
          </Box>
        </Box>

        {/* 右侧解释区：展示当前上下文特定的操作说明 */}
        <Box flexDirection="column" width="50%" padding={1} paddingLeft={2}>

          {uiMode === 'list' && (
            <Box flexDirection="column" width="100%">
              <Box marginBottom={1}>
                <Text color={colors.warning} bold>列表运行界面 (List UI)</Text>
              </Box>
              <Box flexDirection="column" gap={0}>
                <Text><Text color={colors.secondary} bold>{'[Enter] Launch'.padEnd(18)}</Text><Text color={colors.muted}>使用当前选中的配置启动 Codex</Text></Text>
                <Text><Text color={colors.secondary} bold>{'[/] Search'.padEnd(18)}</Text><Text color={colors.muted}>呼出搜索框，按名称过滤配置项</Text></Text>
                <Text><Text color={colors.secondary} bold>{'[a] Add'.padEnd(18)}</Text><Text color={colors.muted}>新建一份全新配置</Text></Text>
                <Text><Text color={colors.secondary} bold>{'[e] Edit'.padEnd(18)}</Text><Text color={colors.muted}>编辑选中配置的具体参数</Text></Text>
                <Text><Text color={colors.secondary} bold>{'[t] Test'.padEnd(18)}</Text><Text color={colors.muted}>测试各个配置连接 API 的延迟</Text></Text>
              </Box>
            </Box>
          )}

          {uiMode === 'test' && (
            <Box flexDirection="column" width="100%">
              <Box borderStyle="single" borderTop={false} borderRight={false} borderLeft={false} borderBottom={true} borderColor={colors.dim} paddingBottom={0} marginBottom={1}>
                <Text color={colors.accent} bold>测试与延迟探针 (Test UI)</Text>
              </Box>
              <Box flexDirection="column" gap={0}>
                <Text><Text color={colors.secondary} bold>{'[Enter] Test'.padEnd(18)}</Text><Text color={colors.muted}>确认启动测试（单项测试或批量并发测试）</Text></Text>
                <Text><Text color={colors.secondary} bold>{'[b] Mode'.padEnd(18)}</Text><Text color={colors.muted}>在单项测试 (Single) 与批量测试 (Batch) 间切换</Text></Text>
                <Text><Text color={colors.secondary} bold>{'[u]/[i] Strategy'.padEnd(18)}</Text><Text color={colors.muted}>批量测试策略：[u] 统一覆盖模型，[i] 保持各配置原生模型</Text></Text>
                <Text><Text color={colors.secondary} bold>{'[Space] Select'.padEnd(18)}</Text><Text color={colors.muted}>批量模式下，勾选或取消勾选该配置项</Text></Text>
                <Text><Text color={colors.secondary} bold>{'[a] Toggle All'.padEnd(18)}</Text><Text color={colors.muted}>批量模式下，一键全选或一键取消全选</Text></Text>
              </Box>
            </Box>
          )}

          {uiMode === 'history' && (
            <Box flexDirection="column" width="100%">
              <Box borderStyle="single" borderTop={false} borderRight={false} borderLeft={false} borderBottom={true} borderColor={colors.dim} paddingBottom={0} marginBottom={1}>
                <Text color={colors.accent} bold>历史防灾面板 (History UI)</Text>
              </Box>
              <Box flexDirection="column" gap={0}>
                <Text><Text color={colors.secondary} bold>{'[Enter]/[r] Restore'.padEnd(20)}</Text><Text color={colors.muted}>强制将配置回滚到此时刻的记录点快照</Text></Text>
                <Text><Text color={colors.secondary} bold>{'[d]/[Del] Delete'.padEnd(20)}</Text><Text color={colors.muted}>彻底删除你当前光标所指向的这单条记录点</Text></Text>
                <Text><Text color={colors.secondary} bold>{'[c] Clear All'.padEnd(20)}</Text><Text color={colors.muted}>一键清空整个历史操作记录池</Text></Text>
                <Text><Text color={colors.secondary} bold>{'[g] Scope'.padEnd(20)}</Text><Text color={colors.muted}>切换浏览“全局记录(Global)”与“单项记录(Profile)”</Text></Text>
              </Box>
            </Box>
          )}

          {uiMode === 'config-left' && (
            <Box flexDirection="column" width="100%">
              <Box marginBottom={1}>
                <Text color={colors.accent} bold>配置面板焦点 (Configs Left)</Text>
              </Box>
              <Box flexDirection="column" gap={0}>
                <Text><Text color={colors.secondary} bold>{'[Tab/\u2192] Edit'.padEnd(18)}</Text><Text color={colors.muted}>切换到右侧，编辑该配置的具体参数</Text></Text>
                <Text><Text color={colors.secondary} bold>{'[j]/[k] Move'.padEnd(18)}</Text><Text color={colors.muted}>向下 [j] / 向上 [k] 调整本项的排列顺序</Text></Text>
                <Text><Text color={colors.secondary} bold>{'[c] Clone'.padEnd(18)}</Text><Text color={colors.muted}>复制当前选中的配置</Text></Text>
                <Text><Text color={colors.secondary} bold>{'[d] Delete'.padEnd(18)}</Text><Text color={colors.muted}>删除当前选中或已标记的配置</Text></Text>
                <Text><Text color={colors.secondary} bold>{'[m] Mark'.padEnd(18)}</Text><Text color={colors.muted}>多选标记配置项</Text></Text>
                <Text><Text color={colors.secondary} bold>{'[g] Global Sync'.padEnd(18)}</Text><Text color={colors.muted}>将此配置设定覆盖至系统全局默认</Text></Text>
                <Text><Text color={colors.secondary} bold>{'[h] History'.padEnd(18)}</Text><Text color={colors.muted}>打开防灾保存的历史变动记录</Text></Text>
                <Text><Text color={colors.secondary} bold>{'[i] Import'.padEnd(18)}</Text><Text color={colors.muted}>拉取第三方 JSON 配置数据导入本系统</Text></Text>
                <Text><Text color={colors.secondary} bold>{'[x] Export'.padEnd(18)}</Text><Text color={colors.muted}>将全部配置池导出打包 JSON</Text></Text>
              </Box>
            </Box>
          )}

          {uiMode === 'config-right' && (
            <Box flexDirection="column" width="100%">
              <Box marginBottom={1}>
                <Text color={colors.accent} bold>参数重写编辑视图 (Configs Right)</Text>
              </Box>
              <Box flexDirection="column" gap={0}>
                <Text><Text color={colors.secondary} bold>{'[Enter] Edit'.padEnd(18)}</Text><Text color={colors.muted}>修改选中参数的值（回车保存，Esc取消）</Text></Text>
                <Text><Text color={colors.secondary} bold>{'[Tab] Jump'.padEnd(18)}</Text><Text color={colors.muted}>快速切换焦点到下一个参数类别组（如 Model 等）</Text></Text>
                <Text><Text color={colors.secondary} bold>{'[s] Sync Row'.padEnd(18)}</Text><Text color={colors.muted}>仅将光标所在的这一行参数设为系统全局默认</Text></Text>
                <Text><Text color={colors.secondary} bold>{'[g] Sync All'.padEnd(18)}</Text><Text color={colors.muted}>将此配置内的所有覆写项一并设为系统全局默认</Text></Text>
                <Text><Text color={colors.secondary} bold>{'[p] Preview'.padEnd(18)}</Text><Text color={colors.muted}>预览这套配置下实际生成的 TOML 代码</Text></Text>
                <Text><Text color={colors.secondary} bold>{'[h] History'.padEnd(18)}</Text><Text color={colors.muted}>查看针对当前配置修改的安全回滚点</Text></Text>
              </Box>
            </Box>
          )}

        </Box>
      </Box>

      {/* 底部仿 ShortcutBar 的占位解说区（对齐底边高度） */}
      <Box marginY={1} flexDirection="column" paddingX={1}>
        {uiMode.startsWith('config') ? (
           <>
            <Box flexDirection="row">
              <Text color={colors.muted}>提示：具体的参数详解，会在你按 </Text><Text color={colors.primary}>[Tab / RightArrow]</Text><Text color={colors.muted}> 进入右侧编辑面板后，附带在下方实时释义。</Text>
            </Box>
            <Box flexDirection="row">
              <Text color={colors.muted}>注意：带有 </Text><Text color={colors.warning} bold>CLI: </Text><Text color={colors.muted}> 前缀的参数属于这趟运行的单次注入参数，它们</Text><Text color={colors.secondary}>绝对不会被保存到全局配置里去</Text><Text color={colors.muted}>，请放心修改。</Text>
            </Box>
           </>
        ) : (
           <Box height={2}><Text> </Text></Box> /* 非配置模式下保持高度空档占位 */
        )}
      </Box>

      <Box gap={2} flexWrap="wrap">
        <Text color={colors.dim}>[Esc] / [?] Close Guide</Text>
      </Box>

    </Box>
  );
}
