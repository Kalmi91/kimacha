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

// FB51: letters Spanish legitimately doubles (llegar, perro, acción, innato).
// Doubling anything else, above all a vowel ("aacera"), reads as an obvious
// fake rather than a plausible misspelling, so those never enter the pool.
const DOUBLABLE = new Set(['l', 'r', 'c', 'n']);

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

// FB44: edits must never touch punctuation/symbols/whitespace (\u00bf ? \u00a1 ! . , -
// and spaces), only letters. Without this guard a transpose or drop could
// shift a "?" mid-word ("est\u00e1?s") or eat a whole short word ("de" -> "d"),
// which reads as an obvious typo/garbage rather than a plausible misspelling.
const isLetter = (ch: string | undefined): boolean => !!ch && /\p{L}/u.test(ch);

/**
 * Span [start, end) of the LONGEST whitespace-delimited word in `phrase`,
 * measured by letter count (punctuation attached to a token, e.g. "est\u00e1s?",
 * doesn't count towards its length). Edits are confined to this span so a
 * multi-word phrase never gets a misspelling stitched onto its shortest word.
 * Ties keep the first (leftmost) word at the max letter count.
 */
function longestWordSpan(phrase: string): [number, number] {
  let bestStart = 0;
  let bestLen = 0;
  let bestLetters = -1;
  let i = 0;
  while (i < phrase.length) {
    if (/\s/.test(phrase[i])) { i++; continue; }
    const start = i;
    while (i < phrase.length && !/\s/.test(phrase[i])) i++;
    const token = phrase.slice(start, i);
    const letters = [...token].filter(isLetter).length;
    if (letters > bestLetters) {
      bestLetters = letters;
      bestStart = start;
      bestLen = token.length;
    }
  }
  return [bestStart, bestStart + bestLen];
}

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
 * all are mutually distinct. Deterministic for a given word. Edits only ever
 * touch letters inside the phrase's longest word (FB44), so punctuation and
 * other words in a multi-word phrase are always left intact.
 */
export function spellingVariants(word: string, count: number): string[] {
  const w = word;
  const lower = w.toLowerCase();
  const [spanStart, spanEnd] = longestWordSpan(w);
  const cands = new Set<string>();
  const foldW = fold(w);
  const add = (s: string) => {
    if (!s || s === w || fold(s) === foldW) return;
    // FB51: no variant may introduce a doubled vowel the correct form lacks
    // ("aacera", "quoosco"), doubling, transpose and vowel swap can all
    // create one, and every one of them reads as an obvious fake.
    for (const m of fold(s).match(/([aeiou])\1/g) ?? []) {
      if (!foldW.includes(m)) return;
    }
    cands.add(s);
  };

  // 1. transpose two adjacent letters
  for (let i = spanStart; i < spanEnd - 1; i++) {
    if (!isLetter(w[i]) || !isLetter(w[i + 1])) continue;
    add(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2));
  }
  // 2. drop a letter
  for (let i = spanStart; i < spanEnd; i++) {
    if (!isLetter(w[i])) continue;
    add(w.slice(0, i) + w.slice(i + 1));
  }
  // 3. double a letter (only ones Spanish actually doubles, FB51)
  for (let i = spanStart; i < spanEnd; i++) {
    if (!isLetter(w[i]) || !DOUBLABLE.has(lower[i])) continue;
    add(w.slice(0, i + 1) + w[i] + w.slice(i + 1));
  }
  // 4. swap a vowel for another vowel
  for (let i = spanStart; i < spanEnd; i++) {
    if (!isLetter(w[i])) continue;
    const vi = VOWELS.indexOf(lower[i]);
    if (vi >= 0) {
      for (const v of VOWELS) if (v !== lower[i]) add(w.slice(0, i) + v + w.slice(i + 1));
    }
  }
  // 5. orthographic confusions (every occurrence, confined to the span)
  for (const [from, to] of CONFUSIONS) {
    let idx = lower.indexOf(from, spanStart);
    while (idx >= 0 && idx + from.length <= spanEnd) {
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
