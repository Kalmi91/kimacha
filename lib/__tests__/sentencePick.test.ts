// One round from the priority-ordered queue: the separate, shorter typed sentence (the most due words) and the builds
// (due priority, variety on top); a narrow pool gives way on variety, a single sentence is typed alone.

import { tileWords } from '@/lib/sentenceCards';
import { pickRound } from '@/lib/sentencePick';
import type { SentenceEntry } from '@/lib/sentenceTab';

const mk = (id: string, words: string[], dueN = 0): SentenceEntry => {
  const target = `${words.join(' ')}.`;
  const dueIds = Array.from({ length: dueN }, (_, k) => `${id}-d${k}`);
  return { itemId: id, source: '', target, wordCount: tileWords(target).length, wordIds: dueIds, due: dueN > 0, dueIds, staleness: '', slots: [] };
};
// n distinct filler words, so the sentence has n words and shares nothing with the others
const words = (id: string, n: number) => Array.from({ length: n }, (_, k) => `${id}${k}`);
const startOf = (e: SentenceEntry) => e.target.split(' ')[0].toLowerCase();
const ids = (list: SentenceEntry[]) => list.map((e) => e.itemId);
const SIZE = 4;

describe('pickRound', () => {
  it('no sentence: no round', () => {
    expect(pickRound([], 'en', SIZE)).toEqual({ builds: [], typed: null });
  });

  it('the typed sentence has the most due words and is shorter than every build; the builds follow the due priority', () => {
    const q = [
      mk('a', words('a', 3), 3),
      mk('b', words('b', 4), 2),
      mk('c', words('c', 5), 2),
      mk('d', words('d', 4), 1),
      mk('e', words('e', 5), 1),
      mk('f', words('f', 4), 0),
    ];
    const pick = pickRound(q, 'en', SIZE);
    expect(pick.typed!.itemId).toBe('a');
    expect(ids(pick.builds)).toEqual(['b', 'c', 'd', 'e']);
  });

  it('FB509: a long sentence with many due words is built, a shorter one with fewer is typed (the typed one is shorter than the shortest build)', () => {
    const q = [
      mk('x', words('x', 7), 3),
      mk('y', words('y', 6), 3),
      mk('t2', words('t', 4), 2),
      mk('b1', words('p', 5), 2),
      mk('b2', words('q', 5), 1),
      mk('b3', words('r', 6), 1),
      mk('b4', words('s', 5), 0),
      mk('t0', words('u', 2), 0),
    ];
    const pick = pickRound(q, 'en', SIZE);
    expect(pick.typed!.itemId).toBe('t2'); // the most due words among the sentences that still have 4 longer ones
    expect(ids(pick.builds)).toEqual(['x', 'y', 'b1', 'b2']);
    expect(ids(pick.builds)).not.toContain(pick.typed!.itemId);
    expect(pick.typed!.wordCount).toBeLessThan(Math.min(...pick.builds.map((e) => e.wordCount)));
  });

  it('FB504: not a majority of the round starts with the same word (an "I" corpus), the due priority holds inside', () => {
    const q = [
      mk('i0', ['I', 'run'], 3),
      mk('i1', ['I', 'eat', 'apples', 'every', 'day'], 3),
      mk('i2', ['I', 'drink', 'water', 'very', 'often'], 2),
      mk('i3', ['I', 'read', 'books', 'quite', 'slowly'], 2),
      mk('i4', ['I', 'write', 'letters', 'rather', 'neatly'], 1),
      mk('i5', ['I', 'sing', 'songs', 'really', 'badly'], 1),
      mk('x1', ['She', 'plays', 'chess', 'every', 'evening'], 1),
      mk('x2', ['They', 'watch', 'films', 'once', 'weekly'], 1),
      mk('x3', ['We', 'visit', 'parks', 'sometimes', 'alone'], 0),
      mk('x4', ['The', 'moon', 'glows', 'all', 'night'], 0),
    ];
    const pick = pickRound(q, 'en', SIZE);
    const round = [...pick.builds, pick.typed!];
    expect(round).toHaveLength(5);
    expect(pick.typed!.itemId).toBe('i0');
    expect(round.filter((e) => startOf(e) === 'i').length).toBeLessThanOrEqual(2);
    // the typed "I" sentence plus the "I" build with the most due words; the others by priority
    expect(ids(pick.builds)).toEqual(['i1', 'x1', 'x2', 'x3']);
  });

  it('a word (not a function word) is in at most 2 sentences of the round', () => {
    const q = [
      mk('t', ['tiny', 'ant', 'works'], 3),
      mk('a', ['red', 'house', 'stands', 'right', 'here'], 2),
      mk('b', ['big', 'house', 'costs', 'much', 'money'], 2),
      mk('c', ['old', 'house', 'needs', 'fresh', 'paint'], 2),
      mk('d', ['new', 'house', 'looks', 'really', 'great'], 2),
      mk('e', ['green', 'garden', 'grows', 'very', 'fast'], 1),
      mk('f', ['blue', 'river', 'flows', 'far', 'south'], 1),
      mk('g', ['high', 'tower', 'shines', 'very', 'bright'], 1),
    ];
    const pick = pickRound(q, 'en', SIZE);
    const round = [...pick.builds, pick.typed!];
    expect(round.filter((e) => e.target.includes('house')).length).toBe(2);
    expect(pick.typed!.itemId).toBe('t');
    expect(ids(pick.builds)).toEqual(['a', 'b', 'e', 'f']);
  });

  it('function words (the, is) do not count toward the 2-sentence limit', () => {
    const q = Array.from({ length: 7 }, (_, k) => mk(`s${k}`, [`first${k}`, 'is', 'the', `thing${k}`], 1));
    const pick = pickRound(q, 'en', SIZE);
    expect(pick.typed!.itemId).toBe('s0'); // all the same length: the first of the most due
    expect(ids(pick.builds)).toEqual(['s1', 's2', 's3', 's4']);
  });

  it('no sentence has four longer ones (all alike): the one with the most due words is typed', () => {
    const q = [3, 3, 2, 2, 1, 0].map((due, k) => mk(`s${k}`, words(`w${k}x`, 3), due));
    const pick = pickRound(q, 'en', SIZE);
    expect(pick.typed!.itemId).toBe('s0');
    expect(ids(pick.builds)).toEqual(['s1', 's2', 's3', 's4']);
  });

  it('a small pool: the shortest is typed, the others are built; one sentence is typed alone', () => {
    const three = [mk('a', ['aa', 'bb', 'cc', 'dd'], 1), mk('b', ['ee', 'ff'], 0), mk('c', ['gg', 'hh', 'ii'], 1)];
    const pick = pickRound(three, 'en', SIZE);
    expect(pick.typed!.itemId).toBe('b');
    expect(ids(pick.builds)).toEqual(['a', 'c']);
    const one = pickRound([mk('only', ['aa', 'bb'])], 'en', SIZE);
    expect(one.builds).toEqual([]);
    expect(one.typed!.itemId).toBe('only');
    // exactly the round size: still the shortest typed, no sentence both built and typed
    const four = pickRound([...three, mk('d', ['jj', 'kk', 'll', 'mm', 'nn'])], 'en', SIZE);
    expect(four.builds).toHaveLength(3);
    expect(ids(four.builds)).not.toContain(four.typed!.itemId);
  });

  it('variety gives way when the pool is too narrow, the due priority stays', () => {
    const q = Array.from({ length: 6 }, (_, k) => mk(`i${k}`, ['I', `verb${k}`, `noun${k}`, 'today'], 6 - k));
    const pick = pickRound(q, 'en', SIZE);
    expect(pick.typed!.itemId).toBe('i0');
    expect(ids(pick.builds)).toEqual(['i1', 'i2', 'i3', 'i4']);
  });
});
