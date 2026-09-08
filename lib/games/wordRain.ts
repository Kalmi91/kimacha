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

// FB162 (2026-08-28 browser playtest): the tiles were positioned with a fixed
// 40px half-width guess (`index * lane + lane / 2 - 40`), while the tile is as
// wide as its word. At 5-6 falling words the first tile started OUTSIDE the
// board on the left and long words overlapped their neighbours. A tile now owns
// its lane: it starts at the lane edge and is exactly one lane wide, so nothing
// overlaps and nothing leaves the board, whatever the word or the tile count.
export const LANE_GUTTER = 4;

// GAMES.md 4.1: "Fentről 4-6 szó esik a tanult nyelven, vízszintesen
// szétszórva, KÜLÖNBÖZŐ SEBESSÉGGEL". Every tile of a round used to get the
// same duration, so the board fell as one rigid line and the round was over
// the moment the slowest tile landed. Each lane now gets its own duration,
// deterministically spread around the base speed, so the words arrive
// staggered; the spread is symmetric, so the average round length is
// unchanged and the difficulty curve (4.1: -8% every 10 hits, floor 2.2 s)
// still governs the base.
export const FALL_SPREAD = 0.3; // ±30% around the base duration

export function laneFallDurations(count: number, baseMs: number, seed: number, minMs: number): number[] {
  const n = Math.max(1, count);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    // Evenly spaced offsets in [-FALL_SPREAD, +FALL_SPREAD], then rotated by
    // the seed so the fast lane is not always the same column.
    const slot = n === 1 ? 0 : ((i + (seed % n)) % n) / (n - 1); // 0..1
    const factor = 1 - FALL_SPREAD + slot * FALL_SPREAD * 2;
    out.push(Math.max(minMs, Math.round(baseMs * factor)));
  }
  return out;
}

export interface FallingLane {
  x: number;
  width: number;
}

export function fallingLane(index: number, count: number, boardWidth: number): FallingLane {
  const lane = boardWidth / Math.max(1, count);
  return { x: index * lane + LANE_GUTTER, width: Math.max(0, lane - LANE_GUTTER * 2) };
}
