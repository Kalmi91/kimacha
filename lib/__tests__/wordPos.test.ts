// F-1 (K6 DECISION, 2026-08-26): guards the pos/gender metadata that
// the annotation puts into the word JSON files. Four future games
// (bubble-pop, odd-one-out, conjugation-slot, grammar-choice) group vocabulary
// by part of speech and grammatical gender, so a missing or invalid value is a
// silent content bug (a word simply never shows up in its category, or shows
// up in the wrong one).
//
// Scope: the live en branch. The old shared Spanish
// set (a0..c2.json) and the hu branch are gone; the Spanish side is data/words-open
// (its pos/gender mapping is covered by data/__tests__/openWords.test.ts).

import { readFileSync } from 'fs';
import { join } from 'path';

import type { WordEntry } from '@/data/words';

const VALID_POS = new Set(['noun', 'verb', 'adj', 'adv', 'pron', 'prep', 'num', 'phrase']);
const VALID_GENDER = new Set(['m', 'f', 'mf', '-']);

// Play cut: the en branch no longer goes through
// the loader (single en-es pair), so its annotation is checked straight off
// the JSON files.
function branchLevel(lang: string, level: string): WordEntry[] {
  return JSON.parse(readFileSync(join(__dirname, '..', '..', 'data', 'words', lang, `${level}.json`), 'utf8'));
}

const enAnnotated: WordEntry[] = [
  ...branchLevel('en', 'a0'),
  ...branchLevel('en', 'a1'),
  ...branchLevel('en', 'a2'),
];

describe('word pos/gender metadata (GAMES.md F-1)', () => {
  describe.each([
    ['English branch (A0..A2)', enAnnotated],
  ])('%s', (_label, entries) => {
    it('gives every entry a valid pos', () => {
      const bad = entries.filter((w) => !VALID_POS.has(String(w.pos)));
      expect(bad.map((w) => ({ id: w.id, es: w.es, pos: w.pos }))).toEqual([]);
    });

    it('gives every noun a valid gender, and non-nouns no gender', () => {
      const badNouns = entries.filter((w) => w.pos === 'noun' && !VALID_GENDER.has(String(w.gender)));
      expect(badNouns.map((w) => ({ id: w.id, es: w.es, gender: w.gender }))).toEqual([]);

      const strayGender = entries.filter((w) => w.pos !== 'noun' && w.gender !== undefined);
      expect(strayGender.map((w) => ({ id: w.id, es: w.es, pos: w.pos, gender: w.gender }))).toEqual([]);
    });
  });
});
