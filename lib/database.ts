import * as SQLite from 'expo-sqlite';
import { BACKUP_TABLES, type BackupPayload } from './backup';
import type { Sm2Card } from './sm2';
import type { MistakeBatchRow } from './mistakes/deck';
import { runMigrations } from './db/migrations';
import { DbCore, decodeGameData, encodeGameData } from './db/core';
import type { DbStore, LevelRow, MetaColumn, SettingColumn, StreakRow } from './db/store';
import type { DB } from './dbTypes';

export type { DB };

// pcic_cards row -> Sm2Card; half_steps / wrong_streak are NULL or missing on rows from before the practice tab.
const rowToPcicCard = (r: any): Sm2Card => ({
  itemId: r.item_id,
  state: r.state,
  step: r.step,
  ease: r.ease,
  interval: r.interval,
  reps: r.reps,
  lapses: r.lapses,
  due: r.due,
  lastReview: r.last_review,
  introducedAt: r.introduced_at,
  known: !!r.known,
  halfSteps: r.half_steps ?? 0,
  wrongStreak: r.wrong_streak ?? 0,
});

// The SQL half of the DB: every statement runs here, the rules are in lib/db/core.ts.
// The column names handed in by DbCore come from the closed MetaColumn / SettingColumn unions.
class SqliteStore implements DbStore {
  private db: SQLite.SQLiteDatabase | null = null;

  // One shared promise that includes the migration: every caller waits for it, and
  // this.db is set only once it is done (a failed open clears it, so the next call retries).
  private opening: Promise<SQLite.SQLiteDatabase> | null = null;
  // the active language pair the migration read from onboarding (see DbCore.ready)
  private migratedPair: string | null = null;

  private async connect() {
    if (this.db) return this.db;
    this.opening ??= (async () => {
      const db = await SQLite.openDatabaseAsync('kimacha.db');
      this.migratedPair = await runMigrations(db);
      this.db = db;
      return db;
    })().finally(() => {
      this.opening = null;
    });
    return this.opening;
  }

  async open() {
    await this.connect();
    return this.migratedPair;
  }

  async readStreak(): Promise<StreakRow> {
    const db = await this.connect();
    return (await db.getFirstAsync<any>('SELECT * FROM streak WHERE id = 1'))!;
  }

  async writeStreak(streak: StreakRow) {
    const db = await this.connect();
    await db.runAsync('UPDATE streak SET current_count = ?, last_date = ?, longest_count = ? WHERE id = 1', [streak.current_count, streak.last_date, streak.longest_count]);
  }

  async readOnboarding() {
    const db = await this.connect();
    const row = await db.getFirstAsync<any>('SELECT source, target FROM onboarding WHERE id = 1');
    return row ?? null;
  }

  async writeOnboarding(source: string, target: string) {
    const db = await this.connect();
    await db.runAsync('INSERT OR REPLACE INTO onboarding (id, source, target) VALUES (1, ?, ?)', [source, target]);
  }

  async readLevel(pair: string): Promise<LevelRow> {
    const db = await this.connect();
    await db.runAsync("INSERT OR IGNORE INTO user_level (pair, level) VALUES (?, 'A0')", [pair]);
    return (await db.getFirstAsync<any>('SELECT * FROM user_level WHERE pair = ?', [pair]))!;
  }

  async readMeta(column: MetaColumn) {
    const db = await this.connect();
    const row = await db.getFirstAsync<any>(`SELECT ${column} FROM user_meta WHERE id = 1`);
    return row?.[column];
  }

  async writeMeta(column: MetaColumn, value: unknown) {
    const db = await this.connect();
    await db.runAsync(`UPDATE user_meta SET ${column} = ? WHERE id = 1`, [value as any]);
  }

  async readSettings(pair: string, columns: SettingColumn[]) {
    const db = await this.connect();
    return await db.getFirstAsync<any>(`SELECT ${columns.join(', ')} FROM learn_settings WHERE pair = ?`, [pair]);
  }

  async writeSettings(pair: string, values: Partial<Record<SettingColumn, unknown>>) {
    const db = await this.connect();
    const cols = Object.keys(values) as SettingColumn[];
    await db.runAsync(
      `INSERT INTO learn_settings (pair, ${cols.join(', ')}) VALUES (?${', ?'.repeat(cols.length)})
       ON CONFLICT(pair) DO UPDATE SET ${cols.map((c) => `${c} = excluded.${c}`).join(', ')}`,
      [pair, ...cols.map((c) => values[c] as any)]
    );
  }

  async addUsageMinute(date: string) {
    const db = await this.connect();
    await db.runAsync(
      'INSERT INTO usage_minutes (date, minutes) VALUES (?, 1) ON CONFLICT(date) DO UPDATE SET minutes = minutes + 1',
      [date]
    );
    const row = await db.getFirstAsync<any>('SELECT minutes FROM usage_minutes WHERE date = ?', [date]);
    return row?.minutes ?? 0;
  }

  async readUsage() {
    const db = await this.connect();
    const rows = await db.getAllAsync<any>('SELECT date, minutes FROM usage_minutes');
    return rows.map((r: any) => ({ date: r.date, minutes: r.minutes }));
  }

  async readUsageMinutes(date: string) {
    const db = await this.connect();
    const row = await db.getFirstAsync<any>('SELECT minutes FROM usage_minutes WHERE date = ?', [date]);
    return row?.minutes ?? 0;
  }

  async countPcicIntroducedOn(date: string) {
    const db = await this.connect();
    const row = await db.getFirstAsync<any>('SELECT COUNT(*) AS n FROM pcic_cards WHERE introduced_at = ?', [date]);
    return row?.n ?? 0;
  }

  async readDailyXpTenths(date: string) {
    const db = await this.connect();
    const row = await db.getFirstAsync<any>('SELECT COALESCE(xp_tenths, xp * 10) AS tenths FROM daily_xp WHERE date = ?', [date]);
    return row?.tenths ?? 0;
  }

  async addDailyXpTenths(date: string, delta: number) {
    const db = await this.connect();
    await db.runAsync(
      'INSERT INTO daily_xp (date, xp_tenths) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET xp_tenths = MAX(0, COALESCE(xp_tenths, xp * 10) + ?)',
      [date, Math.max(0, delta), delta]
    );
  }

  async readGameProgress(pair: string, gameId: string) {
    const db = await this.connect();
    const rows = await db.getAllAsync<any>(
      'SELECT item_id, state, data_json FROM game_progress WHERE pair = ? AND game_id = ?',
      [pair, gameId]
    );
    return rows.map((r: any) => ({ itemId: r.item_id, state: r.state, data: decodeGameData(r.data_json) }));
  }

  async writeGameProgress(pair: string, gameId: string, itemId: string, state: string, data: unknown) {
    const db = await this.connect();
    await db.runAsync(
      `INSERT INTO game_progress (pair, game_id, item_id, state, data_json) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(pair, game_id, item_id) DO UPDATE SET state = excluded.state, data_json = excluded.data_json`,
      [pair, gameId, itemId, state, encodeGameData(data)]
    );
  }

  async deleteGameProgress(pair: string, gameId: string) {
    const db = await this.connect();
    await db.runAsync('DELETE FROM game_progress WHERE pair = ? AND game_id = ?', [pair, gameId]);
  }

  async readPcicCards() {
    const db = await this.connect();
    const rows = await db.getAllAsync<any>('SELECT * FROM pcic_cards');
    return rows.map(rowToPcicCard);
  }

  async readPcicCard(itemId: string) {
    const db = await this.connect();
    const row = await db.getFirstAsync<any>('SELECT * FROM pcic_cards WHERE item_id = ?', [itemId]);
    return row ? rowToPcicCard(row) : null;
  }

  async writePcicCard(card: Sm2Card) {
    const db = await this.connect();
    await db.runAsync(
      `INSERT INTO pcic_cards (item_id, state, step, ease, interval, reps, lapses, due, last_review, introduced_at, known, half_steps, wrong_streak)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(item_id) DO UPDATE SET
         state = excluded.state, step = excluded.step, ease = excluded.ease,
         interval = excluded.interval, reps = excluded.reps, lapses = excluded.lapses,
         due = excluded.due, last_review = excluded.last_review, introduced_at = excluded.introduced_at,
         known = excluded.known, half_steps = excluded.half_steps, wrong_streak = excluded.wrong_streak`,
      [card.itemId, card.state, card.step, card.ease, card.interval, card.reps, card.lapses, card.due, card.lastReview, card.introducedAt, card.known ? 1 : 0, card.halfSteps ?? 0, card.wrongStreak ?? 0]
    );
  }

  async deletePcicCards(itemIds?: string[]) {
    const db = await this.connect();
    if (!itemIds) {
      await db.runAsync('DELETE FROM pcic_cards');
      return;
    }
    for (let i = 0; i < itemIds.length; i += 500) {
      const chunk = itemIds.slice(i, i + 500);
      const placeholders = chunk.map(() => '?').join(',');
      await db.runAsync(`DELETE FROM pcic_cards WHERE item_id IN (${placeholders})`, chunk);
    }
  }

  async writeMistakeBatch(batchId: string, json: string, importedAt: string) {
    const db = await this.connect();
    await db.runAsync(
      `INSERT INTO mistake_batches (batch_id, json, imported_at) VALUES (?, ?, ?)
       ON CONFLICT(batch_id) DO UPDATE SET json = excluded.json, imported_at = excluded.imported_at`,
      [batchId, json, importedAt]
    );
  }

  async readMistakeBatches(): Promise<MistakeBatchRow[]> {
    const db = await this.connect();
    const rows = await db.getAllAsync<any>('SELECT * FROM mistake_batches ORDER BY imported_at DESC');
    return rows.map((r: any) => ({ batchId: r.batch_id, json: r.json, importedAt: r.imported_at }));
  }

  async readMistakeCards() {
    const db = await this.connect();
    const rows = await db.getAllAsync<any>('SELECT * FROM mistake_cards');
    return rows.map((r: any) => ({
      itemId: r.item_id,
      state: r.state,
      step: r.step,
      ease: r.ease,
      interval: r.interval,
      reps: r.reps,
      lapses: r.lapses,
      due: r.due,
      lastReview: r.last_review,
      introducedAt: r.introduced_at,
      known: !!r.known,
    }));
  }

  async writeMistakeCard(card: Sm2Card) {
    const db = await this.connect();
    await db.runAsync(
      `INSERT INTO mistake_cards (item_id, state, step, ease, interval, reps, lapses, due, last_review, introduced_at, known)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(item_id) DO UPDATE SET
         state = excluded.state, step = excluded.step, ease = excluded.ease,
         interval = excluded.interval, reps = excluded.reps, lapses = excluded.lapses,
         due = excluded.due, last_review = excluded.last_review, introduced_at = excluded.introduced_at,
         known = excluded.known`,
      [card.itemId, card.state, card.step, card.ease, card.interval, card.reps, card.lapses, card.due, card.lastReview, card.introducedAt, card.known ? 1 : 0]
    );
  }

  async exportTables() {
    const db = await this.connect();
    const tables = {} as BackupPayload['tables'];
    for (const table of BACKUP_TABLES) {
      tables[table] = await db.getAllAsync(`SELECT * FROM ${table}`);
    }
    return tables;
  }

  // One transaction: any failure (e.g. rows from an incompatible schema) rolls back and the
  // current DB stays untouched.
  async importTables(tables: BackupPayload['tables']) {
    const db = await this.connect();
    await db.withTransactionAsync(async () => {
      for (const table of BACKUP_TABLES) {
        // A v1 file has no pcic_cards / mistake_* / usage_minutes: keep the local ones.
        const rows = tables[table];
        if (!rows) continue;
        await db.runAsync(`DELETE FROM ${table}`);
        for (const row of rows) {
          const cols = Object.keys(row);
          await db.runAsync(
            `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
            cols.map(c => row[c])
          );
        }
      }
    });
  }
}

let instance: DB;
export function getDb(): DB {
  if (!instance) instance = new DbCore(new SqliteStore());
  return instance;
}
