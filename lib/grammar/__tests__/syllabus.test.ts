// A grammar topic is "done" only if every kind that EXISTS in its
// lesson has a done (>=80%) row; the old, single-value
// rows mean everything is done (backward compatibility).

import { doneGrammarTopicProgress } from '../syllabus';

describe('doneGrammarTopicProgress', () => {
  // hay-estar (es): 12 choice + 2 match + 0 form items, so it has exactly two kinds.
  it('needs every existing kind done, not just one', () => {
    const oneKindDone = [{ itemId: 'hay-estar:choice', state: 'done', data: { correct: 12, total: 12 } }];
    expect(doneGrammarTopicProgress('es', oneKindDone).has('hay-estar')).toBe(false);

    const bothKindsDone = [
      ...oneKindDone,
      { itemId: 'hay-estar:match', state: 'done', data: { correct: 2, total: 2 } },
    ];
    expect(doneGrammarTopicProgress('es', bothKindsDone).has('hay-estar')).toBe(true);
  });

  it('treats an old single-value row as every kind done', () => {
    const legacyRow = [{ itemId: 'ser-estar', state: 'done', data: { correct: 20, total: 25 } }];
    const result = doneGrammarTopicProgress('es', legacyRow);
    expect(result.get('ser-estar')).toEqual({ state: 'done', correct: 20, total: 25 });
  });
});
