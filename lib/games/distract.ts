// GAMES.md 3. (F0): distractor generation for the game modules, built on the
// existing near-miss generator (lib/distractors.ts) so every arcade/quiz game
// gets the same "confusable, not random junk" quality FB1/FB7 already
// established for the learn tab, instead of a second, weaker generator.

import { nearMissDistractors } from '../distractors';
import { shuffleArray, hashString } from '../shuffle';
import type { PoolEntry } from './vocabPool';

export type DistractMode = 'nearMiss' | 'random';

export interface PickDistractorsOptions {
  lang: string; // learned-language code, for the article-family table
  mode?: DistractMode; // default 'nearMiss'
  count?: number; // default 3
  seed?: number; // for 'random' mode determinism; default hashString(target)
  // F2 MEGVALÓSÍTÁSI JEGYZET (word-rain 4.1, "irány: tanult→forrás"): which
  // PoolEntry field the candidate words come from. Default 'learned' (every
  // pre-F2 caller, unaffected); word-rain's reversed direction falls the
  // NATIVE-language form, so its distractor candidates must come from
  // `p.native` instead, not from the always-target-language `p.learned`.
  field?: 'learned' | 'native';
}

/**
 * Distractor surface forms for `target`, drawn from `pool` (never from
 * outside the learner's vocabulary pool, per GAMES.md 0.).
 */
export function pickDistractors(target: string, pool: PoolEntry[], opts: PickDistractorsOptions): string[] {
  const count = opts.count ?? 3;
  const field = opts.field ?? 'learned';
  const targetLower = target.toLowerCase();
  const vocab = [...new Set(pool.map((p) => p[field]).filter((w) => w && w.toLowerCase() !== targetLower))];

  if ((opts.mode ?? 'nearMiss') === 'random') {
    const seed = opts.seed ?? hashString(target);
    return shuffleArray(vocab, seed).slice(0, count);
  }

  return nearMissDistractors([target], vocab, opts.lang, count);
}
