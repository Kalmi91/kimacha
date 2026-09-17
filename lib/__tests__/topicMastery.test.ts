import { isWordMastered, masteredCount, isTopicMastered } from '../topicMastery';

// UTEMEZO 12/4 (2026-09-17): a `state`/`stateMap` paraméter mostantól a
// db.getWordStates()-től egy 1/0 "ismert" jelzőt kap (lap >= 3 OR buried),
// nem FSRS-állapotot. A régi FSRS-based teszteket (Review=2, Learning=1)
// felváltja az egyesített definíció.
describe('topicMastery', () => {
  it('not-known (0) is not mastered', () => {
    expect(isWordMastered(0)).toBe(false);
  });

  it('known (1) counts as mastered', () => {
    expect(isWordMastered(1)).toBe(true);
  });

  it('a word with no card yet is not mastered', () => {
    expect(isWordMastered(undefined)).toBe(false);
  });

  it('counts only known words', () => {
    const known = new Map([[1, 1], [2, 0], [3, 1], [4, 0]]);
    expect(masteredCount([1, 2, 3, 4], known)).toBe(2);
  });

  it('a topic is complete only when every word is known', () => {
    const known = new Map([[1, 1], [2, 1]]);
    expect(isTopicMastered([1, 2], known)).toBe(true);
    expect(isTopicMastered([1, 2, 3], known)).toBe(false);
  });

  it('the old reps>0 rule would have passed where the new one does not', () => {
    // Minden szó látva egyszer (reps>0), de egyik sem ismert (lap < 3, nem
    // eltemetve) => NEM kész.
    const known = new Map([[1, 0], [2, 0], [3, 0]]);
    expect(isTopicMastered([1, 2, 3], known)).toBe(false);
  });

  it('an empty topic is never complete', () => {
    expect(isTopicMastered([], new Map())).toBe(false);
  });
});
