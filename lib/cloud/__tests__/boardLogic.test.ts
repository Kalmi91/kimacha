// The pure decisions of the weekly XP board (cloud/logic.ts): the PUT /api/board/xp body filter, the `today` the client may name,
// the Monday of a week and the ranking. 2026-11-03 is a Tuesday, so its week runs 2026-11-02 .. 2026-11-08.
import {
  BOARD_JOINS_PER_DAY,
  BOARD_MAX_DAYS,
  BOARD_MAX_MINUTES,
  BOARD_MAX_ROWS,
  BOARD_MAX_TENTHS,
  BOARD_RETENTION_DAYS,
  BOARD_WINDOW_DAYS,
  boardToday,
  parseBoardDays,
  parseBoardMetric,
  parseBoardMinutes,
  parseBoardName,
  rankBoard,
  secondsToNextUtcDay,
  weekStartOf,
} from '../../../cloud/logic';
import type { BoardEntry } from '../../../cloud/logic';

const TODAY = '2026-11-03';

describe('board constants', () => {
  it('are the limits of the API contract', () => {
    expect([BOARD_MAX_TENTHS, BOARD_WINDOW_DAYS, BOARD_MAX_DAYS, BOARD_MAX_ROWS, BOARD_JOINS_PER_DAY, BOARD_RETENTION_DAYS]).toEqual([20000, 14, 20, 50, 10, 28]);
  });
});

describe('parseBoardName', () => {
  it('takes the name by the login name rule: 2..24 characters after trimming and collapsing', () => {
    expect(parseBoardName({ name: 'Mari' })).toBe('Mari');
    expect(parseBoardName({ name: '  Mari   Néni ' })).toBe('  Mari   Néni '); // as typed; the Worker normalizes it for display
    expect(parseBoardName({ name: 'ab' })).toBe('ab');
    expect(parseBoardName({ name: 'a'.repeat(24) })).not.toBeNull();
    expect(parseBoardName({ name: ' a ' })).toBeNull();
    expect(parseBoardName({ name: 'a'.repeat(25) })).toBeNull();
  });

  it('is null for a body without a usable name, and never throws', () => {
    for (const body of [null, undefined, 'Mari', 5, [], ['Mari'], {}, { name: 5 }, { name: null }, { name: ['Mari'] }, { nick: 'Mari' }]) {
      expect(parseBoardName(body)).toBeNull();
    }
  });
});

describe('parseBoardDays', () => {
  it('keeps good [date, tenths] pairs, sorted by date', () => {
    expect(parseBoardDays({ days: [['2026-11-03', 120], ['2026-11-01', 50]] }, TODAY)).toEqual([['2026-11-01', 50], ['2026-11-03', 120]]);
  });

  it('accepts an empty list (it clears the stored days)', () => {
    expect(parseBoardDays({ days: [] }, TODAY)).toEqual([]);
  });

  it('is null when the body or its days is not what the contract says', () => {
    for (const body of [null, undefined, 'x', 5, [], [['2026-11-03', 1]], {}, { days: null }, { days: 'x' }, { days: {} }, { days: 5 }, { day: [] }]) {
      expect(parseBoardDays(body, TODAY)).toBeNull();
    }
  });

  it('keeps the window edges: 14 days back from today (today included) and one day ahead', () => {
    const edge = ['2026-10-20', '2026-10-21', '2026-11-03', '2026-11-04', '2026-11-05'].map((d) => [d, 10]);
    expect(parseBoardDays({ days: edge }, TODAY)).toEqual([['2026-10-21', 10], ['2026-11-03', 10], ['2026-11-04', 10]]);
  });

  it('measures the window across a month and year end', () => {
    expect(parseBoardDays({ days: [['2026-12-18', 1], ['2026-12-19', 1], ['2027-01-02', 1], ['2027-01-03', 1]] }, '2027-01-01')).toEqual([
      ['2026-12-19', 1],
      ['2027-01-02', 1],
    ]);
    expect(parseBoardDays({ days: [['2024-02-15', 1], ['2024-02-16', 1], ['2024-03-01', 1], ['2024-03-02', 1]] }, '2024-02-29')).toEqual([
      ['2024-02-16', 1],
      ['2024-03-01', 1],
    ]);
  });

  it('clamps tenths to 0..BOARD_MAX_TENTHS and keeps the edges', () => {
    const days = [['2026-11-01', 25_000], ['2026-11-02', -5], ['2026-11-03', 20_000], ['2026-11-04', 0]];
    expect(parseBoardDays({ days }, TODAY)).toEqual([['2026-11-01', 20_000], ['2026-11-02', 0], ['2026-11-03', 20_000], ['2026-11-04', 0]]);
  });

  it('drops tenths that is not an integer (a fraction, a string, NaN, Infinity, null, a missing one)', () => {
    const days = [['2026-11-01', 1.5], ['2026-11-02', '12'], ['2026-11-03', NaN], ['2026-11-04', Infinity], ['2026-10-30', null], ['2026-10-31']];
    expect(parseBoardDays({ days }, TODAY)).toEqual([]);
  });

  it('drops dates that are not a real YYYY-MM-DD day', () => {
    const bad = ['2026-02-30', '2026-11-3', '20261103', '2026-11-03T00:00:00Z', ' 2026-11-03', '2026-13-01', '', 'abc', 20261103, null, undefined, {}];
    expect(parseBoardDays({ days: bad.map((d) => [d, 10]) }, TODAY)).toEqual([]);
  });

  it('drops entries that are not a pair at all, without throwing', () => {
    expect(parseBoardDays({ days: ['2026-11-03', 5, null, undefined, [], {}, { 0: '2026-11-03', 1: 5 }, [['2026-11-03', 5]]] }, TODAY)).toEqual([]);
  });

  it('keeps the last of a repeated date', () => {
    expect(parseBoardDays({ days: [['2026-11-03', 10], ['2026-11-02', 7], ['2026-11-03', 30], ['2026-11-03', 20]] }, TODAY)).toEqual([['2026-11-02', 7], ['2026-11-03', 20]]);
  });

  it('reads only the first BOARD_MAX_DAYS entries', () => {
    const junk = Array.from({ length: BOARD_MAX_DAYS - 1 }, () => ['nope', 1]);
    const days = [...junk, ['2026-11-01', 1], ['2026-11-02', 2], ['2026-11-03', 3]];
    expect(days.length).toBeGreaterThan(BOARD_MAX_DAYS);
    expect(parseBoardDays({ days }, TODAY)).toEqual([['2026-11-01', 1]]);
  });

  it('accepts every one of the window days (at most 15) when they all fit in the first BOARD_MAX_DAYS entries', () => {
    const days: [string, number][] = [];
    for (let i = 0; i < 15; i++) days.push([new Date(Date.UTC(2026, 9, 21 + i)).toISOString().slice(0, 10), i]);
    expect(parseBoardDays({ days }, TODAY)).toHaveLength(15);
  });

  it('drops everything, without throwing, when "today" is not a date', () => {
    for (const today of ['', 'x', '2026-02-30']) expect(parseBoardDays({ days: [['2026-11-03', 5]] }, today)).toEqual([]);
  });
});

describe('boardToday', () => {
  it('takes the client\'s day when it is a real date at most 1 day from the UTC day', () => {
    expect(boardToday('2026-11-02', TODAY)).toBe('2026-11-02');
    expect(boardToday('2026-11-03', TODAY)).toBe('2026-11-03');
    expect(boardToday('2026-11-04', TODAY)).toBe('2026-11-04');
  });

  it('falls back to the UTC day for a day 2 or more away', () => {
    expect(boardToday('2026-11-01', TODAY)).toBe(TODAY);
    expect(boardToday('2026-11-05', TODAY)).toBe(TODAY);
    expect(boardToday('2030-01-01', TODAY)).toBe(TODAY);
  });

  it('falls back for a missing, malformed or impossible parameter', () => {
    for (const p of [null, '', 'x', '2026-11-3', '2026-02-30', '2026-11-03 ', '2026-11-03T00:00']) expect(boardToday(p, TODAY)).toBe(TODAY);
  });

  it('works across the year end', () => {
    expect(boardToday('2026-12-31', '2027-01-01')).toBe('2026-12-31');
    expect(boardToday('2027-01-01', '2026-12-31')).toBe('2027-01-01');
    expect(boardToday('2027-01-02', '2026-12-31')).toBe('2026-12-31');
  });
});

describe('weekStartOf', () => {
  it.each([
    ['2026-11-03', '2026-11-02', 'a Tuesday'],
    ['2026-11-02', '2026-11-02', 'the Monday itself'],
    ['2026-11-08', '2026-11-02', 'a Sunday is the last day of its week'],
    ['2026-11-09', '2026-11-09', 'the next Monday starts a new week'],
    ['2027-01-01', '2026-12-28', 'a Friday, the week began in the old year'],
    ['2026-01-04', '2025-12-29', 'a Sunday, the week began in the old year'],
    ['2024-02-29', '2024-02-26', 'a leap day'],
    ['2024-03-03', '2024-02-26', 'a Sunday after a leap day'],
  ])('%s -> %s (%s)', (today, monday) => {
    expect(weekStartOf(today)).toBe(monday);
  });

  it('is empty, without throwing, when "today" is not a date', () => {
    for (const today of ['', 'x', '2026-02-30', '2026-11-3']) expect(weekStartOf(today)).toBe('');
  });
});

describe('secondsToNextUtcDay', () => {
  it('counts to the next 00:00 UTC: 1..86400', () => {
    const midnight = Date.UTC(2026, 10, 3);
    expect(secondsToNextUtcDay(midnight)).toBe(86_400);
    expect(secondsToNextUtcDay(midnight + 12 * 3_600_000)).toBe(43_200);
    expect(secondsToNextUtcDay(midnight + 86_400_000 - 1)).toBe(1);
    expect(secondsToNextUtcDay(midnight + 86_400_000 - 1500)).toBe(2); // rounded up
  });
});

describe('parseBoardMinutes', () => {
  it('filters like the XP days: real dates inside the window, whole minutes, clamped to one day, sorted', () => {
    const body = { minutes: [['2026-11-03', 25], ['2026-11-02', 99_999], ['2026-11-01', -5], ['2026-10-01', 40], ['2026-11-03', 30], ['x', 1], ['2026-11-02', 1.5], 'junk'] };
    expect(parseBoardMinutes(body, TODAY)).toEqual([['2026-11-01', 0], ['2026-11-02', BOARD_MAX_MINUTES], ['2026-11-03', 30]]);
  });

  it('is null (stored minutes stay) when the body has none or junk, never throwing: an old client', () => {
    for (const body of [null, undefined, 'x', {}, { days: [] }, { minutes: 'x' }, { minutes: {} }, { minutes: null }]) expect(parseBoardMinutes(body, TODAY)).toBeNull();
  });

  it('reads only the first BOARD_MAX_DAYS entries', () => {
    const minutes = Array.from({ length: 40 }, (_, i) => [`2026-11-${String((i % 3) + 1).padStart(2, '0')}`, i]);
    expect(parseBoardMinutes({ minutes }, TODAY)?.length).toBeLessThanOrEqual(3);
  });
});

describe('parseBoardMetric', () => {
  it('is time only for "time": anything else, or nothing (an old client), is XP', () => {
    expect(parseBoardMetric('time')).toBe('time');
    for (const p of [null, '', 'xp', 'TIME', 'minutes']) expect(parseBoardMetric(p)).toBe('xp');
  });
});

describe('rankBoard', () => {
  const WEEK = '2026-11-02';
  const entry = (owner: string, name: string, days: [string, number][] | string): BoardEntry => ({ owner, name, dailyXp: typeof days === 'string' ? days : JSON.stringify(days) });

  it('orders by XP descending and numbers the positions from 1', () => {
    const r = rankBoard([entry('d:a', 'Ana', [['2026-11-02', 100]]), entry('d:b', 'Bela', [['2026-11-03', 300]]), entry('d:c', 'Cili', [['2026-11-04', 200]])], WEEK, 'd:a');
    expect(r.rows).toEqual([
      { rank: 1, name: 'Bela', xp: 30, minutes: 0, me: false },
      { rank: 2, name: 'Cili', xp: 20, minutes: 0, me: false },
      { rank: 3, name: 'Ana', xp: 10, minutes: 0, me: true },
    ]);
    expect(r.me).toEqual({ rank: 3, xp: 10, minutes: 0, name: 'Ana' });
  });

  it('sums only the 7 days of the week (Monday to Sunday), not the neighbours', () => {
    const days: [string, number][] = [['2026-11-01', 9_000], ['2026-11-02', 10], ['2026-11-08', 20], ['2026-11-09', 9_000]];
    expect(rankBoard([entry('d:a', 'Ana', days)], WEEK, 'd:a').me).toEqual({ rank: 1, xp: 3, minutes: 0, name: 'Ana' });
  });

  it('adds the tenths first and rounds the XP once (0.5 rounds up)', () => {
    const r = rankBoard([entry('d:a', 'Ana', [['2026-11-02', 3], ['2026-11-03', 3]]), entry('d:b', 'Bela', [['2026-11-02', 125]]), entry('d:c', 'Cili', [['2026-11-02', 124]])], WEEK, 'd:a');
    expect(r.rows.map((x) => [x.name, x.xp])).toEqual([['Bela', 13], ['Cili', 12], ['Ana', 1]]);
  });

  it('breaks a tie by name, ignoring case and accents', () => {
    const d: [string, number][] = [['2026-11-02', 100]];
    const r = rankBoard([entry('d:1', 'Zoé', d), entry('d:2', 'bela', d), entry('d:3', 'Ádám', d), entry('d:4', 'Aron', d)], WEEK, 'none');
    expect(r.rows.map((x) => x.name)).toEqual(['Ádám', 'Aron', 'bela', 'Zoé']);
  });

  it('puts equal names (by that rule) in a fixed order, by owner', () => {
    const d: [string, number][] = [['2026-11-02', 100]];
    const a = rankBoard([entry('d:2', 'Ana', d), entry('d:1', 'ana', d)], WEEK, 'none');
    const b = rankBoard([entry('d:1', 'ana', d), entry('d:2', 'Ana', d)], WEEK, 'none');
    expect(a.rows.map((x) => x.name)).toEqual(['ana', 'Ana']);
    expect(b.rows.map((x) => x.name)).toEqual(['ana', 'Ana']);
  });

  it('leaves out players with 0 XP this week (none pushed, or only other weeks)', () => {
    const r = rankBoard([entry('d:a', 'Ana', [['2026-11-02', 10]]), entry('d:b', 'Bela', []), entry('d:c', 'Cili', [['2026-10-30', 500]]), entry('d:d', 'Dani', [['2026-11-03', 0]])], WEEK, 'd:a');
    expect(r.rows.map((x) => x.name)).toEqual(['Ana']);
  });

  it('keeps the caller with 0 XP, last, with the rank of that position', () => {
    const r = rankBoard([entry('d:z', 'Zita', []), entry('d:a', 'Ana', [['2026-11-02', 10]]), entry('d:b', 'Bela', [['2026-11-03', 20]])], WEEK, 'd:z');
    expect(r.rows).toEqual([
      { rank: 1, name: 'Bela', xp: 2, minutes: 0, me: false },
      { rank: 2, name: 'Ana', xp: 1, minutes: 0, me: false },
      { rank: 3, name: 'Zita', xp: 0, minutes: 0, me: true },
    ]);
    expect(r.me).toEqual({ rank: 3, xp: 0, minutes: 0, name: 'Zita' });
  });

  it('is only the caller on an empty week, and nobody for an empty board', () => {
    expect(rankBoard([entry('d:z', 'Zita', [])], WEEK, 'd:z')).toEqual({ rows: [{ rank: 1, name: 'Zita', xp: 0, minutes: 0, me: true }], me: { rank: 1, xp: 0, minutes: 0, name: 'Zita' } });
    expect(rankBoard([], WEEK, 'd:z')).toEqual({ rows: [], me: null });
  });

  it('has me null when no entry belongs to the caller, and marks no row', () => {
    const r = rankBoard([entry('d:a', 'Ana', [['2026-11-02', 10]])], WEEK, 'd:nobody');
    expect(r.me).toBeNull();
    expect(r.rows.some((x) => x.me)).toBe(false);
  });

  it('lists the first BOARD_MAX_ROWS rows, and still gives a caller below them the true rank', () => {
    const many = Array.from({ length: 60 }, (_, i) => entry('d:' + i, 'P' + String(i).padStart(2, '0'), [['2026-11-02', 1000 - i * 10]]));
    const r = rankBoard([...many, entry('d:me', 'Zed', [])], WEEK, 'd:me');
    expect(r.rows).toHaveLength(BOARD_MAX_ROWS);
    expect(r.rows[0]).toEqual({ rank: 1, name: 'P00', xp: 100, minutes: 0, me: false });
    expect(r.rows[BOARD_MAX_ROWS - 1].rank).toBe(BOARD_MAX_ROWS);
    expect(r.rows.some((x) => x.me)).toBe(false);
    expect(r.me).toEqual({ rank: 61, xp: 0, minutes: 0, name: 'Zed' });
  });

  it('reads damaged stored days as nothing, without throwing', () => {
    const bad = ['', 'not json', '{}', 'null', '5', '"x"', '[1,"a",["2026-11-02","5"],["2026-11-02",null],["2026-11-02",{}],[5,5],[]]'];
    const r = rankBoard(bad.map((s, i) => entry('d:' + i, 'P' + i, s)).concat(entry('d:ok', 'Ok', [['2026-11-02', 70]])), WEEK, 'd:ok');
    expect(r.rows).toEqual([{ rank: 1, name: 'Ok', xp: 7, minutes: 0, me: true }]);
  });

  it('counts the good entries around damaged ones', () => {
    const r = rankBoard([entry('d:a', 'Ana', '[1,["2026-11-02","5"],["2026-11-02",40],null,["2026-11-03",20]]')], WEEK, 'd:a');
    expect(r.me).toEqual({ rank: 1, xp: 6, minutes: 0, name: 'Ana' });
  });

  it('gives nobody XP, without throwing, when the week start is not a date', () => {
    const r = rankBoard([entry('d:a', 'Ana', [['2026-11-02', 100]]), entry('d:b', 'Bela', [])], '', 'd:b');
    expect(r.rows).toEqual([{ rank: 1, name: 'Bela', xp: 0, minutes: 0, me: true }]);
  });

  describe('by learning minutes', () => {
    const withMinutes = (owner: string, name: string, xp: [string, number][], minutes: [string, number][] | string | undefined): BoardEntry => ({
      owner,
      name,
      dailyXp: JSON.stringify(xp),
      ...(minutes === undefined ? {} : { dailyMinutes: typeof minutes === 'string' ? minutes : JSON.stringify(minutes) }),
    });

    it('ranks by the week minutes, not XP, and gives both figures on every row and on me', () => {
      const r = rankBoard(
        [
          withMinutes('d:a', 'Ana', [['2026-11-02', 900]], [['2026-11-02', 20]]),
          withMinutes('d:b', 'Bela', [['2026-11-02', 100]], [['2026-11-02', 50], ['2026-11-03', 25]]),
          withMinutes('d:c', 'Cili', [['2026-11-02', 500]], [['2026-11-04', 40]]),
        ],
        WEEK,
        'd:a',
        'time',
      );
      expect(r.rows).toEqual([
        { rank: 1, name: 'Bela', xp: 10, minutes: 75, me: false },
        { rank: 2, name: 'Cili', xp: 50, minutes: 40, me: false },
        { rank: 3, name: 'Ana', xp: 90, minutes: 20, me: true },
      ]);
      expect(r.me).toEqual({ rank: 3, xp: 90, minutes: 20, name: 'Ana' });
    });

    it('leaves out players with 0 minutes (an old client pushed none) except the caller, who stands last', () => {
      const r = rankBoard([withMinutes('d:a', 'Ana', [['2026-11-02', 900]], undefined), withMinutes('d:b', 'Bela', [['2026-11-02', 10]], [['2026-11-02', 5]])], WEEK, 'd:a', 'time');
      expect(r.rows.map((x) => [x.rank, x.name, x.minutes])).toEqual([[1, 'Bela', 5], [2, 'Ana', 0]]);
      expect(rankBoard([withMinutes('d:a', 'Ana', [['2026-11-02', 900]], undefined)], WEEK, 'd:b', 'time').rows).toEqual([]);
    });

    it('sums only the week, breaks ties by name, and reads damaged minutes as 0', () => {
      const r = rankBoard(
        [
          withMinutes('d:1', 'Zoé', [], [['2026-11-01', 500], ['2026-11-02', 10], ['2026-11-09', 500]]),
          withMinutes('d:2', 'Ádám', [], [['2026-11-08', 10]]),
          withMinutes('d:3', 'Bad', [], 'not json'),
          withMinutes('d:4', 'Bad2', [], '[1,["2026-11-02","5"],null]'),
        ],
        WEEK,
        'none',
        'time',
      );
      expect(r.rows.map((x) => [x.name, x.minutes])).toEqual([['Ádám', 10], ['Zoé', 10]]);
    });

    it('keeps the XP ranking the default', () => {
      const e = [withMinutes('d:a', 'Ana', [['2026-11-02', 900]], [['2026-11-02', 1]]), withMinutes('d:b', 'Bela', [['2026-11-02', 10]], [['2026-11-02', 99]])];
      expect(rankBoard(e, WEEK, 'd:a').rows.map((x) => x.name)).toEqual(['Ana', 'Bela']);
      expect(rankBoard(e, WEEK, 'd:a', 'time').rows.map((x) => x.name)).toEqual(['Bela', 'Ana']);
    });
  });
});
