// Guards the two invariants the 2026-08-07 cleanup established for the Spanish
// word corpus. Both used to be broken and both are silent in the UI, so they are
// checked here rather than trusted: an id collision makes one card render another
// card's word, a same-meaning duplicate makes you relearn a known word from zero.

import { words } from '@/data/words';
import { WORD_MERGES } from '../wordMerges';
import { pickSurvivor } from '../cardMerge';

const LEVEL_ORDER = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const norm = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/^(the|an|a|az)\s+/, '')
    .replace(/^(el|la|los|las)\s+/, '')
    .replace(/[.\s]+$/, '');

const senses = (value: unknown): Set<string> =>
  new Set(
    String(value ?? '')
      .split(/[/,]/)
      .map(norm)
      .filter(Boolean)
  );

const sharesMeaning = (a: any, b: any): boolean =>
  ['en', 'hu'].some((field) => {
    const left = senses(a[field]);
    for (const sense of senses(b[field])) if (left.has(sense)) return true;
    return false;
  });

describe('Spanish word corpus', () => {
  it('gives every word a globally unique id', () => {
    const seen = new Map<number, string>();
    const collisions: string[] = [];
    for (const word of words) {
      const owner = seen.get(word.id);
      if (owner) collisions.push(`${word.id}: ${owner} vs ${word.level} ${word.es}`);
      else seen.set(word.id, `${word.level} ${word.es}`);
    }
    expect(collisions).toEqual([]);
  });

  it('teaches a headword+meaning on one level only', () => {
    const first = new Map<string, any>();
    const duplicates: string[] = [];
    for (const word of [...words].sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level))) {
      const earlier = first.get(word.es);
      if (!earlier) first.set(word.es, word);
      else if (sharesMeaning(earlier, word)) {
        duplicates.push(`${word.es}: ${earlier.level} ${earlier.id} vs ${word.level} ${word.id}`);
      }
    }
    expect(duplicates).toEqual([]);
  });
});

describe('WORD_MERGES', () => {
  const ids = new Set(words.map((w) => w.id));

  it('only maps ids that are really gone', () => {
    expect(Object.keys(WORD_MERGES).filter((id) => ids.has(Number(id)))).toEqual([]);
  });

  it('always points at a word that still exists', () => {
    expect(Object.values(WORD_MERGES).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('resolves in one hop, no chains', () => {
    expect(Object.values(WORD_MERGES).filter((id) => id in WORD_MERGES)).toEqual([]);
  });
});

describe('pickSurvivor', () => {
  const card = (reps: number, stability: number, due: string) => ({ reps, stability, due });

  it('keeps the more practised card', () => {
    const strong = card(7, 1, '2026-09-01');
    expect(pickSurvivor(card(2, 9, '2026-08-01'), strong)).toBe(strong);
  });

  it('breaks a reps tie on stability', () => {
    const stable = card(3, 12, '2026-09-01');
    expect(pickSurvivor(stable, card(3, 4, '2026-08-01'))).toBe(stable);
  });

  it('falls back to the earlier due date, so a review cannot slip', () => {
    const soon = card(3, 5, '2026-08-01');
    expect(pickSurvivor(card(3, 5, '2026-08-20'), soon)).toBe(soon);
  });
});
