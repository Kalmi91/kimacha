// FB376 (PLAN-fb0923 4. lépés): a `why` item opcionális `target` mezője a
// mondat pontos részét nevezi meg, amire a kérdés vonatkozik (WhyItem,
// lessonTypes.ts). A keresés szóhatárral történik, hogy egy rövid target
// (pl. "es") ne találjon rá egy hosszabb szó belsejére (pl. "profesor").
// Ugyanez a logika megismétlődik scripts/audit-games.mjs-ben, mert az a
// script nem importál TS fájlt.
export function findWholeWord(haystack: string, needle: string): { start: number; end: number } | null {
  if (!needle) return null;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?<![\\p{L}\\p{M}])(${escaped})(?![\\p{L}\\p{M}])`, 'u');
  const m = re.exec(haystack);
  if (!m) return null;
  return { start: m.index, end: m.index + m[0].length };
}
