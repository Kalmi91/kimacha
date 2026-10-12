// daily_xp in integer tenths (migrateDailyXpTenths + the native SQLiteDB methods) against
// a tiny stand-in for expo-sqlite that understands only the four daily_xp statements the
// code issues (matched by their normalised text). No real SQLite runs in jest, so this
// checks the wiring and the old-row conversion rules, not SQL syntax; the SQL itself was
// run against a real SQLite once when it was written.

type XpRow = { date: string; xp: number; xp_tenths?: number | null };
let rows: XpRow[] = [];
let hasTenthsColumn = false;
const norm = (sql: string) => sql.replace(/\s+/g, ' ').trim();

const mockFakeDb = {
  execAsync: jest.fn(async (sql: string) => {
    if (norm(sql) === 'ALTER TABLE daily_xp ADD COLUMN xp_tenths INTEGER') {
      if (hasTenthsColumn) throw new Error('duplicate column name: xp_tenths');
      hasTenthsColumn = true;
      for (const r of rows) r.xp_tenths = null;
      return;
    }
    throw new Error(`unexpected exec: ${sql}`);
  }),
  runAsync: jest.fn(async (sql: string, params: any[] = []) => {
    const s = norm(sql);
    if (s === 'UPDATE daily_xp SET xp_tenths = xp * 10 WHERE xp_tenths IS NULL') {
      for (const r of rows) if (r.xp_tenths == null) r.xp_tenths = r.xp * 10;
      return {};
    }
    if (s === 'INSERT INTO daily_xp (date, xp_tenths) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET xp_tenths = MAX(0, COALESCE(xp_tenths, xp * 10) + ?)') {
      const [date, first, delta] = params;
      const row = rows.find((r) => r.date === date);
      if (row) row.xp_tenths = Math.max(0, (row.xp_tenths ?? row.xp * 10) + delta);
      else rows.push({ date, xp: 0, xp_tenths: first });
      return {};
    }
    throw new Error(`unexpected run: ${sql}`);
  }),
  getFirstAsync: jest.fn(async (sql: string, params: any[] = []) => {
    if (norm(sql) !== 'SELECT COALESCE(xp_tenths, xp * 10) AS tenths FROM daily_xp WHERE date = ?') {
      throw new Error(`unexpected select: ${sql}`);
    }
    const row = rows.find((r) => r.date === params[0]);
    return row ? { tenths: row.xp_tenths ?? row.xp * 10 } : null;
  }),
};

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: async () => mockFakeDb }));
// open() runs runMigrations on the handle; the stand-in cannot run the whole schema script,
// so only that call is replaced and migrateDailyXpTenths stays real.
jest.mock('../db/migrations', () => ({
  ...jest.requireActual('../db/migrations'),
  runMigrations: async () => 'en-es',
}));

import { getDb } from '../database';
import { migrateDailyXpTenths } from '../db/migrations';

beforeEach(() => {
  rows = [];
  hasTenthsColumn = false;
  mockFakeDb.execAsync.mockClear();
  mockFakeDb.runAsync.mockClear();
});

describe('migrateDailyXpTenths', () => {
  it('adds the column and converts old whole-XP rows to tenths (x10)', async () => {
    rows = [{ date: '2026-10-10', xp: 7 }, { date: '2026-10-11', xp: 0 }, { date: '2026-10-12', xp: 63 }];
    await migrateDailyXpTenths(mockFakeDb as any);
    expect(rows.map((r) => r.xp_tenths)).toEqual([70, 0, 630]);
  });

  it('is idempotent: a second run (column exists) changes nothing, even after new 0.2 steps', async () => {
    rows = [{ date: '2026-10-10', xp: 7 }];
    await migrateDailyXpTenths(mockFakeDb as any);
    await getDb().addDailyXpTenths('2026-10-10', 2);
    await migrateDailyXpTenths(mockFakeDb as any);
    await migrateDailyXpTenths(mockFakeDb as any);
    expect(rows[0].xp_tenths).toBe(72);
    expect(await getDb().getDailyXpTenths('2026-10-10')).toBe(72);
  });

  it('works on an empty table and when the column already exists', async () => {
    hasTenthsColumn = true;
    await migrateDailyXpTenths(mockFakeDb as any);
    expect(rows).toEqual([]);
  });
});

describe('native daily_xp in tenths', () => {
  it('an unconverted old row reads as xp x 10, and the next write continues from it', async () => {
    hasTenthsColumn = true;
    rows = [{ date: '2026-10-09', xp: 4 }];
    expect(await getDb().getDailyXpTenths('2026-10-09')).toBe(40);
    expect(await getDb().addDailyXpTenths('2026-10-09', 30)).toBe(70);
  });

  it('5 x 0.2 XP (2 tenths) add up to exactly 10, an undo past zero stops at 0', async () => {
    hasTenthsColumn = true;
    for (let i = 0; i < 5; i++) await getDb().addDailyXpTenths('2026-10-13', 2);
    expect(await getDb().getDailyXpTenths('2026-10-13')).toBe(10);
    expect(await getDb().addDailyXpTenths('2026-10-13', -30)).toBe(0);
    expect(await getDb().getDailyXpTenths('2026-10-14')).toBe(0);
  });
});
