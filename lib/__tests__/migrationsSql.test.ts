/** @jest-environment node */
// The schema versioning (PRAGMA user_version + lib/db/migrations.ts) against a REAL SQLite
// (sql.js, see helpers/sqljsDriver.ts), not a regex fake: an old, unversioned file keeps every
// row, a new install gets the same schema in one go, a failing step rolls back completely.

import { openSqlJsDb, type SqlJsDriver } from './helpers/sqljsDriver';
import { applyMigrations, LATEST_SCHEMA_VERSION, MIGRATIONS, migrateDailyXpTenths, runMigrations } from '../db/migrations';
import { validateBackupPayload } from '../backup';

let mockDriver: SqlJsDriver;
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: async () => mockDriver }));

const DEAD_TABLES = ['cards', 'card_attempts', 'spelling_list', 'pcic_spelling_list'];
const LIVE_TABLES = [
  'daily_xp',
  'game_progress',
  'learn_settings',
  'mistake_batches',
  'mistake_cards',
  'onboarding',
  'pcic_cards',
  'streak',
  'usage_minutes',
  'user_level',
  'user_meta',
];

// The columns the old ALTER TABLE migrations added later; the old fixture lacks all of them.
const ADDED_COLUMNS: Record<string, string[]> = {
  learn_settings: [
    'random_topics', 'strict_accents', 'requeue_level', 'article_picker', 'feedback_btn_side',
    'weekly_goal_minutes', 'daily_new_limit', 'new_bonus', 'new_bonus_date', 'hand_cap', 'gap_laps',
    'repair_gap', 'again_delay_sec', 'pcic_level',
  ],
  user_meta: [
    'last_open_date', 'status_bar_tint', 'grammar_palette', 'skin', 'skin_mix', 'beta_flags',
    'pcic_level', 'practice_round',
  ],
  pcic_cards: ['known', 'half_steps', 'wrong_streak'],
  daily_xp: ['xp_tenths'],
};

// The schema as the first versioned build finds it on a phone: today's CREATE statements
// without the later ALTER columns, the dead FSRS tables included, user_level still the
// old singleton (no pair column).
const OLD_SCHEMA = `
  CREATE TABLE cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT, word_id INTEGER NOT NULL, type TEXT NOT NULL DEFAULT 'word',
    pair TEXT NOT NULL DEFAULT 'es-hu', due TEXT NOT NULL, stability REAL NOT NULL DEFAULT 0,
    difficulty REAL NOT NULL DEFAULT 0, elapsed_days INTEGER NOT NULL DEFAULT 0,
    scheduled_days INTEGER NOT NULL DEFAULT 0, learning_steps INTEGER NOT NULL DEFAULT 0,
    reps INTEGER NOT NULL DEFAULT 0, lapses INTEGER NOT NULL DEFAULT 0, state INTEGER NOT NULL DEFAULT 0,
    last_review TEXT, buried INTEGER NOT NULL DEFAULT 0, learned_at TEXT, lap INTEGER NOT NULL DEFAULT 0,
    in_hand INTEGER NOT NULL DEFAULT 0, started_at TEXT, UNIQUE(word_id, type, pair)
  );
  CREATE TABLE streak (
    id INTEGER PRIMARY KEY CHECK (id = 1), current_count INTEGER NOT NULL DEFAULT 0, last_date TEXT,
    longest_count INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE card_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, word_id INTEGER NOT NULL, type TEXT NOT NULL, pair TEXT,
    correct INTEGER NOT NULL, response_time_ms INTEGER NOT NULL, timestamp TEXT NOT NULL
  );
  CREATE TABLE onboarding (
    id INTEGER PRIMARY KEY CHECK (id = 1), source TEXT NOT NULL, target TEXT NOT NULL
  );
  CREATE TABLE user_level (
    id INTEGER PRIMARY KEY CHECK (id = 1), level TEXT NOT NULL DEFAULT 'A0',
    correct_streak INTEGER NOT NULL DEFAULT 0, mistakes_in_window INTEGER NOT NULL DEFAULT 0,
    fail_streak INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE user_meta (
    id INTEGER PRIMARY KEY CHECK (id = 1), user_id TEXT NOT NULL, first_use_date TEXT NOT NULL,
    last_sync_date TEXT
  );
  CREATE TABLE learn_settings (pair TEXT PRIMARY KEY, words_only INTEGER);
  CREATE TABLE spelling_list (
    pair TEXT NOT NULL, word_id INTEGER NOT NULL, step INTEGER NOT NULL DEFAULT 0, due TEXT NOT NULL,
    PRIMARY KEY (pair, word_id)
  );
  CREATE TABLE usage_minutes (date TEXT PRIMARY KEY, minutes INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE daily_xp (date TEXT PRIMARY KEY, xp INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE game_progress (
    pair TEXT NOT NULL, game_id TEXT NOT NULL, item_id TEXT NOT NULL, state TEXT NOT NULL, data_json TEXT,
    PRIMARY KEY (pair, game_id, item_id)
  );
  CREATE TABLE pcic_cards (
    item_id TEXT PRIMARY KEY, state TEXT NOT NULL DEFAULT 'new', step INTEGER NOT NULL DEFAULT 0,
    ease REAL NOT NULL DEFAULT 2.5, interval INTEGER NOT NULL DEFAULT 0, reps INTEGER NOT NULL DEFAULT 0,
    lapses INTEGER NOT NULL DEFAULT 0, due TEXT NOT NULL DEFAULT '', last_review TEXT, introduced_at TEXT
  );
  CREATE TABLE pcic_spelling_list (item_id TEXT PRIMARY KEY, step INTEGER NOT NULL DEFAULT 0, due TEXT NOT NULL);
  CREATE TABLE mistake_batches (batch_id TEXT PRIMARY KEY, json TEXT NOT NULL, imported_at TEXT NOT NULL);
  CREATE TABLE mistake_cards (
    item_id TEXT PRIMARY KEY, state TEXT NOT NULL DEFAULT 'new', step INTEGER NOT NULL DEFAULT 0,
    ease REAL NOT NULL DEFAULT 2.5, interval INTEGER NOT NULL DEFAULT 0, reps INTEGER NOT NULL DEFAULT 0,
    lapses INTEGER NOT NULL DEFAULT 0, due TEXT NOT NULL DEFAULT '', last_review TEXT, introduced_at TEXT,
    known INTEGER NOT NULL DEFAULT 0
  );
`;

// 3 rows per table (the singleton tables can only hold one).
const OLD_ROWS = `
  INSERT INTO cards (word_id, type, pair, due, reps, lapses, state, lap, in_hand) VALUES
    (1, 'word', 'es-hu', '2026-09-01', 5, 1, 2, 3, 0), (2, 'word', 'es-hu', '2026-09-02', 1, 0, 1, 1, 1),
    (3, 'word', 'en-es', '2026-09-03', 0, 0, 0, 0, 0);
  INSERT INTO streak VALUES (1, 4, '2026-10-12', 9);
  INSERT INTO card_attempts (word_id, type, pair, correct, response_time_ms, timestamp) VALUES
    (1, 'word', 'es-hu', 1, 900, '2026-09-01T10:00:00Z'), (2, 'word', NULL, 0, 1500, '2026-09-02T10:00:00Z'),
    (3, 'word', 'en-es', 1, 700, '2026-09-03T10:00:00Z');
  INSERT INTO onboarding VALUES (1, 'en', 'es');
  INSERT INTO user_level VALUES (1, 'A2', 3, 1, 0);
  INSERT INTO user_meta VALUES (1, '', '2026-09-01T00:00:00.000Z', '2026-10-01');
  INSERT INTO learn_settings VALUES ('es-hu', 0), ('en-es', 1), ('es-en', 1);
  INSERT INTO spelling_list VALUES ('es-hu', 1, 0, '2026-09-01'), ('es-hu', 2, 1, '2026-09-02'), ('en-es', 3, 2, '2026-09-03');
  INSERT INTO usage_minutes VALUES ('2026-10-10', 12), ('2026-10-11', 0), ('2026-10-12', 47);
  INSERT INTO daily_xp VALUES ('2026-10-10', 7), ('2026-10-11', 0), ('2026-10-12', 63);
  INSERT INTO game_progress VALUES ('en-es', 'g1', 'i1', 'done', '{"a":1}'), ('en-es', 'g1', 'i2', 'new', NULL), ('es-en', 'g2', 'i1', 'done', NULL);
  INSERT INTO pcic_cards (item_id, state, step, ease, interval, reps, lapses, due, last_review, introduced_at) VALUES
    ('o1', 'review', 0, 2.5, 6, 3, 0, '2026-10-20', '2026-10-14', '2026-10-01'),
    ('o2', 'learning', 1, 2.3, 0, 1, 1, '2026-10-13', '2026-10-13', '2026-10-12'),
    ('e3', 'new', 0, 2.5, 0, 0, 0, '', NULL, NULL);
  INSERT INTO pcic_spelling_list VALUES ('o1', 0, '2026-10-01'), ('o2', 1, '2026-10-02'), ('e3', 2, '2026-10-03');
  INSERT INTO mistake_batches VALUES ('b1', '{"x":1}', '2026-10-01'), ('b2', '{"x":2}', '2026-10-02'), ('b3', '{"x":3}', '2026-10-03');
  INSERT INTO mistake_cards (item_id, state, reps, known) VALUES ('m1', 'new', 0, 0), ('m2', 'review', 4, 1), ('m3', 'learning', 2, 0);
`;

async function oldDb(extra = ''): Promise<SqlJsDriver> {
  const db = await openSqlJsDb();
  await db.execAsync(OLD_SCHEMA);
  await db.execAsync(OLD_ROWS);
  if (extra) await db.execAsync(extra);
  return db;
}

async function tableNames(db: SqlJsDriver): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  return rows.map((r) => r.name);
}

async function columnsOf(db: SqlJsDriver, table: string): Promise<{ name: string; type: string }[]> {
  return db.getAllAsync(`SELECT name, type FROM pragma_table_info('${table}') ORDER BY name`);
}

async function rowsOf(db: SqlJsDriver, table: string): Promise<Record<string, any>[]> {
  return db.getAllAsync(`SELECT * FROM ${table} ORDER BY rowid`);
}

async function snapshot(db: SqlJsDriver) {
  const out: Record<string, any> = { __schema: await db.getAllAsync('SELECT name, sql FROM sqlite_master ORDER BY name') };
  for (const t of await tableNames(db)) out[t] = await rowsOf(db, t);
  return out;
}

async function schemaOf(db: SqlJsDriver) {
  const out: Record<string, { name: string; type: string }[]> = {};
  for (const t of await tableNames(db)) out[t] = await columnsOf(db, t);
  return out;
}

const userVersion = async (db: SqlJsDriver) => (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))!.user_version;

describe('migration of an old, unversioned file (real SQLite)', () => {
  it('adds every missing column, keeps every row and value, bumps user_version', async () => {
    const db = await oldDb();
    const before: Record<string, Record<string, any>[]> = {};
    const beforeCols: Record<string, string[]> = {};
    for (const t of await tableNames(db)) {
      before[t] = await rowsOf(db, t);
      beforeCols[t] = (await columnsOf(db, t)).map((c) => c.name);
    }
    expect(await userVersion(db)).toBe(0);

    const pair = await runMigrations(db as any);

    expect(pair).toBe('en-es');
    expect(await userVersion(db)).toBe(LATEST_SCHEMA_VERSION);
    // every column the old ALTERs added is there now
    for (const [table, cols] of Object.entries(ADDED_COLUMNS)) {
      const have = (await columnsOf(db, table)).map((c) => c.name);
      for (const c of cols) expect(have).toContain(c);
    }
    // the old values of the live tables are unchanged (user_level is rebuilt: checked below)
    for (const t of Object.keys(before).filter((n) => !DEAD_TABLES.includes(n) && n !== 'user_level')) {
      const after = await rowsOf(db, t);
      expect(after.map((r) => Object.fromEntries(beforeCols[t].map((c) => [c, r[c]])))).toEqual(before[t]);
    }
    // the dead FSRS tables are left exactly as they were: same columns, same rows
    for (const t of DEAD_TABLES) {
      expect((await columnsOf(db, t)).map((c) => c.name)).toEqual([...beforeCols[t]].sort());
      expect(await rowsOf(db, t)).toEqual(before[t]);
    }
    // the converted / defaulted values
    expect((await rowsOf(db, 'daily_xp')).map((r) => r.xp_tenths)).toEqual([70, 0, 630]);
    expect((await rowsOf(db, 'pcic_cards')).map((r) => [r.known, r.half_steps, r.wrong_streak])).toEqual([
      [null, 0, 0],
      [null, 0, 0],
      [null, 0, 0],
    ]);
    expect(await rowsOf(db, 'user_level')).toEqual([
      { pair: 'en-es', level: 'A2', correct_streak: 3, mistakes_in_window: 1, fail_streak: 0 },
    ]);
    expect(await rowsOf(db, 'user_meta')).toHaveLength(1);
    expect(await rowsOf(db, 'streak')).toEqual([{ id: 1, current_count: 4, last_date: '2026-10-12', longest_count: 9 }]);
  });

  it('is idempotent: a second run changes nothing', async () => {
    const db = await oldDb();
    await runMigrations(db as any);
    const once = await snapshot(db);
    await runMigrations(db as any);
    expect(await snapshot(db)).toEqual(once);
    expect(await userVersion(db)).toBe(LATEST_SCHEMA_VERSION);
  });

  it('moves the old user_meta pcic_level to en-es once, without overwriting a level already there', async () => {
    const a = await oldDb("ALTER TABLE user_meta ADD COLUMN pcic_level TEXT; UPDATE user_meta SET pcic_level = 'B1';");
    await runMigrations(a as any);
    expect(await a.getFirstAsync("SELECT pcic_level FROM learn_settings WHERE pair = 'en-es'")).toEqual({ pcic_level: 'B1' });
    const b = await oldDb(
      "ALTER TABLE user_meta ADD COLUMN pcic_level TEXT; UPDATE user_meta SET pcic_level = 'B1';" +
        "ALTER TABLE learn_settings ADD COLUMN pcic_level TEXT; UPDATE learn_settings SET pcic_level = 'A2' WHERE pair = 'en-es';"
    );
    await runMigrations(b as any);
    expect(await b.getFirstAsync("SELECT pcic_level FROM learn_settings WHERE pair = 'en-es'")).toEqual({ pcic_level: 'A2' });
  });

  it('drops the retired PCIC rows once, not on every start', async () => {
    const db = await oldDb("INSERT INTO pcic_cards (item_id) VALUES ('a1-9f3c'), ('w12');");
    await runMigrations(db as any);
    expect((await rowsOf(db, 'pcic_cards')).map((r) => r.item_id)).toEqual(['o1', 'o2', 'e3']);
    await db.execAsync("INSERT INTO pcic_cards (item_id) VALUES ('b2-77aa')");
    await runMigrations(db as any);
    expect((await rowsOf(db, 'pcic_cards')).map((r) => r.item_id)).toEqual(['o1', 'o2', 'e3', 'b2-77aa']);
  });

  it('creates the tables a very old file lacks and leaves the rest alone', async () => {
    const db = await openSqlJsDb();
    await db.execAsync(
      "CREATE TABLE user_meta (id INTEGER PRIMARY KEY CHECK (id = 1), user_id TEXT NOT NULL, first_use_date TEXT NOT NULL);" +
        "INSERT INTO user_meta VALUES (1, '', '2026-01-01');"
    );
    await runMigrations(db as any);
    expect(await tableNames(db)).toEqual(LIVE_TABLES);
    expect(await rowsOf(db, 'user_meta')).toMatchObject([{ id: 1, first_use_date: '2026-01-01' }]);
  });
});

// moved here from dailyXpMigration.test.ts (its regex fake cannot answer the pragma_table_info check)
describe('migrateDailyXpTenths (real SQLite)', () => {
  const xp = (db: SqlJsDriver) => db.getAllAsync('SELECT date, xp, xp_tenths FROM daily_xp ORDER BY date');

  it('adds the column and converts old whole-XP rows to tenths (x10)', async () => {
    const db = await openSqlJsDb();
    await db.execAsync(
      "CREATE TABLE daily_xp (date TEXT PRIMARY KEY, xp INTEGER NOT NULL DEFAULT 0);" +
        "INSERT INTO daily_xp VALUES ('2026-10-10', 7), ('2026-10-11', 0), ('2026-10-12', 63);"
    );
    await migrateDailyXpTenths(db as any);
    expect((await xp(db)).map((r: any) => r.xp_tenths)).toEqual([70, 0, 630]);
  });

  it('is idempotent: a second run (column exists) changes nothing, even after new 0.2 steps', async () => {
    const db = await openSqlJsDb();
    await db.execAsync(
      "CREATE TABLE daily_xp (date TEXT PRIMARY KEY, xp INTEGER NOT NULL DEFAULT 0);" +
        "INSERT INTO daily_xp VALUES ('2026-10-10', 7);"
    );
    await migrateDailyXpTenths(db as any);
    await db.runAsync('UPDATE daily_xp SET xp_tenths = xp_tenths + 2');
    await migrateDailyXpTenths(db as any);
    await migrateDailyXpTenths(db as any);
    expect(await xp(db)).toEqual([{ date: '2026-10-10', xp: 7, xp_tenths: 72 }]);
  });

  it('works on an empty table and when the column already exists', async () => {
    const db = await openSqlJsDb();
    await db.execAsync('CREATE TABLE daily_xp (date TEXT PRIMARY KEY, xp INTEGER NOT NULL DEFAULT 0, xp_tenths INTEGER)');
    await migrateDailyXpTenths(db as any);
    expect(await xp(db)).toEqual([]);
  });
});

describe('a new install (real SQLite)', () => {
  it('gets the latest schema in one go: the same columns as a caught-up file, no dead tables', async () => {
    const fresh = await openSqlJsDb();
    expect(await runMigrations(fresh as any)).toBe('es-hu');
    expect(await userVersion(fresh)).toBe(LATEST_SCHEMA_VERSION);
    expect(await tableNames(fresh)).toEqual(LIVE_TABLES);

    const old = await oldDb();
    await runMigrations(old as any);
    const caughtUp = await schemaOf(old);
    for (const t of DEAD_TABLES) delete caughtUp[t];
    expect(await schemaOf(fresh)).toEqual(caughtUp);

    expect(await rowsOf(fresh, 'streak')).toEqual([{ id: 1, current_count: 0, last_date: null, longest_count: 0 }]);
    expect(await rowsOf(fresh, 'user_meta')).toMatchObject([{ id: 1, user_id: '' }]);
    const once = await snapshot(fresh);
    await runMigrations(fresh as any);
    expect(await snapshot(fresh)).toEqual(once);
  });
});

describe('a failing step rolls back completely', () => {
  it('the catch-up fails halfway: no column, no version, no data change; the next run succeeds', async () => {
    const db = await oldDb();
    const before = await snapshot(db);
    const realRun = db.runAsync.bind(db);
    const spy = jest.spyOn(db, 'runAsync').mockImplementation(async (sql: string, ...p: unknown[]) => {
      if (sql.includes('INSERT INTO user_level_new')) throw new Error('disk full');
      return realRun(sql, ...p);
    });
    await expect(runMigrations(db as any)).rejects.toThrow('disk full');
    spy.mockRestore();
    expect(await userVersion(db)).toBe(0);
    expect(await snapshot(db)).toEqual(before);

    await runMigrations(db as any);
    expect(await userVersion(db)).toBe(LATEST_SCHEMA_VERSION);
    expect((await columnsOf(db, 'learn_settings')).map((c) => c.name)).toContain('again_delay_sec');
  });

  it('a later migration that throws leaves the earlier version and its data in place', async () => {
    const db = await oldDb();
    await runMigrations(db as any);
    const before = await snapshot(db);
    const failing = {
      version: LATEST_SCHEMA_VERSION + 1,
      up: async (d: any) => {
        await d.execAsync('ALTER TABLE streak ADD COLUMN junk TEXT');
        await d.runAsync('UPDATE pcic_cards SET reps = 99');
        throw new Error('boom');
      },
    };
    await expect(applyMigrations(db as any, [...MIGRATIONS, failing])).rejects.toThrow('boom');
    expect(await userVersion(db)).toBe(LATEST_SCHEMA_VERSION);
    expect(await snapshot(db)).toEqual(before);
  });
});

describe('the native SQLiteDB on the migrated file (backup round trip, XP, PCIC card)', () => {
  let getDb: () => import('../dbTypes').DB;
  let db: SqlJsDriver;

  beforeAll(async () => {
    db = await oldDb();
    mockDriver = db;
    jest.isolateModules(() => {
      getDb = require('../database').getDb;
    });
  });

  it('exportAll / importAll gives the same rows back, and the payload validates', async () => {
    const first = await getDb().exportAll();
    expect(() => validateBackupPayload(JSON.parse(JSON.stringify(first)))).not.toThrow();
    expect(first.tables.pcic_cards).toHaveLength(3);

    await getDb().importAll(first);
    const second = await getDb().exportAll();
    expect(second.tables).toEqual(first.tables);

    // the same payload also restores onto a brand-new install
    const fresh = await openSqlJsDb();
    mockDriver = fresh;
    let freshDb: () => import('../dbTypes').DB;
    jest.isolateModules(() => {
      freshDb = require('../database').getDb;
    });
    await freshDb!().importAll(first);
    expect((await freshDb!().exportAll()).tables).toEqual(first.tables);
  });

  it('addDailyXpTenths continues from an unconverted old row and from nothing', async () => {
    expect(await getDb().getDailyXpTenths('2026-10-10')).toBe(70);
    expect(await getDb().addDailyXpTenths('2026-10-10', 2)).toBe(72);
    expect(await getDb().addDailyXpTenths('2026-10-14', 2)).toBe(2);
    expect(await getDb().addDailyXpTenths('2026-10-14', -30)).toBe(0);
  });

  it('upsertPcicCard writes every column it names: as many values as placeholders and columns', async () => {
    const run = jest.spyOn(db, 'runAsync');
    const card = {
      itemId: 'o9', state: 'review' as const, step: 2, ease: 2.1, interval: 9, reps: 4, lapses: 1,
      due: '2026-11-01', lastReview: '2026-10-13', introducedAt: '2026-10-01', known: true, halfSteps: 1, wrongStreak: 2,
    };
    await getDb().upsertPcicCard(card);
    const call = run.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO pcic_cards'))!;
    run.mockRestore();
    const sql = String(call[0]);
    const columns = sql.match(/INSERT INTO pcic_cards \(([^)]*)\)/)![1].split(',').length;
    const placeholders = (sql.match(/VALUES \(([^)]*)\)/)![1].match(/\?/g) ?? []).length;
    const values = (call[1] as unknown[]).length;
    expect([columns, placeholders, values]).toEqual([13, 13, 13]);
    expect(await getDb().getPcicCard('o9')).toMatchObject(card);
    // updating the same card goes through the ON CONFLICT branch with the same values
    await getDb().upsertPcicCard({ ...card, reps: 5, halfSteps: 0, wrongStreak: 0 });
    expect(await getDb().getPcicCard('o9')).toMatchObject({ reps: 5, halfSteps: 0, wrongStreak: 0 });
  });
});
