import { isWordMastered, masteredCount, isTopicMastered, MASTERED_STATE } from '../topicMastery';

describe('topicMastery', () => {
  it('New (0) and Learning (1) are not mastered', () => {
    expect(isWordMastered(0)).toBe(false);
    expect(isWordMastered(1)).toBe(false);
  });

  it('Review (2) and Relearning (3) count as mastered', () => {
    expect(isWordMastered(2)).toBe(true);
    expect(isWordMastered(3)).toBe(true);
  });

  it('a word with no card yet is not mastered', () => {
    expect(isWordMastered(undefined)).toBe(false);
  });

  it('counts only mastered words', () => {
    const states = new Map([[1, 2], [2, 1], [3, 3], [4, 0]]);
    expect(masteredCount([1, 2, 3, 4], states)).toBe(2);
  });

  it('a topic is complete only when every word left Learning', () => {
    const states = new Map([[1, 2], [2, 2]]);
    expect(isTopicMastered([1, 2], states)).toBe(true);
    expect(isTopicMastered([1, 2, 3], states)).toBe(false);
  });

  it('the old reps>0 rule would have passed where the new one does not', () => {
    // Minden szó látva egyszer (reps>0), de mind Learning-ben => NEM kész.
    const states = new Map([[1, 1], [2, 1], [3, 1]]);
    expect(isTopicMastered([1, 2, 3], states)).toBe(false);
  });

  it('an empty topic is never complete', () => {
    expect(isTopicMastered([], new Map())).toBe(false);
  });

  it('MASTERED_STATE is the FSRS Review state', () => {
    expect(MASTERED_STATE).toBe(2);
  });
});
