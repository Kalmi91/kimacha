// The sentences of one round from the priority-ordered queue (due priority, variety on top, in queue order); a narrow
// pool gives way on variety, a pool smaller than the round is taken whole.

import { tileWords } from '@/lib/sentenceCards';
import { pickSentences } from '@/lib/sentencePick';
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
const SIZE = 5;

describe('pickSentences', () => {
  it('no sentence: no round', () => {
    expect(pickSentences([], 'en', SIZE)).toEqual([]);
  });

  it('distinct sentences: the first ones of the queue, in queue order (the due priority holds)', () => {
    const q = Array.from({ length: 8 }, (_, k) => mk(`s${k}`, words(`w${k}x`, 3 + (k % 3)), 8 - k));
    expect(ids(pickSentences(q, 'en', SIZE))).toEqual(['s0', 's1', 's2', 's3', 's4']);
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
    const round = pickSentences(q, 'en', SIZE);
    expect(round).toHaveLength(5);
    expect(round.filter((e) => startOf(e) === 'i').length).toBeLessThanOrEqual(2);
    // the two "I" sentences with the most due words; the others by priority; still in queue order
    expect(ids(round)).toEqual(['i0', 'i1', 'x1', 'x2', 'x3']);
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
    const round = pickSentences(q, 'en', SIZE);
    expect(round.filter((e) => e.target.includes('house')).length).toBe(2);
    expect(ids(round)).toEqual(['t', 'a', 'b', 'e', 'f']);
  });

  it('function words (the, is) do not count toward the 2-sentence limit', () => {
    const q = Array.from({ length: 7 }, (_, k) => mk(`s${k}`, [`first${k}`, 'is', 'the', `thing${k}`], 1));
    expect(ids(pickSentences(q, 'en', SIZE))).toEqual(['s0', 's1', 's2', 's3', 's4']);
  });

  it('variety gives way when the pool is too narrow, the due priority stays', () => {
    const q = Array.from({ length: 6 }, (_, k) => mk(`i${k}`, ['I', `verb${k}`, `noun${k}`, 'today'], 6 - k));
    expect(ids(pickSentences(q, 'en', SIZE))).toEqual(['i0', 'i1', 'i2', 'i3', 'i4']);
  });

  it('a pool smaller than the round is taken whole, in queue order', () => {
    const three = [mk('a', ['aa', 'bb', 'cc', 'dd'], 1), mk('b', ['ee', 'ff'], 0), mk('c', ['gg', 'hh', 'ii'], 1)];
    expect(ids(pickSentences(three, 'en', SIZE))).toEqual(['a', 'b', 'c']);
    expect(ids(pickSentences([mk('only', ['aa', 'bb'])], 'en', SIZE))).toEqual(['only']);
  });

  it('a count of 1 or 2 still picks that many; the same-start limit is at least 1', () => {
    const q = [mk('i0', ['I', 'run'], 2), mk('i1', ['I', 'eat'], 1), mk('x', ['She', 'sings'], 0)];
    expect(ids(pickSentences(q, 'en', 1))).toEqual(['i0']);
    expect(ids(pickSentences(q, 'en', 2))).toEqual(['i0', 'x']); // half of 2 = 1 sentence per first word
  });
});
