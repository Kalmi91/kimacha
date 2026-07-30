import { capNewWords } from '@/lib/newWordBudget';

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
