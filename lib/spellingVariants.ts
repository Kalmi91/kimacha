// FB28: spelling-variant distractors for the recognition fallback.
//
// When a learner repeatedly mistypes a word, the typing card downgrades to a
// multiple-choice "pick the correct spelling" card: the real word plus a few
// plausible MISSPELLINGS (e.g. quiero → qiero, quoero, quireo). The variants
// need not be real words, they exist to train correct orthography, exactly as
// the user asked ("quier qero qiero … olyan szavak amik lehet hogy nem
// léteznek, de a helyes szó írásában segítenek").
//
// Every variant is a single, plausible edit away from the correct form so the
// learner must look carefully. Output is deterministic (seeded by the word), so
// a given card always shows the same options across re-renders.

import { hashString } from './shuffle';

const VOWELS = 'aeiou';

// Common Spanish orthographic confusions (the letters beginners actually mix up).
const CONFUSIONS: [string, string][] = [
  ['b', 'v'], ['v', 'b'],
  ['ll', 'y'], ['y', 'll'],
  ['qu', 'c'], ['c', 'qu'],
  ['z', 's'], ['s', 'z'], ['c', 's'],
  ['gu', 'g'], ['j', 'g'], ['g', 'j'],
  ['h', ''], // silent h dropped
  ['rr', 'r'], ['r', 'rr'],
];

const fold = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** mulberry32 PRNG (seeded) for a stable, deterministic distractor pick. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate up to `count` plausible misspellings of `word`.
 * Each is a single edit away; none equals the correct form (accent/case-folded);
 * all are mutually distinct. Deterministic for a given word.
 */
export function spellingVariants(word: string, count: number): string[] {
  const w = word;
  const lower = w.toLowerCase();
  const cands = new Set<string>();
  const add = (s: string) => {
    if (s && s !== w && fold(s) !== fold(w)) cands.add(s);
  };

  // 1. transpose two adjacent letters
  for (let i = 0; i < w.length - 1; i++) {
    add(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2));
  }
  // 2. drop a letter
  for (let i = 0; i < w.length; i++) {
    add(w.slice(0, i) + w.slice(i + 1));
  }
  // 3. double a letter
  for (let i = 0; i < w.length; i++) {
    add(w.slice(0, i + 1) + w[i] + w.slice(i + 1));
  }
  // 4. swap a vowel for another vowel
  for (let i = 0; i < w.length; i++) {
    const vi = VOWELS.indexOf(lower[i]);
    if (vi >= 0) {
      for (const v of VOWELS) if (v !== lower[i]) add(w.slice(0, i) + v + w.slice(i + 1));
    }
  }
  // 5. orthographic confusions (every occurrence)
  for (const [from, to] of CONFUSIONS) {
    let idx = lower.indexOf(from);
    while (idx >= 0) {
      add(w.slice(0, idx) + to + w.slice(idx + from.length));
      idx = lower.indexOf(from, idx + 1);
    }
  }

  // Stable seeded shuffle so the same word always yields the same options.
  const pool = [...cands];
  const next = rng(hashString(w));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // Drop fold-duplicates so two options never look identical to the matcher.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of pool) {
    const k = fold(v);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
    if (out.length >= count) break;
  }
  return out;
}
