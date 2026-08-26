// Deterministic option shuffling for multiple-choice exam cards (FB2).
//
// Several authored exam JSONs pin the correct option to slot A (correctIndex 0),
// which makes the answer guessable. Shuffling the options at render time removes
// the position bias. A *seeded* shuffle keeps a given question's layout stable
// across re-renders (no flicker) while still differing from question to question.

/** mulberry32, tiny, fast, deterministic PRNG seeded by a 32-bit integer. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a string hash → 32-bit unsigned, used to derive a per-question seed. */
export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Seeded Fisher–Yates shuffle of MC options that also tracks where the correct
 * answer lands, so the correct option is no longer fixed to slot A (FB2).
 *
 * @returns options in their new order plus the relocated correctIndex.
 */
export function shuffleOptions<T>(
  options: T[],
  correctIndex: number,
  seed: number,
): { options: T[]; correctIndex: number } {
  const rng = mulberry32(seed);
  const order = options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    options: order.map((i) => options[i]),
    correctIndex: order.indexOf(correctIndex),
  };
}

/**
 * Seeded Fisher–Yates shuffle of a plain array (GAMES.md 3.1, vocabPool.ts:
 * "determinisztikus keverés a lib/shuffle.ts-ből, tesztelhetőség"). Same seed,
 * same order, every time, a game's word pool doesn't reshuffle itself on
 * every re-render.
 */
export function shuffleArray<T>(items: T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
