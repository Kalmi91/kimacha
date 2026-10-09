// Grammar-syllabus: the per-lesson correct-percent badge's pure math.

import { lessonBadgePercent, lessonPercent, lessonPercentsByTopic } from '../lessonScore';

describe('lessonPercent', () => {
  it('is null when nothing has been answered', () => {
    expect(lessonPercent(0, 0)).toBeNull();
  });

  it('rounds to the nearest whole percent', () => {
    expect(lessonPercent(3, 2)).toBe(67); // 66.6...
  });

  it('is 100 when every answer was correct', () => {
    expect(lessonPercent(12, 12)).toBe(100);
  });

  it('is a partial percent for a mixed result', () => {
    expect(lessonPercent(20, 15)).toBe(75);
  });
});

describe('lessonPercentsByTopic', () => {
  it('pairs up answered/correct rows for the same topic', () => {
    const rows = [
      { itemId: 'ser-estar:answered', state: 'count', data: 20 },
      { itemId: 'ser-estar:correct', state: 'count', data: 15 },
      { itemId: 'posesivos:answered', state: 'count', data: 12 },
      { itemId: 'posesivos:correct', state: 'count', data: 12 },
    ];
    const result = lessonPercentsByTopic(rows);
    expect(result.get('ser-estar')).toBe(75);
    expect(result.get('posesivos')).toBe(100);
  });

  it('ignores done/seen rows from the same game_progress table', () => {
    const rows = [
      { itemId: 'ser-estar:choice', state: 'done', data: { correct: 12, total: 12 } },
      { itemId: 'ser-estar:transform:seen', state: 'seen', data: { t1: 1 } },
      { itemId: 'ser-estar:answered', state: 'count', data: 20 },
      { itemId: 'ser-estar:correct', state: 'count', data: 10 },
    ];
    expect(lessonPercentsByTopic(rows)).toEqual(new Map([['ser-estar', 50]]));
  });

  it('treats a missing correct row as 0 (answered but none right yet)', () => {
    const rows = [{ itemId: 'gustar:answered', state: 'count', data: 5 }];
    expect(lessonPercentsByTopic(rows).get('gustar')).toBe(0);
  });

  it('is empty for no rows', () => {
    expect(lessonPercentsByTopic([])).toEqual(new Map());
  });
});

describe('lessonBadgePercent', () => {
  it('the cumulative percent wins over a round result', () => {
    expect(lessonBadgePercent(83, 10, 12)).toBe(83);
  });

  it('falls back to the round result when there is no cumulative percent', () => {
    expect(lessonBadgePercent(null, 10, 12)).toBe(83); // 10/12 rounded
  });

  it('is null when the round total is 0', () => {
    expect(lessonBadgePercent(null, 0, 0)).toBeNull();
  });

  it('is null when neither source has anything', () => {
    expect(lessonBadgePercent(null)).toBeNull();
  });
});

// A lesson's % is the average over all kinds.
import {
  betterBest,
  kindPercent,
  kindProgressFromRows,
  lessonScore,
  lessonScoresByTopic,
  NO_KIND_PROGRESS,
  runSummary,
  type KindProgress,
} from '../lessonScore';

const withBest = (correct: number, total: number): KindProgress => ({ ...NO_KIND_PROGRESS, best: { correct, total } });
const withRun = (correct: number, total: number, index = 3, items = 10): KindProgress => ({
  ...NO_KIND_PROGRESS,
  run: { seed: 1, ids: Array.from({ length: items }, (_, i) => `i${i}`), index, correct, total },
});

describe('kindPercent (FB421)', () => {
  it('null if the kind has not been started', () => {
    expect(kindPercent(NO_KIND_PROGRESS)).toBeNull();
  });

  it('3 right out of 10 in an abandoned round is 30% (the unanswered item counts 0)', () => {
    expect(kindPercent(withRun(3, 10))).toBe(30);
  });

  it('a better result overwrites the old one: an abandoned round does not lower the best', () => {
    expect(kindPercent({ ...withRun(3, 10), best: { correct: 9, total: 10 } })).toBe(90);
  });

  it('a continued round improves it: 3 right -> 7 right out of 10', () => {
    expect(kindPercent(withRun(7, 10, 8))).toBe(70);
  });

  it('the old cumulated counter is only a fallback', () => {
    expect(kindPercent({ ...NO_KIND_PROGRESS, legacy: { correct: 15, total: 20 } })).toBe(75);
    expect(kindPercent({ ...withBest(5, 10), legacy: { correct: 20, total: 20 } })).toBe(50);
  });
});

describe('lessonScore (FB415)', () => {
  it('null if no kind was touched', () => {
    expect(lessonScore([NO_KIND_PROGRESS, NO_KIND_PROGRESS, NO_KIND_PROGRESS, NO_KIND_PROGRESS])).toBeNull();
  });

  it('only the 2nd task is done at 100% of four: the lesson is 25%, not 100%', () => {
    expect(lessonScore([NO_KIND_PROGRESS, withBest(6, 6), NO_KIND_PROGRESS, NO_KIND_PROGRESS])).toBe(25);
  });

  it('a kind not done counts as 0 in the average', () => {
    expect(lessonScore([withBest(10, 10), withBest(5, 10), NO_KIND_PROGRESS, NO_KIND_PROGRESS])).toBe(38); // 150/4
  });

  it('every kind done: the average', () => {
    expect(lessonScore([withBest(10, 10), withBest(8, 10)])).toBe(90);
  });

  it('empty kind list: null', () => {
    expect(lessonScore([])).toBeNull();
  });
});

describe('betterBest (FB421)', () => {
  it('the first finished round becomes the best', () => {
    expect(betterBest(null, { correct: 3, total: 10 })).toEqual({ correct: 3, total: 10 });
  });
  it('a better new result overwrites', () => {
    expect(betterBest({ correct: 3, total: 10 }, { correct: 8, total: 10 })).toEqual({ correct: 8, total: 10 });
  });
  it('a weaker new result does not overwrite', () => {
    expect(betterBest({ correct: 9, total: 10 }, { correct: 4, total: 10 })).toEqual({ correct: 9, total: 10 });
  });
});

describe('runSummary', () => {
  it('data for "3/10 · 30%"', () => {
    expect(runSummary(withRun(3, 10).run!)).toEqual({ answered: 3, of: 10, percent: 30 });
  });
});

describe('kindProgressFromRows / lessonScoresByTopic', () => {
  const rows = [
    { itemId: 'ser-estar:choice:best', state: 'best', data: { correct: 8, total: 10 } },
    { itemId: 'ser-estar:match:run', state: 'run', data: { seed: 7, ids: ['a', 'b'], index: 1, correct: 3, total: 12 } },
    { itemId: 'ser-estar:form:answered', state: 'count', data: 10 },
    { itemId: 'ser-estar:form:correct', state: 'count', data: 6 },
    { itemId: 'ser-estar:choice', state: 'done', data: { correct: 8, total: 10 } },
    { itemId: 'gustar:answered', state: 'count', data: 5 },
    { itemId: 'gustar:correct', state: 'count', data: 5 },
  ];

  it('reads the best/run/legacy rows for a kind', () => {
    expect(kindProgressFromRows(rows, 'ser-estar', 'choice').best).toEqual({ correct: 8, total: 10 });
    expect(kindProgressFromRows(rows, 'ser-estar', 'match').run?.index).toBe(1);
    expect(kindProgressFromRows(rows, 'ser-estar', 'form').legacy).toEqual({ correct: 6, total: 10 });
    expect(kindProgressFromRows(rows, 'ser-estar', 'why')).toEqual(NO_KIND_PROGRESS);
  });

  it('the average of all existing kinds is the list %: (80 + 25 + 60 + 0) / 4', () => {
    const scores = lessonScoresByTopic(rows, (id) => (id === 'ser-estar' ? ['choice', 'match', 'form', 'why'] : []));
    expect(scores.get('ser-estar')).toBe(41); // 165 / 4 = 41.25
  });

  it('the old topic-level counter without kind rows is the fallback', () => {
    const scores = lessonScoresByTopic(rows, () => []);
    expect(scores.get('gustar')).toBe(100);
  });
});
