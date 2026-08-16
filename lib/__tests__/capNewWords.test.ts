import { capNewWords, newWordsLeftToday, newWordIntake, newWordWipCeiling } from '@/lib/newWordBudget';

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

// FB112/FB113/FB114: the 🌱 badge counts the DAILY budget only, so it falls by
// exactly one per new word started, never in jumps of four ("9 ből hirtelen 0
// lett nem így egyesével fogyott").
describe('newWordsLeftToday', () => {
  it('gives the full limit on a fresh day', () => {
    expect(newWordsLeftToday({ limit: 10, bonus: 0, startedToday: 0 })).toBe(10);
  });

  it('subtracts the words already started today, one for one', () => {
    expect(newWordsLeftToday({ limit: 10, bonus: 0, startedToday: 3 })).toBe(7);
  });

  it('adds the +5 bonus taps', () => {
    expect(newWordsLeftToday({ limit: 10, bonus: 5, startedToday: 10 })).toBe(5);
  });

  it('ignores the half-learned backlog', () => {
    expect(newWordsLeftToday({ limit: 10, bonus: 0, startedToday: 2, unlearned: 40 })).toBe(8);
  });

  it('never goes negative', () => {
    expect(newWordsLeftToday({ limit: 5, bonus: 0, startedToday: 9 })).toBe(0);
  });
});

// FB114/FB115: intake follows the Settings limit (it used to stall at 5 whatever
// the setting said), and pauses only when the half-learned pile is genuinely big.
describe('newWordIntake', () => {
  it('matches the daily countdown while the backlog is small', () => {
    expect(newWordIntake({ limit: 10, bonus: 0, startedToday: 0, unlearned: 5 })).toBe(10);
  });

  it('follows a raised Settings limit instead of stalling at the old default', () => {
    expect(newWordIntake({ limit: 25, bonus: 0, startedToday: 0, unlearned: 9 })).toBe(25);
  });

  it('pauses intake once the backlog reaches the WIP ceiling', () => {
    expect(newWordIntake({ limit: 10, bonus: 0, startedToday: 0, unlearned: 20 })).toBe(0);
  });

  it('lets the +5 bonus raise the ceiling too', () => {
    expect(newWordIntake({ limit: 10, bonus: 5, startedToday: 10, unlearned: 25 })).toBe(5);
  });

  it('treats a missing backlog count as no congestion', () => {
    expect(newWordIntake({ limit: 10, bonus: 0, startedToday: 4 })).toBe(6);
  });

  it('exposes the ceiling it uses', () => {
    expect(newWordWipCeiling(10, 5)).toBe(30);
  });
});
