// FB328 (grammar-syllabus): the per-lesson correct-percent badge's pure math.

import { lessonPercent, lessonPercentsByTopic } from '../lessonScore';

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
