/** @jest-environment node */
// E123 on a REAL SQLite (sql.js): migration v7 of an old-shape file (the cards one shared set, primary key item_id),
// the pair switch and the backup on the native store. Fixtures are invented and small.

import { openSqlJsDb, type SqlJsDriver } from '@/lib/testing/sqljsDriver';
import { applyMigrations, LATEST_SCHEMA_VERSION, MIGRATIONS } from '../db/migrations';
import { validateBackupPayload } from '../backup';

let mockDriver: SqlJsDriver;
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: async () => mockDriver }));
// jest.setup.js maps the database to the sql.js one; this test is about the native layer.
jest.unmock('../database');

const CARD_COLS = '(item_id, state, step, ease, interval, reps, lapses, due, last_review, introduced_at, known)';
const cardRow = (id: string, interval: number) => `('${id}', 'review', 0, 2.5, ${interval}, 2, 0, '2026-11-20', '2026-11-10', '2026-11-01', 1)`;

// A file as 4.1.41 leaves it: schema at version 6 (shared card set), the given active pair, some pairs already used.
async function oldFile(active: [string, string], pairs: string[], cards: [string, number][], mistakes: [string, number][] = []) {
  const db = await openSqlJsDb();
  await applyMigrations(db as any, MIGRATIONS.filter((m) => m.version <= 6));
  // the v7 shape is not there yet: the file still has the old one
  await db.execAsync('DROP TABLE pcic_cards; DROP TABLE mistake_cards;');
  await db.execAsync(`
    CREATE TABLE pcic_cards (
      item_id TEXT PRIMARY KEY, state TEXT NOT NULL DEFAULT 'new', step INTEGER NOT NULL DEFAULT 0,
      ease REAL NOT NULL DEFAULT 2.5, interval INTEGER NOT NULL DEFAULT 0, reps INTEGER NOT NULL DEFAULT 0,
      lapses INTEGER NOT NULL DEFAULT 0, due TEXT NOT NULL DEFAULT '', last_review TEXT, introduced_at TEXT,
      known INTEGER, half_steps INTEGER DEFAULT 0, wrong_streak INTEGER DEFAULT 0
    );
    CREATE TABLE mistake_cards (
      item_id TEXT PRIMARY KEY, state TEXT NOT NULL DEFAULT 'new', step INTEGER NOT NULL DEFAULT 0,
      ease REAL NOT NULL DEFAULT 2.5, interval INTEGER NOT NULL DEFAULT 0, reps INTEGER NOT NULL DEFAULT 0,
      lapses INTEGER NOT NULL DEFAULT 0, due TEXT NOT NULL DEFAULT '', last_review TEXT, introduced_at TEXT,
      known INTEGER NOT NULL DEFAULT 0
    );
    PRAGMA user_version = 6;
  `);
  await db.runAsync('INSERT INTO onboarding (id, source, target) VALUES (1, ?, ?)', [active[0], active[1]]);
  for (const p of pairs) await db.runAsync('INSERT INTO learn_settings (pair, daily_new_limit) VALUES (?, 15)', [p]);
  for (const [id, interval] of cards) await db.execAsync(`INSERT INTO pcic_cards ${CARD_COLS} VALUES ${cardRow(id, interval)}`);
  for (const [id, interval] of mistakes) await db.execAsync(`INSERT INTO mistake_cards ${CARD_COLS} VALUES ${cardRow(id, interval)}`);
  return db;
}

const pairsOf = async (db: SqlJsDriver, table = 'pcic_cards') =>
  Object.fromEntries((await db.getAllAsync<{ item_id: string; pair: string }>(`SELECT item_id, pair FROM ${table}`)).map((r) => [r.item_id, r.pair]));

function nativeDb(db: SqlJsDriver): import('../dbTypes').DB {
  mockDriver = db;
  let getDb: () => import('../dbTypes').DB;
  jest.isolateModules(() => {
    getDb = require('../database').getDb;
  });
  return getDb!();
}

describe('migration v7: the cards get a pair (real SQLite)', () => {
  it('the cards stay with the active pair when the target matches; no row is lost, no value changes', async () => {
    const db = await oldFile(['en', 'es'], ['en-es', 'es-en', 'hu-es'], [['o1', 4], ['o2', 6], ['e3', 8]], [['b:w:1', 5]]);
    expect(LATEST_SCHEMA_VERSION).toBe(7);
    const db7 = nativeDb(db);
    await db7.getStreak(); // opens the file: runs the migration
    // o* (Spanish deck) -> the active en-es; e3 (English deck) -> the known pair of that target, es-en; the Spanish mistakes -> en-es
    expect(await pairsOf(db)).toEqual({ o1: 'en-es', o2: 'en-es', e3: 'es-en' });
    expect(await pairsOf(db, 'mistake_cards')).toEqual({ 'b:w:1': 'en-es' });
    expect(await db.getAllAsync('SELECT item_id, interval, known FROM pcic_cards ORDER BY item_id')).toEqual([
      { item_id: 'e3', interval: 8, known: 1 },
      { item_id: 'o1', interval: 4, known: 1 },
      { item_id: 'o2', interval: 6, known: 1 },
    ]);
    expect((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))!.user_version).toBe(LATEST_SCHEMA_VERSION);
  });

  it('with es→en active, Spanish-deck cards go to the newest known pair of that target; a missing pair falls back to the active source', async () => {
    const db = await oldFile(['es', 'en'], ['en-es', 'hu-es'], [['o1', 4], ['e2', 6], ['d3', 7]]);
    await nativeDb(db).getStreak();
    expect(await pairsOf(db)).toEqual({ o1: 'hu-es', e2: 'es-en', d3: 'es-de' });
  });

  it('a NULL known (a bare-ALTER row) is carried as 0', async () => {
    const db = await oldFile(['en', 'es'], [], []);
    await db.execAsync("INSERT INTO pcic_cards (item_id, known) VALUES ('o9', NULL)");
    await nativeDb(db).getStreak();
    expect(await db.getAllAsync('SELECT item_id, known FROM pcic_cards')).toEqual([{ item_id: 'o9', known: 0 }]);
  });
});

describe('the pair switch and the backup on the native store', () => {
  it('hu→es starts from zero, and back on en→es the migrated progress is there', async () => {
    const db = await oldFile(['en', 'es'], ['en-es'], [['o1', 4], ['o2', 6]], [['b:w:1', 5]]);
    const d = nativeDb(db);
    expect((await d.getPcicCards()).map((c) => c.itemId).sort()).toEqual(['o1', 'o2']);

    await d.setOnboarding('hu', 'es');
    expect(await d.getPcicCards()).toEqual([]);
    expect(await d.getPcicCard('o1')).toBeNull();
    expect(await d.getMistakeCards()).toEqual([]);
    await d.upsertPcicCard({ itemId: 'o1', state: 'review', step: 0, ease: 2.5, interval: 11, reps: 1, lapses: 0, due: '2026-12-01', lastReview: '2026-11-15', introducedAt: '2026-11-15', known: false });
    expect((await d.getPcicCard('o1'))?.interval).toBe(11);

    await d.setOnboarding('en', 'es');
    expect((await d.getPcicCard('o1'))?.interval).toBe(4);
    expect((await d.getMistakeCards()).map((c) => c.itemId)).toEqual(['b:w:1']);
    await d.resetPcicCards();
    expect(await d.getPcicCards()).toEqual([]);
    await d.setOnboarding('hu', 'es');
    expect((await d.getPcicCard('o1'))?.interval).toBe(11);
  });

  it('round-trips both pairs through a backup; a v2 file without pairs restores to the pair of its onboarding', async () => {
    const db = await oldFile(['en', 'es'], ['en-es'], [['o1', 4]]);
    const d = nativeDb(db);
    await d.setOnboarding('hu', 'es');
    await d.upsertPcicCard({ itemId: 'o1', state: 'review', step: 0, ease: 2.5, interval: 11, reps: 1, lapses: 0, due: '2026-12-01', lastReview: '2026-11-15', introducedAt: '2026-11-15', known: false });
    const payload = JSON.parse(JSON.stringify(await d.exportAll()));
    expect(payload.schemaVersion).toBe(3);
    expect(() => validateBackupPayload(payload)).not.toThrow();
    expect(payload.tables.pcic_cards.map((r: any) => r.pair).sort()).toEqual(['en-es', 'hu-es']);

    const fresh = nativeDb(await openSqlJsDb());
    await fresh.importAll(validateBackupPayload(payload));
    expect((await fresh.getPcicCard('o1'))?.interval).toBe(11);
    await fresh.setOnboarding('en', 'es');
    expect((await fresh.getPcicCard('o1'))?.interval).toBe(4);

    const v2 = { ...payload, schemaVersion: 2, tables: { ...payload.tables, pcic_cards: payload.tables.pcic_cards.map(({ pair, ...r }: any) => r).slice(0, 1) } };
    const old = nativeDb(await openSqlJsDb());
    await old.importAll(validateBackupPayload(v2));
    expect(await old.getOnboarding()).toEqual({ source: 'hu', target: 'es' });
    expect((await old.getPcicCards()).map((c) => c.itemId)).toEqual(['o1']);
  });
});
