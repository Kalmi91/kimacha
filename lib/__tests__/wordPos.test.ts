// GAMES.md F-1 (K6 DÖNTÉS, 2026-08-26): guards the pos/gender metadata that
// scripts/annotate-pos.mjs writes into the word JSON files. Four future games
// (bubble-pop, odd-one-out, conjugation-slot, grammar-choice) group vocabulary
// by part of speech and grammatical gender, so a missing or invalid value is a
// silent content bug (a word simply never shows up in its category, or shows
// up in the wrong one).
//
// Scope: the shared Spanish set (A0..C1) plus the live en/hu branches. C2 is
// FROZEN and intentionally excluded, per the task.

import { readFileSync } from 'fs';
import { join } from 'path';

import { words, type WordEntry } from '@/data/words';

const VALID_POS = new Set(['noun', 'verb', 'adj', 'adv', 'pron', 'prep', 'num', 'phrase']);
const VALID_GENDER = new Set(['m', 'f', 'mf', '-']);

// Play-vágás 7. lépés (2026-09-23): the en/hu branches no longer go through
// the loader (single en-es pair), so their annotation is checked straight off
// the JSON files, the same way `svCorpus.test.ts` reads the Swedish track.
function branchLevel(lang: string, level: string): WordEntry[] {
  return JSON.parse(readFileSync(join(__dirname, '..', '..', 'data', 'words', lang, `${level}.json`), 'utf8'));
}

const sharedAnnotated: WordEntry[] = words.filter((w) => w.level !== 'C2');
const enAnnotated: WordEntry[] = [
  ...branchLevel('en', 'a0'),
  ...branchLevel('en', 'a1'),
  ...branchLevel('en', 'a2'),
];
const huAnnotated: WordEntry[] = [
  ...branchLevel('hu', 'a0'),
  ...branchLevel('hu', 'a1'),
];

describe('word pos/gender metadata (GAMES.md F-1)', () => {
  describe.each([
    ['shared Spanish set (A0..C1)', sharedAnnotated],
    ['English branch (A0..A2)', enAnnotated],
    ['Hungarian branch (A0..A1)', huAnnotated],
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

  it('never annotates the frozen C2 set', () => {
    const c2 = words.filter((w) => w.level === 'C2');
    expect(c2.length).toBeGreaterThan(0);
    const annotated = c2.filter((w) => w.pos !== undefined);
    expect(annotated.map((w) => ({ id: w.id, es: w.es }))).toEqual([]);
  });
});
