// A grammar topic is "done" only if every kind that EXISTS in its
// lesson has a done (>=80%) row; the old, single-value
// rows mean everything is done (backward compatibility).

import { getGrammarTopic, getGrammarTopicIds, grammarKindCounts, type GrammarKind, type GrammarTopicData } from '@/lib/games/content';
import { doneGrammarTopicProgress } from '../syllabus';

describe('doneGrammarTopicProgress', () => {
  // hay-estar (es): 12 choice + 2 match + 7 why + 0 form items, so it has exactly three kinds.
  it('needs every existing kind done, not just one', () => {
    const oneKindDone = [{ itemId: 'hay-estar:choice', state: 'done', data: { correct: 12, total: 12 } }];
    expect(doneGrammarTopicProgress('es', oneKindDone).has('hay-estar')).toBe(false);

    const twoKindsDone = [
      ...oneKindDone,
      { itemId: 'hay-estar:match', state: 'done', data: { correct: 2, total: 2 } },
    ];
    expect(doneGrammarTopicProgress('es', twoKindsDone).has('hay-estar')).toBe(false);

    const allKindsDone = [
      ...twoKindsDone,
      { itemId: 'hay-estar:why', state: 'done', data: { correct: 7, total: 7 } },
    ];
    expect(doneGrammarTopicProgress('es', allKindsDone).has('hay-estar')).toBe(true);
  });

  it('treats an old single-value row as every kind done', () => {
    const legacyRow = [{ itemId: 'ser-estar', state: 'done', data: { correct: 20, total: 25 } }];
    const result = doneGrammarTopicProgress('es', legacyRow);
    expect(result.get('ser-estar')).toEqual({ state: 'done', correct: 20, total: 25 });
  });
});

// A topic is done only when EVERY kind that exists in it (all nine, not just
// choice/match/form/transform) has a done row; kinds a topic does not have
// do not block it.
describe('doneGrammarTopicProgress, all nine task kinds', () => {
  const FOUR = ['choice', 'match', 'form', 'transform'];
  const ALL_NINE = ['choice', 'article', 'match', 'form', 'why', 'transform', 'spot', 'order', 'dictation'];
  const done = (topic: string, kinds: string[]) =>
    kinds.map((k) => ({ itemId: `${topic}:${k}`, state: 'done', data: { correct: 1, total: 1 } }));

  function kindsOf(lesson: GrammarTopicData): string[] {
    const counts = grammarKindCounts(lesson);
    return (Object.keys(counts) as GrammarKind[]).filter((k) => counts[k] > 0);
  }

  const lessons = (['es', 'en'] as const).flatMap((lang) =>
    getGrammarTopicIds(lang).map((id) => ({ lang, id, kinds: kindsOf(getGrammarTopic(lang, id)!) }))
  );

  it('some real lessons have a kind outside the old four (the test is not vacuous)', () => {
    expect(lessons.some((l) => l.kinds.some((k) => !FOUR.includes(k)))).toBe(true);
  });

  it('is done when every existing kind has a done row', () => {
    for (const l of lessons) {
      expect(doneGrammarTopicProgress(l.lang, done(l.id, l.kinds)).has(l.id)).toBe(true);
    }
  });

  it('is not done while any one existing kind (including article/why/spot/order/dictation) is missing', () => {
    for (const l of lessons) {
      for (const missing of l.kinds) {
        const rows = done(l.id, l.kinds.filter((k) => k !== missing));
        expect(doneGrammarTopicProgress(l.lang, rows).has(l.id)).toBe(false);
      }
    }
  });

  it('a done row of a kind the topic does not have changes nothing', () => {
    const l = lessons.find((x) => x.kinds.length > 0 && x.kinds.length < ALL_NINE.length)!;
    const absent = ALL_NINE.find((k) => !l.kinds.includes(k))!;
    expect(doneGrammarTopicProgress(l.lang, done(l.id, [...l.kinds, absent])).has(l.id)).toBe(true);
  });
});
