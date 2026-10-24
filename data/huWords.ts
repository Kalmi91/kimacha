// The Hungarian target deck (data/words/hu: A0 + A1) in WordEntry shape. The word lookup of the Hungarian course
// lessons (data/words.ts findWordByText, learned language 'hu') runs on these cards, the way the es and en courses
// run on the words-open cards. The JSON files are required on the first call, not at import time.
// (Type-only import from words.ts: words.ts imports this module.)

import type { WordEntry } from '@/data/words';

let huWords: WordEntry[] | null = null;

/** Every card of the Hungarian deck: `hu` is the headword, `es` / `en` its meaning in the learner's language. */
export function getHuWords(): WordEntry[] {
  if (!huWords) {
    const files: WordEntry[][] = [require('@/data/words/hu/a0.json'), require('@/data/words/hu/a1.json')];
    huWords = files.flat();
  }
  return huWords;
}
