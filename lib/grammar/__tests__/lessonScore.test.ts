// FB328 (grammar-syllabus): the per-lesson correct-percent badge's pure math.

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

// FB415 / FB420 / FB421 (PLAN-fb0929 4. lépés): a lecke %-a az összes fajta átlaga.
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
  it('null, ha a fajtát még nem kezdte el', () => {
    expect(kindPercent(NO_KIND_PROGRESS)).toBeNull();
  });

  it('a 10-ből 3 jó félbehagyott kör 30% (a meg nem válaszolt tétel 0)', () => {
    expect(kindPercent(withRun(3, 10))).toBe(30);
  });

  it('a jobb eredmény felülírja a régit: a félbehagyott kör nem viszi le a legjobbat', () => {
    expect(kindPercent({ ...withRun(3, 10), best: { correct: 9, total: 10 } })).toBe(90);
  });

  it('a folytatott kör feljavítja: 3 jó -> 7 jó a 10-ből', () => {
    expect(kindPercent(withRun(7, 10, 8))).toBe(70);
  });

  it('a régi kumulált számláló csak tartalék', () => {
    expect(kindPercent({ ...NO_KIND_PROGRESS, legacy: { correct: 15, total: 20 } })).toBe(75);
    expect(kindPercent({ ...withBest(5, 10), legacy: { correct: 20, total: 20 } })).toBe(50);
  });
});

describe('lessonScore (FB415)', () => {
  it('null, ha egyik fajtához sem nyúlt', () => {
    expect(lessonScore([NO_KIND_PROGRESS, NO_KIND_PROGRESS, NO_KIND_PROGRESS, NO_KIND_PROGRESS])).toBeNull();
  });

  it('csak a 2. feladat kész 100%-on a négyből: a lecke 25%, nem 100%', () => {
    expect(lessonScore([NO_KIND_PROGRESS, withBest(6, 6), NO_KIND_PROGRESS, NO_KIND_PROGRESS])).toBe(25);
  });

  it('a meg nem csinált fajta 0-nak számít az átlagban', () => {
    expect(lessonScore([withBest(10, 10), withBest(5, 10), NO_KIND_PROGRESS, NO_KIND_PROGRESS])).toBe(38); // 150/4
  });

  it('minden fajta kész: az átlag', () => {
    expect(lessonScore([withBest(10, 10), withBest(8, 10)])).toBe(90);
  });

  it('üres fajta-lista: null', () => {
    expect(lessonScore([])).toBeNull();
  });
});

describe('betterBest (FB421)', () => {
  it('az első befejezett kör lesz a legjobb', () => {
    expect(betterBest(null, { correct: 3, total: 10 })).toEqual({ correct: 3, total: 10 });
  });
  it('a jobb új eredmény felülír', () => {
    expect(betterBest({ correct: 3, total: 10 }, { correct: 8, total: 10 })).toEqual({ correct: 8, total: 10 });
  });
  it('a gyengébb új eredmény nem ír felül', () => {
    expect(betterBest({ correct: 9, total: 10 }, { correct: 4, total: 10 })).toEqual({ correct: 9, total: 10 });
  });
});

describe('runSummary', () => {
  it('"3/10 · 30%" adatai', () => {
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

  it('kiolvassa a best/run/legacy sorokat egy fajtához', () => {
    expect(kindProgressFromRows(rows, 'ser-estar', 'choice').best).toEqual({ correct: 8, total: 10 });
    expect(kindProgressFromRows(rows, 'ser-estar', 'match').run?.index).toBe(1);
    expect(kindProgressFromRows(rows, 'ser-estar', 'form').legacy).toEqual({ correct: 6, total: 10 });
    expect(kindProgressFromRows(rows, 'ser-estar', 'why')).toEqual(NO_KIND_PROGRESS);
  });

  it('az összes létező fajta átlaga a lista-%: (80 + 25 + 60 + 0) / 4', () => {
    const scores = lessonScoresByTopic(rows, (id) => (id === 'ser-estar' ? ['choice', 'match', 'form', 'why'] : []));
    expect(scores.get('ser-estar')).toBe(41); // 165 / 4 = 41.25
  });

  it('a fajta-sor nélküli, régi témaszintű számláló a tartalék', () => {
    const scores = lessonScoresByTopic(rows, () => []);
    expect(scores.get('gustar')).toBe(100);
  });
});
