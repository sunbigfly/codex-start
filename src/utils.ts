/**
 * 工具函数模块
 */


/** 模糊匹配：name 中包含 query 的所有子串（大小写不敏感） */
export function fuzzyMatch(profiles: { name: string }[], query: string): number[] {
  if (!query) return profiles.map((_, i) => i);
  const q = query.toLowerCase();
  return profiles
    .map((p, i) => ({ i, match: p.name.toLowerCase().includes(q) }))
    .filter(x => x.match)
    .map(x => x.i);
}

/** 计算字符串的终端显示宽度（非 ASCII 字符占 2 列，匹配 CJK 终端 Ambiguous 宽度行为） */
export function computeDisplayWidth(str: string): number {
  let len = 0;
  for (let i = 0; i < str.length; i++) {
    len += str.charCodeAt(i) > 255 ? 2 : 1;
  }
  return len;
}

/**
 * 根据 profile 名字列表动态计算导航面板所需的宽度。
 * 
 * 布局结构：width = padding(3) + border(1) + prefixChars + maxNameWidth + suffixChars + safety(1)
 *   - padding: padding={1}(left=1) + paddingRight={2}(right=2) = 3
 *   - border: borderRight single = 1
 *   - safety: 额外 1 字符防溢出
 * 
 * @param names - profile 名字列表
 * @param prefixChars - 行首图标开销（arrow + star + test icon 等）
 * @param suffixChars - 行尾开销（如 duration 文本）
 * @param minWidth - 最小宽度下限
 */
export function computeNavWidth(
  names: string[],
  prefixChars: number = 6,
  suffixChars: number = 0,
  minWidth: number = 36,
): number {
  // 固定左侧导航栏宽度为 36，彻底杜绝不同页面/状态之间因为前缀后缀参数差异导致的布局抖动
  // 结合之前的 wrap="truncate-end" 可以在名称非常长时优雅截断
  return minWidth;
}
