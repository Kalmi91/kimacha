// FB135/FB136: a topic whose words are all started but not due yet leaves the
// session with an empty queue. These guard the rule that decides what the Done
// screen can offer instead.

import { borrowNewWords, countNewWords, nextTopicWithNewWords } from '../topicRotation';

describe('countNewWords', () => {
  it('counts the words never answered', () => {
    const reps = new Map([
      [1, 3],
      [2, 0],
      [3, 1],
    ]);
    expect(countNewWords([1, 2, 3, 4], reps)).toBe(2); // id 2 (reps 0) and id 4 (absent)
  });

  it('is zero when every word has been started', () => {
    expect(countNewWords([1, 2], new Map([[1, 1], [2, 5]]))).toBe(0);
  });
});

describe('nextTopicWithNewWords', () => {
  const topics = [
    { id: 'colores', order: 4, newWords: 0 },
    { id: 'comida', order: 9, newWords: 7 },
    { id: 'ropa', order: 11, newWords: 3 },
  ];

  it('picks the earliest topic by curriculum order that still has new words', () => {
    expect(nextTopicWithNewWords(topics, 'colores')).toBe('comida');
  });

  it('skips the active topic even when it has new words', () => {
    const withNew = [{ id: 'colores', order: 4, newWords: 5 }, ...topics.slice(1)];
    expect(nextTopicWithNewWords(withNew, 'colores')).toBe('comida');
  });

  it('ignores order in the input array, only the order field counts', () => {
    const shuffled = [topics[2], topics[0], topics[1]];
    expect(nextTopicWithNewWords(shuffled, 'colores')).toBe('comida');
  });

  it('returns null when nothing is left to offer', () => {
    expect(nextTopicWithNewWords([{ id: 'colores', order: 4, newWords: 0 }], 'colores')).toBeNull();
    expect(nextTopicWithNewWords([], null)).toBeNull();
  });

  it('works with no active topic', () => {
    expect(nextTopicWithNewWords(topics, null)).toBe('comida');
  });
});

// FB139: "+15 új szó" must not stop at the active topic's supply.
describe('borrowNewWords (FB139)', () => {
  const candidates = [
    { id: 'colores', order: 3, newWordIds: [301, 302] },
    { id: 'comida', order: 7, newWordIds: [701, 702, 703] },
    { id: 'ropa', order: 6, newWordIds: [601] },
  ];

  it('takes nothing when the active topic already covers the need', () => {
    expect(borrowNewWords(candidates, 5, 0)).toEqual([]);
    expect(borrowNewWords(candidates, 5, -2)).toEqual([]);
  });

  it('fills the shortfall from the smallest leftovers first, distance breaking ties', () => {
    expect(borrowNewWords(candidates, 5, 3)).toEqual([
      { wordId: 601, topicId: 'ropa' },
      { wordId: 301, topicId: 'colores' },
      { wordId: 302, topicId: 'colores' },
    ]);
  });

  it('stops exactly at the shortfall', () => {
    expect(borrowNewWords(candidates, 5, 1)).toEqual([{ wordId: 601, topicId: 'ropa' }]);
  });

  it('walks on to the farther topics when the near ones run out', () => {
    expect(borrowNewWords(candidates, 5, 10).map(b => b.wordId)).toEqual([
      601, 301, 302, 701, 702, 703,
    ]);
  });

  // FB195, Kálmán 2026-09-09: „csak zavar, hogy az elozp A1 es szintből mindig
  // maradt 1-2 szó egy témakörből". A majdnem kész témák ürülnek elsőként, akkor is,
  // ha messzebb vannak, különben a maradékuk örökre ott ragad.
  it('drains a far topic with one word left before a near topic with many', () => {
    const spread = [
      { id: 'cerca', order: 5, newWordIds: [501, 502, 503, 504] },
      { id: 'lejos', order: 20, newWordIds: [2001] },
    ];
    expect(borrowNewWords(spread, 4, 2)).toEqual([
      { wordId: 2001, topicId: 'lejos' },
      { wordId: 501, topicId: 'cerca' },
    ]);
  });

  it('clears every straggler topic before touching a full one', () => {
    const stragglers = [
      { id: 'a', order: 1, newWordIds: [11, 12] },
      { id: 'b', order: 2, newWordIds: [21] },
      { id: 'c', order: 3, newWordIds: [31, 32, 33, 34, 35] },
    ];
    expect(borrowNewWords(stragglers, 3, 4).map((b2) => b2.topicId)).toEqual([
      'b', 'a', 'a', 'c',
    ]);
  });

  it('marks every word with the topic it came from', () => {
    expect(borrowNewWords(candidates, 5, 6).every(b => b.topicId.length > 0)).toBe(true);
  });
});
