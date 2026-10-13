import * as SQLite from 'expo-sqlite';

// the schema creation + every migration
// (formerly SQLiteDB.open(), lib/database.ts),
// moved out here by responsibility. The class calls it at startup.
//
// Versioned: PRAGMA user_version says how many MIGRATIONS entries the file already has,
// only the newer ones run, each in ONE transaction together with its version bump, so a
// failing step rolls back completely (schema + data) and the next start retries it on the
// untouched file. A new schema change = a new entry at the end of MIGRATIONS, never an
// edit of an old one.

// Migration: SRS rows of the retired PCIC / Spanish word-list decks ("a1-<hash>" ... "b2-<hash>",
// "w<n>") match no card of the current decks (o<n> / e<n> ids), they would only linger in
// pcic_cards. The old id-remap migrations that carried them over are gone (pre-4.1 backups are
// not restored). Idempotent: from the second run the SELECT finds nothing to delete.
const LEGACY_PCIC_ID = /^(?:[a-c][0-9]-|w[0-9])/;

export function isLegacyPcicId(id: string): boolean {
  return LEGACY_PCIC_ID.test(id);
}

export async function dropLegacyPcicRows(db: SQLite.SQLiteDatabase) {
  const rows = await db.getAllAsync<{ item_id: string }>('SELECT item_id FROM pcic_cards');
  const legacy = rows.map((r) => r.item_id).filter(isLegacyPcicId);
  for (let i = 0; i < legacy.length; i += 500) {
    const chunk = legacy.slice(i, i + 500);
    await db.runAsync(`DELETE FROM pcic_cards WHERE item_id IN (${chunk.map(() => '?').join(',')})`, chunk);
  }
}

async function hasColumn(db: SQLite.SQLiteDatabase, table: string, column: string): Promise<boolean> {
  const row = await db.getFirstAsync<any>(`SELECT 1 AS present FROM pragma_table_info('${table}') WHERE name = ?`, [column]);
  return !!row;
}

// Adds the column only if the table lacks it; any other failure propagates (no catch-all).
// table / column / ddl are code constants, never user input.
async function addColumnIfMissing(db: SQLite.SQLiteDatabase, table: string, column: string, ddl: string) {
  if (await hasColumn(db, table, column)) return;
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}

// Migration: daily_xp.xp_tenths (XP in integer tenths so 0.2 XP steps add up exactly).
// Rows an older build wrote hold whole XP in `xp`: converted once (x10); rows already in
// tenths are left alone, so a re-run changes nothing.
export async function migrateDailyXpTenths(db: SQLite.SQLiteDatabase) {
  await addColumnIfMissing(db, 'daily_xp', 'xp_tenths', 'INTEGER');
  await db.runAsync('UPDATE daily_xp SET xp_tenths = xp * 10 WHERE xp_tenths IS NULL');
}

// The whole live schema as of v1: every column an ALTER ever added is part of its CREATE.
// The retired FSRS tables (cards, card_attempts, spelling_list, pcic_spelling_list) are not
// here: nothing reads or writes them, a new install never gets them, an existing file keeps
// them as they are. Every statement is IF NOT EXISTS, so the catch-up path of an existing
// file runs the same script and only the tables it lacks get created.
const SCHEMA_V1 = `
    CREATE TABLE IF NOT EXISTS streak (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      current_count INTEGER NOT NULL DEFAULT 0,
      last_date TEXT,
      longest_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS onboarding (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      source TEXT NOT NULL,
      target TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_level (
      pair TEXT PRIMARY KEY,
      level TEXT NOT NULL DEFAULT 'A0',
      correct_streak INTEGER NOT NULL DEFAULT 0,
      mistakes_in_window INTEGER NOT NULL DEFAULT 0,
      fail_streak INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS user_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      user_id TEXT NOT NULL,
      first_use_date TEXT NOT NULL,
      last_sync_date TEXT,
      last_open_date TEXT,
      status_bar_tint INTEGER,
      grammar_palette TEXT,
      skin TEXT,
      skin_mix TEXT,
      beta_flags TEXT,
      -- the old singleton PCIC level (moved to learn_settings.pcic_level); kept so a backup
      -- exported by an older build, which carries the column, still restores.
      pcic_level TEXT,
      practice_round TEXT
    );
    CREATE TABLE IF NOT EXISTS learn_settings (
      pair TEXT PRIMARY KEY,
      words_only INTEGER,
      random_topics INTEGER,
      strict_accents INTEGER,
      article_picker INTEGER,
      requeue_level TEXT,
      feedback_btn_side TEXT,
      weekly_goal_minutes INTEGER,
      daily_new_limit INTEGER,
      new_bonus INTEGER,
      new_bonus_date TEXT,
      hand_cap INTEGER,
      gap_laps INTEGER,
      repair_gap INTEGER,
      -- FB364 (PLAN-fb0923 5. lépés): a PCIC "rontott" (again) kártya ennyi
      -- másodperc múlva jön mindenképp vissza (lib/pcicSession.ts).
      again_delay_sec INTEGER,
      -- PLAN-ketiranyu 4. lépés javítás: a PCIC szint (A1-B2) párhoz kötve,
      -- hogy en-es és es-en külön szintet őrizzen (a user_meta szingliton
      -- oszlopból ide költözött, lásd a catch-up migrációt régi DB-khez).
      pcic_level TEXT
    );
    CREATE TABLE IF NOT EXISTS usage_minutes (
      date TEXT PRIMARY KEY,
      minutes INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS daily_xp (
      date TEXT PRIMARY KEY,
      xp INTEGER NOT NULL DEFAULT 0,
      xp_tenths INTEGER
    );
    CREATE TABLE IF NOT EXISTS game_progress (
      pair TEXT NOT NULL,
      game_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      state TEXT NOT NULL,
      data_json TEXT,
      PRIMARY KEY (pair, game_id, item_id)
    );
    CREATE TABLE IF NOT EXISTS pcic_cards (
      item_id TEXT PRIMARY KEY,
      state TEXT NOT NULL DEFAULT 'new',
      step INTEGER NOT NULL DEFAULT 0,
      ease REAL NOT NULL DEFAULT 2.5,
      interval INTEGER NOT NULL DEFAULT 0,
      reps INTEGER NOT NULL DEFAULT 0,
      lapses INTEGER NOT NULL DEFAULT 0,
      due TEXT NOT NULL DEFAULT '',
      last_review TEXT,
      introduced_at TEXT,
      known INTEGER NOT NULL DEFAULT 0,
      -- practice-tab half-step counter + wrong-typed streak
      half_steps INTEGER DEFAULT 0,
      wrong_streak INTEGER DEFAULT 0
    );
    -- PLAN-hibaim.md 2. lépés: a betöltött "Hibáim" kötegek (a validált JSON,
    -- teljes egészében) és a hozzájuk tartozó SM-2 haladás, a pcic_cards
    -- oszlopaival, de saját táblában, hogy a PCIC-statisztikát ne szennyezze.
    CREATE TABLE IF NOT EXISTS mistake_batches (
      batch_id TEXT PRIMARY KEY,
      json TEXT NOT NULL,
      imported_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mistake_cards (
      item_id TEXT PRIMARY KEY,
      state TEXT NOT NULL DEFAULT 'new',
      step INTEGER NOT NULL DEFAULT 0,
      ease REAL NOT NULL DEFAULT 2.5,
      interval INTEGER NOT NULL DEFAULT 0,
      reps INTEGER NOT NULL DEFAULT 0,
      lapses INTEGER NOT NULL DEFAULT 0,
      due TEXT NOT NULL DEFAULT '',
      last_review TEXT,
      introduced_at TEXT,
      known INTEGER NOT NULL DEFAULT 0
    );
`;

// The columns the old ALTER TABLE migrations added over time (table, column, DDL). An existing
// unversioned file gets exactly the ones it lacks, in this order.
const LATE_COLUMNS: ReadonlyArray<readonly [string, string, string]> = [
  ['learn_settings', 'random_topics', 'INTEGER'],
  ['learn_settings', 'strict_accents', 'INTEGER'],
  ['learn_settings', 'requeue_level', 'TEXT'],
  ['learn_settings', 'article_picker', 'INTEGER'],
  ['learn_settings', 'feedback_btn_side', 'TEXT'],
  ['learn_settings', 'weekly_goal_minutes', 'INTEGER'],
  ['user_meta', 'last_open_date', 'TEXT'],
  ['user_meta', 'status_bar_tint', 'INTEGER'],
  ['user_meta', 'grammar_palette', 'TEXT'],
  ['user_meta', 'skin', 'TEXT'],
  ['user_meta', 'skin_mix', 'TEXT'],
  ['learn_settings', 'daily_new_limit', 'INTEGER'],
  ['learn_settings', 'new_bonus', 'INTEGER'],
  ['learn_settings', 'new_bonus_date', 'TEXT'],
  ['learn_settings', 'hand_cap', 'INTEGER'],
  ['learn_settings', 'gap_laps', 'INTEGER'],
  ['learn_settings', 'repair_gap', 'INTEGER'],
  ['learn_settings', 'again_delay_sec', 'INTEGER'],
  ['pcic_cards', 'known', 'INTEGER'],
  ['pcic_cards', 'half_steps', 'INTEGER DEFAULT 0'],
  ['pcic_cards', 'wrong_streak', 'INTEGER DEFAULT 0'],
  ['user_meta', 'beta_flags', 'TEXT'],
  ['user_meta', 'pcic_level', 'TEXT'],
  ['user_meta', 'practice_round', 'TEXT'],
  ['learn_settings', 'pcic_level', 'TEXT'],
];

// The active language pair from onboarding (default es-hu before onboarding is done).
async function readActivePair(db: SQLite.SQLiteDatabase): Promise<string> {
  const ob = await db.getFirstAsync<any>('SELECT source, target FROM onboarding WHERE id = 1');
  return ob ? `${ob.source}-${ob.target}` : 'es-hu';
}

// An existing file from before PRAGMA user_version (user_version 0, the app's tables are
// there): the old startup catch-up steps, run once. Nothing existing is deleted; the retired
// FSRS tables are left exactly as they are and no longer migrated.
async function catchUpUnversionedDb(db: SQLite.SQLiteDatabase) {
  // A table a very old file lacks gets created, an existing one is not touched.
  await db.execAsync(SCHEMA_V1);
  for (const [table, column, ddl] of LATE_COLUMNS) {
    await addColumnIfMissing(db, table, column, ddl);
  }
  await migrateDailyXpTenths(db);
  const activePair = await readActivePair(db);

  // pcic_level moved from the user_meta singleton column into the per-pair row of
  // learn_settings, so the two directions (en-es / es-en) keep separate levels. The old
  // value always belonged to the en-es pair (the only pair that existed until then);
  // COALESCE only fills it in if the learn_settings side has nothing yet.
  const oldMeta = await db.getFirstAsync<any>('SELECT pcic_level FROM user_meta WHERE id = 1');
  if (oldMeta?.pcic_level) {
    await db.runAsync(
      `INSERT INTO learn_settings (pair, pcic_level) VALUES ('en-es', ?)
       ON CONFLICT(pair) DO UPDATE SET pcic_level = COALESCE(learn_settings.pcic_level, excluded.pcic_level)`,
      [oldMeta.pcic_level]
    );
  }

  // Per-pair user_level (old singleton id=1 -> keyed by pair). Only entered while user_level
  // still has the old shape, i.e. the old table still holds the data, so a leftover
  // user_level_new can only be a stale copy of an interrupted earlier attempt.
  if (!(await hasColumn(db, 'user_level', 'pair'))) {
    await db.execAsync(`
      DROP TABLE IF EXISTS user_level_new;
      CREATE TABLE user_level_new (
        pair TEXT PRIMARY KEY,
        level TEXT NOT NULL DEFAULT 'A0',
        correct_streak INTEGER NOT NULL DEFAULT 0,
        mistakes_in_window INTEGER NOT NULL DEFAULT 0,
        fail_streak INTEGER NOT NULL DEFAULT 0
      );
    `);
    await db.runAsync(
      `INSERT INTO user_level_new (pair, level, correct_streak, mistakes_in_window, fail_streak)
         SELECT ?, level, correct_streak, mistakes_in_window, fail_streak FROM user_level WHERE id = 1`,
      [activePair]
    );
    await db.execAsync(`
      DROP TABLE user_level;
      ALTER TABLE user_level_new RENAME TO user_level;
    `);
  }
  await dropLegacyPcicRows(db);
}

// v1: the schema as of the day versioning started. A new install (none of the app's tables
// yet) gets the whole schema in one go; an existing unversioned file is caught up.
async function migrateToV1(db: SQLite.SQLiteDatabase) {
  const existing = await db.getFirstAsync<any>(
    "SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name IN ('pcic_cards', 'user_meta')"
  );
  if (existing) {
    await catchUpUnversionedDb(db);
  } else {
    await db.execAsync(SCHEMA_V1);
  }
}

export interface Migration {
  version: number;
  up: (db: SQLite.SQLiteDatabase) => Promise<void>;
}

export const MIGRATIONS: readonly Migration[] = [{ version: 1, up: migrateToV1 }];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

// Runs every migration newer than PRAGMA user_version, in order, each in one transaction
// with its version bump (PRAGMA user_version is transactional: a rollback restores it too).
export async function applyMigrations(db: SQLite.SQLiteDatabase, migrations: readonly Migration[]) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (const m of migrations) {
    if (m.version <= current) continue;
    await db.withTransactionAsync(async () => {
      await m.up(db);
      await db.execAsync(`PRAGMA user_version = ${m.version}`);
    });
  }
}

// Brings the file to the latest schema, makes sure the singleton rows exist (every start:
// a restored backup can carry an empty table), and returns the active language pair from
// onboarding so the caller (SQLiteDB.open()) can set this.activePair.
export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<string> {
  await applyMigrations(db, MIGRATIONS);
  await db.runAsync('INSERT OR IGNORE INTO streak (id, current_count, longest_count) VALUES (1, 0, 0)');
  const meta = await db.getFirstAsync<any>('SELECT id FROM user_meta WHERE id = 1');
  if (!meta) {
    // user_id is NOT NULL but nothing reads it (the analytics that sent it are gone),
    // so a new install gets an empty value, not a persistent random identifier.
    await db.runAsync('INSERT INTO user_meta (id, user_id, first_use_date) VALUES (1, ?, ?)', ['', new Date().toISOString()]);
  }
  return readActivePair(db);
}
