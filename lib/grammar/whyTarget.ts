// The optional `target` field of a `why` item names the exact part of the
// sentence the question is about (WhyItem,
// lessonTypes.ts). The search works at word boundaries, so a short target
// (e.g. "es") does not match inside a longer word (e.g. "profesor").
// The same logic is repeated in scripts/audit-games.mjs, because that
// script does not import TS files.
export function findWholeWord(haystack: string, needle: string): { start: number; end: number } | null {
  if (!needle) return null;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?<![\\p{L}\\p{M}])(${escaped})(?![\\p{L}\\p{M}])`, 'u');
  const m = re.exec(haystack);
  if (!m) return null;
  return { start: m.index, end: m.index + m[0].length };
}
