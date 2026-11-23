import { getGrammarTopic, getGrammarTopicIds, type GrammarTopicData } from '@/lib/games/content';
import { hashString } from '@/lib/shuffle';
import type { MatchItem } from '@/lib/grammar/lessonTypes';

type Pair = MatchItem['pairs'][number];

export interface MatchDistractors {
  left: string; // the left half of one pair of another match item: no partner on the right
  right: string; // the right half of a DIFFERENT pair: no partner on the left
}

const norm = (s: string) => s.trim().toLowerCase();

function matchPairs(lesson: GrammarTopicData, exceptId: string): Pair[] {
  const out: Pair[] = [];
  for (const it of lesson.items) if (it.kind === 'match' && it.id !== exceptId) out.push(...it.pairs);
  return out;
}

// One similar-but-unneeded element per side. The source is the lesson's other match items, else
// another lesson of the same level; deterministic (from the item id). Null when nothing fits.
// Extras are no longer (in words) than the item's own pairs.
export function pickMatchDistractors(
  item: MatchItem,
  lesson: GrammarTopicData | undefined,
  contentLang: string,
  leftOf: (p: Pair) => string,
  rightOf: (p: Pair) => string
): MatchDistractors | null {
  if (!lesson) return null;
  const lefts = new Set(item.pairs.map((p) => norm(leftOf(p))));
  const rights = new Set(item.pairs.map((p) => norm(rightOf(p))));
  const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
  const maxLeft = Math.max(...item.pairs.map((p) => words(leftOf(p))));
  const maxRight = Math.max(...item.pairs.map((p) => words(rightOf(p))));
  const seed = hashString(item.id);
  const tryPool = (pool: Pair[]): MatchDistractors | null => {
    const n = pool.length;
    if (n < 2) return null;
    for (let i = 0; i < n; i++) {
      const a = pool[(seed + i) % n];
      if (lefts.has(norm(leftOf(a))) || words(leftOf(a)) > maxLeft) continue;
      for (let j = 1; j < n; j++) {
        const b = pool[(seed + i + j) % n];
        if (words(rightOf(b)) > maxRight || norm(leftOf(b)) === norm(leftOf(a)) || rights.has(norm(rightOf(b))) || norm(rightOf(b)) === norm(rightOf(a))) continue;
        return { left: leftOf(a), right: rightOf(b) };
      }
    }
    return null;
  };
  const own = tryPool(matchPairs(lesson, item.id));
  if (own) return own;
  for (const id of getGrammarTopicIds(contentLang)) {
    if (id === lesson.topic) continue;
    const other = getGrammarTopic(contentLang, id);
    if (!other || other.level !== lesson.level) continue;
    const found = tryPool(matchPairs(other, ''));
    if (found) return found;
  }
  return null;
}
