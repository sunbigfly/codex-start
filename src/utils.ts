/**
 * 工具函数模块
 */

/** 掩码 API Key，只显示前4位和后4位 */
export function maskApiKey(key: string): string {
  if (!key) return '(empty)';
  if (key.length <= 8) return '*'.repeat(key.length);
  return key.slice(0, 4) + '*'.repeat(Math.min(key.length - 8, 16)) + key.slice(-4);
}

/** 模糊匹配：name 中包含 query 的所有子串（大小写不敏感） */
export function fuzzyMatch(profiles: { name: string }[], query: string): number[] {
  if (!query) return profiles.map((_, i) => i);
  const q = query.toLowerCase();
  return profiles
    .map((p, i) => ({ i, match: p.name.toLowerCase().includes(q) }))
    .filter(x => x.match)
    .map(x => x.i);
}
