// FB315 (NY9): a fókusz-lista modul-singleton (set/get/clear) és a
// known/total/done számítás, a lockState.test.ts mintájára.

import { clearFocusWords, focusProgress, getFocusWords, setFocusWords, type FocusWords } from '@/lib/focusWords';

describe('focusWords singleton', () => {
  afterEach(() => {
    clearFocusWords();
  });

  it('is null before anything is set', () => {
    expect(getFocusWords()).toBeNull();
  });

  it('set/get round-trips the same object', () => {
    const f: FocusWords = { topicId: 'indefinido-10-verbos', label: 'Indefinido', wordIds: [1, 2, 3] };
    setFocusWords(f);
    expect(getFocusWords()).toEqual(f);
  });

  it('clear resets to null', () => {
    setFocusWords({ topicId: 't', label: 'T', wordIds: [1] });
    clearFocusWords();
    expect(getFocusWords()).toBeNull();
  });
});

describe('focusProgress', () => {
  it('counts known words out of the total, not done', () => {
    expect(focusProgress([1, 2, 3], new Set([1]))).toEqual({ known: 1, total: 3, done: false });
  });

  it('done when every word is known', () => {
    expect(focusProgress([1, 2], new Set([1, 2]))).toEqual({ known: 2, total: 2, done: true });
  });

  it('0/0 counts as done', () => {
    expect(focusProgress([], new Set())).toEqual({ known: 0, total: 0, done: true });
  });
});
