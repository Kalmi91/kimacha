import type { BoardData } from '../board';
import { BOARD_LIST_MAX, BOTS, botDailyXp, botXpAt, withBots } from '../boardBots';
import { shiftDate } from '../boardStats';

const WEEK = '2026-11-02';
// local time on day `d` (0 = Monday) of the week starting 2026-11-02
const at = (d: number, h = 0, m = 0) => new Date(2026, 10, 2 + d, h, m);
const alone = (xp = 350, weekStart = WEEK): BoardData => ({ weekStart, rows: [{ rank: 1, name: 'Kálmán', xp, me: true }], me: { rank: 1, xp, name: 'Kálmán' } });

describe('botXpAt', () => {
  it('is deterministic: the same week, bot and time give the same XP', () => {
    for (const b of BOTS) expect(botXpAt(b, WEEK, 3, 14 * 60 + 7)).toBe(botXpAt(b, WEEK, 3, 14 * 60 + 7));
  });

  it('never goes down, checked every 30 minutes through the whole week and over each midnight', () => {
    for (const b of BOTS) {
      let last = 0;
      for (let d = 0; d < 7; d++) {
        for (let m = 0; m < 1440; m += 30) {
          const xp = botXpAt(b, WEEK, d, m);
          expect(xp).toBeGreaterThanOrEqual(last);
          last = xp;
        }
        last = botXpAt(b, WEEK, d, 1439);
        if (d < 6) expect(botXpAt(b, WEEK, d + 1, 0)).toBe(last);
      }
    }
  });

  it('everyone is at 0 at Monday 00:00', () => {
    for (const b of BOTS) expect(botXpAt(b, WEEK, 0, 0)).toBe(0);
  });

  it('at the end of a day the total is exactly the days so far, as a whole number', () => {
    for (const b of BOTS) {
      const daily = botDailyXp(b, WEEK);
      for (let d = 0; d < 7; d++) expect(botXpAt(b, WEEK, d, 1439)).toBe(Math.floor(daily.slice(0, d + 1).reduce((a, x) => a + x, 0)));
    }
  });

  it('a different week gives a different plan', () => {
    const other = shiftDate(WEEK, 7);
    expect(BOTS.some((b) => botXpAt(b, WEEK, 6, 1439) !== botXpAt(b, other, 6, 1439))).toBe(true);
  });

  it('a week lands within 0.8..1.2 of the weekly goal', () => {
    for (const b of BOTS) {
      const total = botDailyXp(b, WEEK).reduce((a, x) => a + x, 0);
      expect(total).toBeGreaterThanOrEqual(b.weekly * 0.8 - 1e-9);
      expect(total).toBeLessThanOrEqual(b.weekly * 1.2 + 1e-9);
    }
  });

  it('keeps the day index and the minute inside the week and the day', () => {
    const b = BOTS[0];
    expect(botXpAt(b, WEEK, 99, 5000)).toBe(botXpAt(b, WEEK, 6, 1439));
    expect(botXpAt(b, WEEK, -3, -10)).toBe(botXpAt(b, WEEK, 0, 0));
  });

  it('some days are rest days, and a week never rests all seven', () => {
    let rests = 0;
    for (let w = 0; w < 30; w++) {
      for (const b of BOTS) {
        const daily = botDailyXp(b, shiftDate(WEEK, 7 * w));
        expect(daily.some((x) => x > 0)).toBe(true);
        rests += daily.filter((x) => x === 0).length;
      }
    }
    expect(rests).toBeGreaterThan(0);
  });
});

describe('withBots', () => {
  it('a learner with 350 XP (50 a day) ends the week in the middle of the field, for 12 different weeks', () => {
    for (let w = 0; w < 12; w++) {
      const weekStart = shiftDate(WEEK, 7 * w);
      const out = withBots(alone(350, weekStart), new Date(2026, 10, 2 + 7 * w + 6, 23, 59));
      expect(out.me!.rank).toBeGreaterThanOrEqual(9);
      expect(out.me!.rank).toBeLessThanOrEqual(17);
      expect(out.rows.find((r) => r.me)!.rank).toBe(out.me!.rank);
    }
  });

  it('on Monday morning nobody has XP yet: only the real rows stay', () => {
    const out = withBots(alone(0), at(0, 6, 0));
    expect(out.rows).toEqual([{ rank: 1, name: 'Kálmán', xp: 0, me: true }]);
    expect(out.me).toEqual({ rank: 1, xp: 0, name: 'Kálmán' });
  });

  it('a real player whose name matches a bot (case ignored) pushes that bot out, and so does the caller', () => {
    const data: BoardData = {
      weekStart: WEEK,
      rows: [
        { rank: 1, name: 'DIEGO', xp: 5, me: false },
        { rank: 2, name: 'Kálmán', xp: 3, me: true },
      ],
      me: { rank: 2, xp: 3, name: 'Kálmán' },
    };
    const names = withBots(data, at(6, 23, 59)).rows.map((r) => r.name);
    expect(names.filter((n) => n.toLowerCase() === 'diego')).toEqual(['DIEGO']);
    const mine: BoardData = { weekStart: WEEK, rows: [{ rank: 1, name: 'Nyelvninja', xp: 1, me: true }], me: { rank: 1, xp: 1, name: 'Nyelvninja' } };
    expect(withBots(mine, at(6, 23, 59)).rows.filter((r) => r.name.toLowerCase() === 'nyelvninja')).toHaveLength(1);
  });

  it('the name key decides: case and padding fold, an accent does not (Luis and Luis with an accent are two names)', () => {
    const data: BoardData = {
      weekStart: WEEK,
      rows: [
        { rank: 1, name: '  tacolover ', xp: 1, me: false },
        { rank: 2, name: 'Luís', xp: 1, me: false },
      ],
      me: null,
    };
    const names = withBots(data, at(6, 23, 59)).rows.map((r) => r.name.trim().toLowerCase());
    expect(names.filter((n) => n === 'tacolover')).toHaveLength(1);
    expect(names).toContain('luís');
    expect(names).toContain('luis');
  });

  it('the order is the server one: XP descending, then the name ignoring case and accents; ranks are positions', () => {
    const luis = botXpAt(BOTS.find((b) => b.name === 'Luis')!, WEEK, 6, 1439);
    expect(luis).toBeGreaterThan(0);
    const data: BoardData = {
      weekStart: WEEK,
      rows: [
        { rank: 1, name: 'Zed', xp: luis, me: false },
        { rank: 2, name: 'Álvaro', xp: luis, me: false },
      ],
      me: null,
    };
    const out = withBots(data, at(6, 23, 59)).rows;
    const tied = out.filter((r) => r.xp === luis).map((r) => r.name);
    expect([...tied].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))).toEqual(tied);
    out.forEach((r, i) => expect(r.rank).toBe(i + 1));
    for (let i = 1; i < out.length; i++) expect(out[i - 1].xp).toBeGreaterThanOrEqual(out[i].xp);
  });

  it('me.rank counts the bots ahead even when the caller is below the 50-row cut', () => {
    const reals = Array.from({ length: 50 }, (_, i) => ({ rank: i + 1, name: `Real${String(i).padStart(2, '0')}`, xp: 5000 - i, me: false }));
    const now = at(6, 23, 59);
    const low = withBots({ weekStart: WEEK, rows: reals, me: { rank: 58, xp: 1, name: 'Late' } }, now);
    const ahead = BOTS.filter((b) => botXpAt(b, WEEK, 6, 1439) > 1).length;
    expect(ahead).toBeGreaterThan(0);
    expect(low.rows).toHaveLength(BOARD_LIST_MAX);
    expect(low.me!.rank).toBe(58 + ahead);
    // a caller above every bot gains nothing
    expect(withBots({ weekStart: WEEK, rows: reals, me: { rank: 58, xp: 4000, name: 'Late' } }, now).me!.rank).toBe(58);
  });

  it('the list is cut at 50 rows and ranked from 1', () => {
    const reals = Array.from({ length: 50 }, (_, i) => ({ rank: i + 1, name: `Real${String(i).padStart(2, '0')}`, xp: 5000 - i, me: false }));
    const out = withBots({ weekStart: WEEK, rows: reals, me: null }, at(6, 23, 59));
    expect(out.rows).toHaveLength(50);
    expect(out.rows.map((r) => r.rank)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
  });

  it('keeps `left`, `weekStart` and a null `me` as they came, and marks no bot as me', () => {
    const data: BoardData = { weekStart: WEEK, rows: [{ rank: 1, name: 'Ana', xp: 9, me: false }], me: null, left: true };
    const out = withBots(data, at(6, 23, 59));
    expect(out.left).toBe(true);
    expect(out.me).toBeNull();
    expect(out.weekStart).toBe(WEEK);
    expect(out.rows.some((r) => r.me)).toBe(false);
  });

  it('past Sunday midnight (a stale week) the bots stay at the end of the week, before Monday at its start', () => {
    const end = withBots(alone(1), at(6, 23, 59));
    // the real day index is 7 (Monday 00:05, the server still says the old week): nothing drops
    expect(withBots(alone(1), at(7, 0, 5))).toEqual(end);
    expect(withBots(alone(1), at(12, 14, 0))).toEqual(end);
    // before the week starts: day 0, minute 0 (everybody at 0)
    const before = withBots(alone(0), at(-1, 14, 0));
    expect(before.rows).toEqual([{ rank: 1, name: 'Kálmán', xp: 0, me: true }]);
  });

  it('is deterministic for the same data and time, and moves with the clock', () => {
    expect(withBots(alone(), at(3, 15, 0))).toEqual(withBots(alone(), at(3, 15, 0)));
    expect(withBots(alone(), at(3, 15, 0))).not.toEqual(withBots(alone(), at(6, 23, 59)));
  });
});
