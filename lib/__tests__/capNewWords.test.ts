import { capNewWords, newWordAllowance } from '@/lib/newWordBudget';

// FB77: the daily new-word budget only trims brand-new WORD cards; reviews and
// sentence cards must always survive, and the order must not change.
const item = (type: string, reps: number, wordId: number) =>
  ({ wordId, type, card: { reps } as any, word: { id: wordId } as any, isTyping: false }) as any;

describe('capNewWords', () => {
  it('keeps only the first N new word cards', () => {
    const items = [item('word', 0, 1), item('word', 0, 2), item('word', 0, 3)];
    expect(capNewWords(items, 2).map(i => i.wordId)).toEqual([1, 2]);
  });

  it('never drops reviews or sentence cards', () => {
    const items = [item('word', 3, 1), item('sentence', 0, 2), item('word', 0, 3), item('word', 0, 4)];
    expect(capNewWords(items, 1).map(i => i.wordId)).toEqual([1, 2, 3]);
  });

  it('drops every new word when the budget is spent', () => {
    const items = [item('word', 0, 1), item('word', 2, 2)];
    expect(capNewWords(items, 0).map(i => i.wordId)).toEqual([2]);
  });

  it('treats a negative budget as zero', () => {
    expect(capNewWords([item('word', 0, 1)], -5)).toEqual([]);
  });
});

// FB103: the daily limit is no longer the only ceiling, words already started
// but not learned hold the next batch back.
describe('newWordAllowance', () => {
  it('gives the full limit on a fresh day with nothing half-learned', () => {
    expect(newWordAllowance({ limit: 5, bonus: 0, startedToday: 0, unlearned: 0 })).toBe(5);
  });

  it('subtracts the words already started today', () => {
    expect(newWordAllowance({ limit: 5, bonus: 0, startedToday: 3, unlearned: 0 })).toBe(2);
  });

  it('blocks new words while the earlier ones are still unlearned', () => {
    expect(newWordAllowance({ limit: 5, bonus: 0, startedToday: 0, unlearned: 5 })).toBe(0);
  });

  it('refills only as fast as the backlog clears', () => {
    expect(newWordAllowance({ limit: 5, bonus: 0, startedToday: 0, unlearned: 3 })).toBe(2);
  });

  it('lets the +5 bonus break through a full backlog', () => {
    expect(newWordAllowance({ limit: 5, bonus: 5, startedToday: 5, unlearned: 5 })).toBe(5);
  });

  it('never goes negative', () => {
    expect(newWordAllowance({ limit: 5, bonus: 0, startedToday: 9, unlearned: 40 })).toBe(0);
  });
});
