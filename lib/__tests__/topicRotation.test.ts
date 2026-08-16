// FB135/FB136: a topic whose words are all started but not due yet leaves the
// session with an empty queue. These guard the rule that decides what the Done
// screen can offer instead.

import { countNewWords, nextTopicWithNewWords } from '../topicRotation';

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
