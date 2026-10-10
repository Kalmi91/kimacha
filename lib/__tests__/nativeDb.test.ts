// The native SQLiteDB against a tiny in-memory stand-in for expo-sqlite: it
// understands only the handful of statements these tests reach (SELECT with
// one equality filter, COUNT, DELETE, INSERT), keyed by table name. No real
// SQLite runs in jest here, so this checks the wiring (which table, which
// column, which rows survive), not SQL syntax.

type Row = Record<string, any>;
const tables: Record<string, Row[]> = {};
const rowsOf = (t: string) => (tables[t] ??= []);

function select(sql: string, params: any[]): Row[] {
  const s = sql.replace(/\s+/g, ' ').trim();
  let m = s.match(/^SELECT COUNT\(\*\) AS n FROM (\w+) WHERE (\w+) = \?$/);
  if (m) return [{ n: rowsOf(m[1]).filter(r => r[m![2]] === params[0]).length }];
  m = s.match(/^SELECT ([\w, *]+) FROM (\w+)(?: WHERE (\w+) = (\?|\d+))?$/);
  if (!m) return [];
  const [, cols, table, whereCol, whereVal] = m;
  let rows = rowsOf(table);
  if (whereCol) {
    const want = whereVal === '?' ? params[0] : Number(whereVal);
    rows = rows.filter(r => r[whereCol] === want);
  }
  if (cols.trim() === '*') return rows.map(r => ({ ...r }));
  const names = cols.split(',').map(c => c.trim());
  return rows.map(r => Object.fromEntries(names.map(n => [n, r[n]])));
}

const mockFakeDb = {
  getAllAsync: jest.fn(async (sql: string, params: any[] = []) => select(sql, params)),
  getFirstAsync: jest.fn(async (sql: string, params: any[] = []) => select(sql, params)[0] ?? null),
  runAsync: jest.fn(async (sql: string, params: any[] = []) => {
    const s = sql.replace(/\s+/g, ' ').trim();
    let m = s.match(/^DELETE FROM (\w+)$/);
    if (m) {
      tables[m[1]] = [];
      return {};
    }
    m = s.match(/^INSERT INTO (\w+) \(([\w, ]+)\) VALUES/);
    if (m) {
      const cols = m[2].split(',').map(c => c.trim());
      rowsOf(m[1]).push(Object.fromEntries(cols.map((c, i) => [c, params[i]])));
    }
    return {};
  }),
  withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => fn()),
};

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: async () => mockFakeDb }));
jest.mock('../db/migrations', () => ({
  runMigrations: async () => 'en-es',
}));

import { getDb } from '../database';
import { validateBackupPayload } from '../backup';

beforeEach(() => {
  for (const t of Object.keys(tables)) delete tables[t];
});

const pcicRow = (item_id: string, introduced_at: string | null): Row => ({
  item_id,
  state: introduced_at ? 'learning' : 'new',
  step: 0,
  ease: 2.5,
  interval: 0,
  reps: 0,
  lapses: 0,
  due: introduced_at ?? '',
  last_review: null,
  introduced_at,
  known: 0,
});

describe('getDayStats (native db)', () => {
  it('counts the pcic_cards introduced on the day and reads that day usage minutes', async () => {
    tables.usage_minutes = [{ date: '2026-10-08', minutes: 12 }, { date: '2026-10-07', minutes: 3 }];
    tables.pcic_cards = [
      pcicRow('b1-0001', '2026-10-08'),
      pcicRow('b1-0002', '2026-10-08'),
      pcicRow('b1-0003', '2026-10-08'),
      pcicRow('b1-0004', '2026-10-07'),
      pcicRow('b1-0005', null),
    ];
    expect(await getDb().getDayStats('2026-10-08')).toEqual({ minutes: 12, words: 3 });
    expect(await getDb().getDayStats('2026-10-07')).toEqual({ minutes: 3, words: 1 });
    expect(await getDb().getDayStats('2026-10-01')).toEqual({ minutes: 0, words: 0 });
  });

  it('ignores the unwritten card_attempts table', async () => {
    tables.card_attempts = [{ word_id: 5001, type: 'word', correct: 1, response_time_ms: 800, timestamp: '2026-10-08T10:00:00.000Z' }];
    expect((await getDb().getDayStats('2026-10-08')).words).toBe(0);
  });
});

describe('exportAll / importAll (native db)', () => {
  const seedAll = () => {
    tables.game_progress = [{ pair: 'en-es', game_id: 'grammar', item_id: 'ser-estar:done', state: 'done', data_json: null }];
    tables.learn_settings = [{ pair: 'en-es', words_only: null, daily_new_limit: 15 }];
    tables.onboarding = [{ id: 1, source: 'en', target: 'es' }];
    tables.streak = [{ id: 1, current_count: 4, last_date: '2026-10-08', longest_count: 6 }];
    tables.user_level = [{ pair: 'en-es', level: 'A2', correct_streak: 1, mistakes_in_window: 0, fail_streak: 0 }];
    tables.user_meta = [{ id: 1, user_id: 'old-install-id', first_use_date: '2026-09-01T00:00:00.000Z' }];
    tables.pcic_cards = [pcicRow('b1-0001', '2026-10-08'), pcicRow('b1-0002', '2026-10-07')];
    tables.mistake_batches = [{ batch_id: '2026-09-23-claude', json: '{"a":1}', imported_at: '2026-09-23T10:00:00.000Z' }];
    tables.mistake_cards = [pcicRow('2026-09-23-claude:w:w1', '2026-10-08')];
    tables.usage_minutes = [{ date: '2026-10-08', minutes: 12 }];
    tables.cards = [{ id: 1, word_id: 5001 }];
    tables.card_attempts = [{ id: 1, word_id: 5001 }];
  };

  it('exports pcic_cards, mistake_* and usage_minutes, not the dead FSRS tables, and restores them', async () => {
    seedAll();
    const payload = await getDb().exportAll();
    expect(payload.schemaVersion).toBe(2);
    expect(payload.tables.pcic_cards).toHaveLength(2);
    expect(payload.tables.mistake_cards).toHaveLength(1);
    expect(payload.tables.mistake_batches).toHaveLength(1);
    expect(payload.tables.usage_minutes).toEqual([{ date: '2026-10-08', minutes: 12 }]);
    expect(payload.tables.user_meta[0].user_id).toBe('');
    expect(payload.tables).not.toHaveProperty('cards');
    expect(payload.tables).not.toHaveProperty('card_attempts');

    for (const t of Object.keys(tables)) delete tables[t];
    await getDb().importAll(JSON.parse(JSON.stringify(payload)));
    expect(tables.pcic_cards).toEqual(payload.tables.pcic_cards);
    expect(tables.mistake_cards).toEqual(payload.tables.mistake_cards);
    expect(tables.mistake_batches).toEqual(payload.tables.mistake_batches);
    expect(tables.usage_minutes).toEqual(payload.tables.usage_minutes);
    expect(tables.streak).toEqual(payload.tables.streak);
  });

  it('exports a legacy pcic_cards row with known NULL as 0, so the backup still validates', async () => {
    seedAll();
    tables.pcic_cards = [{ ...pcicRow('b1-0001', '2026-10-08'), known: null }, { ...pcicRow('b1-0002', '2026-10-07'), known: 1 }];
    const payload = await getDb().exportAll();
    expect(payload.tables.pcic_cards.map((r: any) => r.known)).toEqual([0, 1]);
    expect(() => validateBackupPayload(JSON.parse(JSON.stringify(payload)))).not.toThrow();
  });

  it('a v1 file leaves the local pcic_cards, mistake_* and usage_minutes alone', async () => {
    seedAll();
    const v1 = {
      schemaVersion: 1,
      exportedAt: '2026-09-20T10:00:00.000Z',
      appVersion: '4.1.0',
      tables: {
        cards: [],
        card_attempts: [],
        game_progress: [],
        learn_settings: [],
        onboarding: [{ id: 1, source: 'en', target: 'es' }],
        streak: [{ id: 1, current_count: 9, last_date: '2026-09-20', longest_count: 12 }],
        user_level: [],
        user_meta: [{ id: 1, user_id: '', first_use_date: '2026-09-01T00:00:00.000Z' }],
      },
    };
    await getDb().importAll(v1 as any);
    expect(tables.streak).toEqual(v1.tables.streak);
    expect(tables.game_progress).toEqual([]);
    expect(tables.pcic_cards).toHaveLength(2);
    expect(tables.mistake_cards).toHaveLength(1);
    expect(tables.mistake_batches).toHaveLength(1);
    expect(tables.usage_minutes).toEqual([{ date: '2026-10-08', minutes: 12 }]);
    // the dropped FSRS tables are skipped, not cleared or refilled
    expect(tables.cards).toEqual([{ id: 1, word_id: 5001 }]);
  });
});
