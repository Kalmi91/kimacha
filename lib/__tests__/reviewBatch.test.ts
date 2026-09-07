// FB180, Kálmán 2026-09-07 (word:"the bedroom"): „5 szót írt de valójában 8 szó volt
// benne". The 🔁 badge sized the batch by one rule and counted it down by another, so
// the two drifted. These pin the single rule: new-ness belongs to the WORD, and both
// halves of the badge read the same set of new ids.

import { reviewBatchOf, reviewWordsLeft, type DueItem } from '../sessionQueue';

const item = (wordId: number, type: string, reps: number): DueItem =>
  ({ wordId, type, card: { reps } as any, word: {} as any, isTyping: false });

// One brand-new word (word + sentence + easy cards) next to two review words.
const queue: DueItem[] = [
  item(1, 'word', 0),
  item(1, 'sentence', 0),
  item(1, 'easy', 0),
  item(2, 'word', 3),
  item(2, 'sentence', 3),
  item(3, 'word', 5),
];

describe('reviewBatchOf', () => {
  it('counts review WORDS, not cards', () => {
    expect(reviewBatchOf(queue, 6).size).toBe(2);
  });

  it('does not count a new word\'s other cards as reviews', () => {
    expect(reviewBatchOf(queue, 6).newIds.has(1)).toBe(true);
    expect(reviewBatchOf(queue, 6).size).not.toBe(3);
  });

  it('splits the rest of the day into batches of the same size', () => {
    expect(reviewBatchOf(queue, 6).left).toBe(2); // 6 due, 2 in hand, 4 behind
    expect(reviewBatchOf(queue, 2).left).toBe(0);
  });

  it('reports no batches when the queue holds no review word', () => {
    const allNew = [item(1, 'word', 0), item(1, 'sentence', 0)];
    expect(reviewBatchOf(allNew, 0)).toMatchObject({ size: 0, left: 0 });
  });
});

describe('reviewWordsLeft', () => {
  const { newIds, size } = reviewBatchOf(queue, 6);

  it('starts out equal to the batch size, so the badge cannot lie', () => {
    expect(reviewWordsLeft(queue, 0, newIds)).toBe(size);
  });

  it('only drops when the last card of a review word is behind us', () => {
    expect(reviewWordsLeft(queue, 3, newIds)).toBe(2); // word 2 still has 2 cards
    expect(reviewWordsLeft(queue, 4, newIds)).toBe(2);
    expect(reviewWordsLeft(queue, 5, newIds)).toBe(1);
    expect(reviewWordsLeft(queue, 6, newIds)).toBe(0);
  });

  it('never counts the new word, wherever we are', () => {
    for (let i = 0; i <= queue.length; i++) {
      expect(reviewWordsLeft(queue, i, newIds)).toBeLessThanOrEqual(2);
    }
  });
});
