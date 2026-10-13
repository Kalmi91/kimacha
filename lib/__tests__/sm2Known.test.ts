import { sm2NewCard, sm2Review, sm2MarkKnown, addDays } from '../sm2';
import { countLearned } from '../pcicStats';

const TODAY = '2026-09-18';

describe('known flag and a lapse', () => {
  it('a known card failed with "again" is no longer known', () => {
    const known = sm2MarkKnown(sm2NewCard('b1-0001'), addDays(TODAY, -30));
    expect(known.known).toBe(true);
    const lapsed = sm2Review(known, 'again', TODAY);
    expect(lapsed.known).toBe(false);
    expect(lapsed.state).toBe('learning');
  });

  it('countLearned does not count a lapsed known card, but counts it again after relearning', () => {
    const known = sm2MarkKnown(sm2NewCard('b1-0001'), addDays(TODAY, -30));
    expect(countLearned([known])).toBe(1);
    const lapsed = sm2Review(known, 'again', TODAY);
    expect(countLearned([lapsed])).toBe(0);
    const relearned = sm2Review(lapsed, 'good', TODAY);
    expect(relearned.state).toBe('review');
    expect(countLearned([relearned])).toBe(1);
  });

  it('good, hard and easy keep the known flag', () => {
    const known = sm2MarkKnown(sm2NewCard('b1-0001'), addDays(TODAY, -30));
    for (const grade of ['good', 'hard', 'easy'] as const) {
      expect(sm2Review(known, grade, TODAY).known).toBe(true);
    }
  });
});
