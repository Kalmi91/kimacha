import { capNewWords, newWordsLeftToday, newWordIntake, newWordPauseReason } from '@/lib/newWordBudget';

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
// exactly one at a time, never in jumps of four ("9 ből hirtelen 0 lett nem így
// egyesével fogyott"). FB210: what makes it fall is a word LEARNED, not met.
describe('newWordsLeftToday', () => {
  it('gives the full limit on a fresh day', () => {
    expect(newWordsLeftToday({ limit: 10, bonus: 0, learnedToday: 0 })).toBe(10);
  });

  it('subtracts the words learned today, one for one', () => {
    expect(newWordsLeftToday({ limit: 10, bonus: 0, learnedToday: 3 })).toBe(7);
  });

  it('adds the +5 bonus taps', () => {
    expect(newWordsLeftToday({ limit: 10, bonus: 5, learnedToday: 10 })).toBe(5);
  });

  it('does not fall for a word that is only half-learned (FB210)', () => {
    expect(newWordsLeftToday({ limit: 10, bonus: 0, learnedToday: 0, unlearned: 4 })).toBe(10);
  });

  it('never goes negative', () => {
    expect(newWordsLeftToday({ limit: 5, bonus: 0, learnedToday: 9 })).toBe(0);
  });
});

// FB114/FB115: intake follows the Settings limit (it used to stall at 5 whatever
// the setting said). FB210: it hands out only what the day still allows MINUS the
// words already in hand and not yet learned, so the day's total stays at the
// limit however many of them are still half-done.
describe('newWordIntake', () => {
  it('matches the daily countdown on a clean start', () => {
    expect(newWordIntake({ limit: 10, bonus: 0, learnedToday: 0, unlearned: 0 })).toBe(10);
  });

  it('follows a raised Settings limit instead of stalling at the old default', () => {
    expect(newWordIntake({ limit: 25, bonus: 0, learnedToday: 0, unlearned: 0 })).toBe(25);
  });

  it('leaves room only for what is not already in hand', () => {
    expect(newWordIntake({ limit: 10, bonus: 0, learnedToday: 0, unlearned: 4 })).toBe(6);
  });

  it('stops handing out new words while the budget is all in hand (FB210)', () => {
    expect(newWordIntake({ limit: 5, bonus: 0, learnedToday: 0, unlearned: 5 })).toBe(0);
  });

  it('opens up again as those words are learned', () => {
    // Two of the five have been learned: budget 3 left, 3 still in hand → nothing
    // new yet; once one of those is learned too, the next word can come.
    expect(newWordIntake({ limit: 5, bonus: 0, learnedToday: 2, unlearned: 3 })).toBe(0);
    expect(newWordIntake({ limit: 5, bonus: 0, learnedToday: 3, unlearned: 1 })).toBe(1);
  });

  it('treats a missing in-hand count as nothing in hand', () => {
    expect(newWordIntake({ limit: 10, bonus: 0, learnedToday: 4 })).toBe(6);
  });
});

// FB140/FB142: a congested pause used to swallow the "+N új szó" tap as well,
// so the button could be pressed forever without a single new word arriving.
describe('newWordIntake under congestion', () => {
  it('still pauses the standing limit while the pile is bigger than the budget', () => {
    expect(newWordIntake({ limit: 5, bonus: 0, learnedToday: 0, unlearned: 40 })).toBe(0);
  });

  it('honours an explicit bonus tap even while congested', () => {
    expect(newWordIntake({ limit: 5, bonus: 5, learnedToday: 0, unlearned: 40 })).toBe(5);
  });

  it('never hands out more than the day still allows', () => {
    expect(newWordIntake({ limit: 5, bonus: 5, learnedToday: 8, unlearned: 40 })).toBe(2);
  });

  it('the bonus runs out with the day, it does not reopen the pause', () => {
    expect(newWordIntake({ limit: 5, bonus: 5, learnedToday: 10, unlearned: 40 })).toBe(0);
  });
});

describe('newWordPauseReason', () => {
  it('reports no pause while new words flow', () => {
    expect(newWordPauseReason({ limit: 5, bonus: 0, learnedToday: 0, unlearned: 0 })).toBe('none');
  });

  it('separates the half-learned congestion from a spent daily budget', () => {
    expect(newWordPauseReason({ limit: 5, bonus: 0, learnedToday: 0, unlearned: 40 })).toBe('congested');
    expect(newWordPauseReason({ limit: 5, bonus: 0, learnedToday: 5, unlearned: 0 })).toBe('daily-limit');
  });

  it('calls a spent budget spent even when the pile is also over the budget', () => {
    expect(newWordPauseReason({ limit: 5, bonus: 0, learnedToday: 5, unlearned: 40 })).toBe('daily-limit');
  });
});
