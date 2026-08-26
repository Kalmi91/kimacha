// GAMES.md 4.1 (F2, word-rain) acceptance: "jest: wordRain.test.ts, a
// generátor mindig pontosan 1 helyes választ ad". Pulled out of the screen
// component into a pure function so that guarantee is unit-testable without
// mounting reanimated/RN.

import { pickDistractors, type DistractMode } from './distract';
import { shuffleArray, hashString } from '../shuffle';
import type { PoolEntry } from './vocabPool';

export type WordRainDirection = 'forward' | 'reverse'; // forward = source prompt, learned falls

export interface FallingWordSpec {
  text: string;
  wordId: number;
  isTarget: boolean;
}

export interface BuildFallingRoundOptions {
  direction: WordRainDirection;
  learnedLang: string;
  nativeLang: string;
  fallingCount: number; // total tiles, including the target
  distractorMode: DistractMode;
  seed: number;
}

export interface FallingRound {
  prompt: string;
  words: FallingWordSpec[];
}

/**
 * Builds one word-rain round: the prompt (always the OTHER language from what
 * falls) plus exactly `fallingCount` falling tiles, exactly one of which
 * (`isTarget: true`) is correct. Every word, target and distractors alike,
 * comes from `pool` (GAMES.md 0., the pool rule), never invented.
 */
export function buildFallingRound(entry: PoolEntry, pool: PoolEntry[], opts: BuildFallingRoundOptions): FallingRound {
  const field = opts.direction === 'forward' ? 'learned' : 'native';
  const fallLang = opts.direction === 'forward' ? opts.learnedLang : opts.nativeLang;
  const target = opts.direction === 'forward' ? entry.learned : entry.native;
  const prompt = opts.direction === 'forward' ? entry.native : entry.learned;
  const need = Math.max(1, opts.fallingCount - 1);

  const distractors = pickDistractors(target, pool, {
    lang: fallLang,
    mode: opts.distractorMode,
    count: need,
    field,
    seed: opts.seed,
  });

  // Top up with other pool words if the near-miss generator came up short
  // (a thin pool, or few similarly-shaped words at this level).
  const seenLower = new Set([target.toLowerCase(), ...distractors.map((d) => d.toLowerCase())]);
  const others = shuffleArray(
    pool.filter((p) => p.wordId !== entry.wordId),
    opts.seed
  );
  for (const o of others) {
    if (distractors.length >= need) break;
    const cand = field === 'learned' ? o.learned : o.native;
    if (cand && !seenLower.has(cand.toLowerCase())) {
      distractors.push(cand);
      seenLower.add(cand.toLowerCase());
    }
  }

  const distractorEntries = distractors.slice(0, need).map((text) => {
    const owner = pool.find((p) => (field === 'learned' ? p.learned : p.native) === text);
    return { text, wordId: owner?.wordId ?? entry.wordId, isTarget: false };
  });

  const words = shuffleArray<FallingWordSpec>(
    [{ text: target, wordId: entry.wordId, isTarget: true }, ...distractorEntries],
    hashString(`spawn:${entry.wordId}:${opts.seed}`)
  );

  return { prompt, words };
}
