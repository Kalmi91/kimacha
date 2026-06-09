import { levenshtein } from './levenshtein';

// Article families per learned language. When the answer sentence contains one
// article, its siblings are the most-confusable distractors (el ↔ la ↔ los ↔ las).
const ARTICLES: Record<string, string[]> = {
  es: ['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas'],
  en: ['the', 'a', 'an'],
  de: ['der', 'die', 'das', 'den', 'dem', 'ein', 'eine', 'einen'],
  hu: ['a', 'az', 'egy'],
};

/**
 * Near-miss distractors for the tap-to-order easy sentence card (FB1).
 *
 * Instead of random vocabulary, prefer words that are genuinely easy to confuse
 * with the actual sentence words so the learner practises forms/endings:
 *  - sibling articles of the same language (el/la/los/las),
 *  - vocabulary sharing a stem or differing by an ending / person-form
 *    (llega → llego / llegas / llegan).
 * Falls back to random vocabulary only to fill the remaining slots.
 *
 * @param targetWords  words of the correct answer sentence (punctuation stripped)
 * @param vocab        candidate distractor surface forms (level vocabulary)
 * @param lang         learned-language code (es/en/de/hu)
 * @param count        how many distractors to return (default 3)
 */
export function nearMissDistractors(
  targetWords: string[],
  vocab: string[],
  lang: string,
  count = 3,
): string[] {
  const targetLower = targetWords.map((w) => w.toLowerCase());
  const targetSet = new Set(targetLower);
  const out: string[] = [];
  const push = (w: string) => {
    const c = (w ?? '').trim();
    if (c && !targetSet.has(c.toLowerCase()) && !out.some((o) => o.toLowerCase() === c.toLowerCase())) {
      out.push(c);
    }
  };

  // 1) Article family — most-requested distractor type. Cap at 2 so articles
  //    never fill every slot.
  const articleList = ARTICLES[lang] ?? [];
  if (targetLower.some((w) => articleList.includes(w))) {
    articleList
      .filter((a) => !targetSet.has(a))
      .slice(0, 2)
      .forEach(push);
  }

  // 2) Morphological near-misses — rank vocabulary by closeness to the nearest
  //    sentence word. A shared 3-char stem (same verb, different ending) or a
  //    small edit distance both signal "almost the right word".
  const score = (cand: string): number => {
    const c = cand.toLowerCase();
    let best = Infinity;
    for (const tw of targetLower) {
      if (tw.length < 3 || c.length < 3) continue;
      const d = levenshtein(c, tw);
      const stemBonus = c.slice(0, 3) === tw.slice(0, 3) ? -2 : 0;
      best = Math.min(best, d + stemBonus);
    }
    return best;
  };

  const ranked = [...new Set(vocab.map((w) => w.trim()))]
    .filter((w) => w && !targetSet.has(w.toLowerCase()))
    .map((w) => ({ w, s: score(w) }))
    .filter((o) => o.s <= 4) // only genuinely confusable forms
    .sort((a, b) => a.s - b.s);
  ranked.forEach((o) => push(o.w));

  // 3) Fill any remaining slots with random vocabulary so the bank is full.
  if (out.length < count) {
    const rest = [...vocab].sort(() => Math.random() - 0.5);
    for (const w of rest) {
      if (out.length >= count) break;
      push(w);
    }
  }

  return out.slice(0, count);
}
