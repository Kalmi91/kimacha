import { touchCountsAsLearning } from '../usageRoutes';

describe('touchCountsAsLearning', () => {
  it('is false on the leaderboard and Settings tabs, true on every learning screen', () => {
    expect(touchCountsAsLearning(['(tabs)', 'board'])).toBe(false);
    expect(touchCountsAsLearning(['(tabs)', 'settings'])).toBe(false);
    for (const segs of [['(tabs)'], ['(tabs)', 'course'], ['(tabs)', 'sentences'], ['(tabs)', 'practice'], ['(tabs)', 'stats'], ['grammar', 'level-test'], ['exam'], []]) {
      expect(touchCountsAsLearning(segs)).toBe(true);
    }
  });
});
