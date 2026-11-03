// The level picker of the Sentences tab (FB556): which levels are offered for a pair, which items a level serves, and the
// choice kept per language pair.

import type { PcicItem } from '@/data/pcic';
import { getDb } from '@/lib/database';
import {
  ALL_LEVELS,
  itemsForSentenceLevel,
  levelsWithSentences,
  loadSentenceLevel,
  resolveSentenceLevel,
  saveSentenceLevel,
} from '../sentenceLevel';

const item = (id: string, exampleEs?: string, exampleEn?: string): PcicItem => ({
  id, es: id, en: id, kind: 'word', section: 'Test', order: 0, exampleEs, exampleEn,
});

const BY_LEVEL = {
  A1: [item('a1-w1', 'El gato.', 'The cat.'), item('a1-w2', 'El perro.', 'The dog.')],
  A2: [item('a2-w1')], // a word with no example sentence
  B1: [item('b1-w1', 'La casa.')], // no English side: no sentence pair for the en→es prompt
  B2: [item('b2-w1', 'El pan.', 'The bread.')],
  C1: [],
} as const;
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
const itemsFor = (level: (typeof LEVELS)[number]): readonly PcicItem[] => BY_LEVEL[level];

describe('levelsWithSentences', () => {
  it('lists only the levels that have a full sentence pair for the target, in level order', () => {
    expect(levelsWithSentences(LEVELS, itemsFor, 'es')).toEqual(['A1', 'B2']);
  });

  it('is empty when no level has one', () => {
    expect(levelsWithSentences(['A2', 'C1'], itemsFor, 'es')).toEqual([]);
  });
});

describe('resolveSentenceLevel', () => {
  it('keeps a saved level that has sentences', () => {
    expect(resolveSentenceLevel('B2', ['A1', 'B2'])).toBe('B2');
  });

  it('falls back to every level for a level without sentences, a wrong value or nothing saved', () => {
    expect(resolveSentenceLevel('C1', ['A1', 'B2'])).toBe(ALL_LEVELS);
    expect(resolveSentenceLevel('all', ['A1', 'B2'])).toBe(ALL_LEVELS);
    expect(resolveSentenceLevel('B3', ['A1', 'B2'])).toBe(ALL_LEVELS);
    expect(resolveSentenceLevel(42, ['A1', 'B2'])).toBe(ALL_LEVELS);
    expect(resolveSentenceLevel(null, ['A1', 'B2'])).toBe(ALL_LEVELS);
  });
});

describe('itemsForSentenceLevel', () => {
  it('all = every level\'s items in level order (what the tab served before the picker)', () => {
    expect(itemsForSentenceLevel('all', LEVELS, itemsFor).map((i) => i.id)).toEqual(['a1-w1', 'a1-w2', 'a2-w1', 'b1-w1', 'b2-w1']);
  });

  it('a level = only that level\'s items', () => {
    expect(itemsForSentenceLevel('B2', LEVELS, itemsFor).map((i) => i.id)).toEqual(['b2-w1']);
    expect(itemsForSentenceLevel('A1', LEVELS, itemsFor).map((i) => i.id)).toEqual(['a1-w1', 'a1-w2']);
  });
});

describe('the saved choice', () => {
  it('reads back per language pair, and "all" removes it', async () => {
    const db = getDb();
    expect(await loadSentenceLevel(db, 'en→es')).toBeNull();
    await saveSentenceLevel(db, 'en→es', 'B2');
    expect(await loadSentenceLevel(db, 'en→es')).toBe('B2');
    // another pair has its own choice
    expect(await loadSentenceLevel(db, 'es→en')).toBeNull();
    await saveSentenceLevel(db, 'es→en', 'A2');
    expect(await loadSentenceLevel(db, 'en→es')).toBe('B2');
    expect(await loadSentenceLevel(db, 'es→en')).toBe('A2');
    await saveSentenceLevel(db, 'en→es', ALL_LEVELS);
    expect(await loadSentenceLevel(db, 'en→es')).toBeNull();
    expect(await loadSentenceLevel(db, 'es→en')).toBe('A2');
    await saveSentenceLevel(db, 'es→en', ALL_LEVELS);
  });
});
