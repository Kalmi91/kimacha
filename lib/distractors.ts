import { levenshtein } from './levenshtein';

// Article families per learned language. When the answer sentence contains one
// article, its siblings are the most-confusable distractors (el ↔ la ↔ los ↔ las).
const ARTICLES: Record<string, string[]> = {
  es: ['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas'],
  en: ['the', 'a', 'an'],
  de: ['der', 'die', 'das', 'den', 'dem', 'ein', 'eine', 'einen'],
  hu: ['a', 'az', 'egy'],
};

// FB50: subject-pronoun gender pairs the source sentence cannot disambiguate
// ("They decide" → ellos/ellas are BOTH correct translations). Offering the
// counterpart as a trap is unfair, so when the answer uses one member of a
// pair, its partner is barred from the bank.
const AMBIGUOUS_PRONOUN_PAIRS: Record<string, [string, string][]> = {
  es: [
    ['ellos', 'ellas'],
    ['nosotros', 'nosotras'],
    ['vosotros', 'vosotras'],
  ],
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
  const blocked = new Set<string>();
  for (const [a, b] of AMBIGUOUS_PRONOUN_PAIRS[lang] ?? []) {
    if (targetSet.has(a)) blocked.add(b);
    if (targetSet.has(b)) blocked.add(a);
  }
  const out: string[] = [];
  const push = (w: string) => {
    const c = (w ?? '').trim();
    if (
      c &&
      !targetSet.has(c.toLowerCase()) &&
      !blocked.has(c.toLowerCase()) &&
      !out.some((o) => o.toLowerCase() === c.toLowerCase())
    ) {
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
  //    Multi-word vocab entries (grammar cards like "yo hablo") are split into
  //    single tokens first — a word bank only holds one word per tile, and the
  //    split forms (tú / hablas) are exactly the near-misses learners asked for.
  const tokens = [
    ...new Set(
      vocab
        // Drop parenthetical glosses ("su casa (de ellos)") before splitting so a
        // disambiguation hint never leaks into the bank as a stray tile ("ellos)").
        .map((w) => String(w ?? '').replace(/\s*\([^)]*\)/g, ' '))
        .flatMap((w) => w.split(/\s+/))
        .map((w) => w.replace(/[.,!?;:¡¿"'()]/g, '').trim())
        .filter((w) => w.length > 1 || (ARTICLES[lang] ?? []).includes(w.toLowerCase())),
    ),
  ];

  const score = (cand: string): number => {
    const c = cand.toLowerCase();
    let best = Infinity;
    for (const tw of targetLower) {
      if (tw.length < 3 || c.length < 3) continue;
      const d = levenshtein(c, tw);
      const stem = c.slice(0, 3) === tw.slice(0, 3);
      // Confusable = same stem with a different ending (llega → llegan), a
      // one-letter slip, or a two-letter slip of a longer word. Anything
      // looser ("mil" next to "muy") is noise, not a near-miss.
      if ((stem && d <= 3) || d <= 1 || (d <= 2 && Math.min(c.length, tw.length) >= 5)) {
        best = Math.min(best, d - (stem ? 2 : 0));
      }
    }
    return best;
  };

  const ranked = tokens
    .filter((w) => w && !targetSet.has(w.toLowerCase()))
    .map((w) => ({ w, s: score(w) }))
    .filter((o) => o.s < Infinity)
    .sort((a, b) => a.s - b.s);
  ranked.forEach((o) => push(o.w));

  // 3) Fill any remaining slots with the closest leftover vocabulary —
  //    never random picks, those read as obvious junk in the bank.
  if (out.length < count) {
    const closest = tokens
      .filter((w) => w && !targetSet.has(w.toLowerCase()))
      .map((w) => ({
        w,
        d: Math.min(...targetLower.map((tw) => levenshtein(w.toLowerCase(), tw))),
      }))
      .sort((a, b) => a.d - b.d);
    for (const o of closest) {
      if (out.length >= count) break;
      push(o.w);
    }
  }

  return out.slice(0, count);
}
