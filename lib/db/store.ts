// The seam between the shared DB layer (lib/db/core.ts) and the two drivers: SQLite on device
// (lib/database.ts) and the in-memory store on web and in tests (lib/database.web.ts).
// A store only reads and writes raw column values; every default, validation, fallback
// and merge lives once in DbCore. Column names are the SQL schema's (lib/db/migrations.ts).

import type { BackupPayload } from '../backup';
import type { DB } from '../dbTypes';
import type { MistakeBatchRow } from '../mistakes/deck';
import type { Sm2Card } from '../sm2';

// user_meta singleton columns (id = 1), app-wide.
export type MetaColumn =
  | 'last_open_date'
  | 'status_bar_tint'
  | 'grammar_palette'
  | 'skin'
  | 'skin_mix'
  | 'beta_flags'
  | 'practice_round';

// learn_settings columns, one row per language pair.
export type SettingColumn =
  | 'strict_accents'
  | 'again_delay_sec'
  | 'article_picker'
  | 'weekly_goal_minutes'
  | 'daily_new_limit'
  | 'new_bonus'
  | 'new_bonus_date'
  | 'feedback_btn_side'
  | 'pcic_level';

export type StreakRow = Awaited<ReturnType<DB['getStreak']>>;
export type LevelRow = Awaited<ReturnType<DB['getLevel']>>;
export type GameProgressRow = Awaited<ReturnType<DB['getGameProgress']>>[number];

export interface DbStore {
  // Resolves once the store is usable (native: opened and migrated, one shared promise, a failed
  // open is retried by the next call). Returns the language pair the migration found, or null.
  open(): Promise<string | null>;

  readStreak(): Promise<StreakRow>;
  writeStreak(streak: StreakRow): Promise<void>;
  readOnboarding(): Promise<{ source: string; target: string } | null>;
  writeOnboarding(source: string, target: string): Promise<void>;
  readLevel(pair: string): Promise<LevelRow>;

  readMeta(column: MetaColumn): Promise<unknown>;
  writeMeta(column: MetaColumn, value: unknown): Promise<void>;
  // null = the pair has no learn_settings row yet; only the asked columns are guaranteed present.
  readSettings(pair: string, columns: SettingColumn[]): Promise<Record<string, any> | null>;
  writeSettings(pair: string, values: Partial<Record<SettingColumn, unknown>>): Promise<void>;

  // Adds one minute to the day and returns the day's new total.
  addUsageMinute(date: string): Promise<number>;
  readUsage(): Promise<{ date: string; minutes: number }[]>;
  readUsageMinutes(date: string): Promise<number>;
  countPcicIntroducedOn(date: string): Promise<number>;
  readDailyXpTenths(date: string): Promise<number>;
  // Adds `delta` tenths to the day's total (never below 0).
  addDailyXpTenths(date: string, delta: number): Promise<void>;

  readGameProgress(pair: string, gameId: string): Promise<GameProgressRow[]>;
  writeGameProgress(pair: string, gameId: string, itemId: string, state: string, data: unknown): Promise<void>;
  deleteGameProgress(pair: string, gameId: string): Promise<void>;

  readPcicCards(): Promise<Sm2Card[]>;
  readPcicCard(itemId: string): Promise<Sm2Card | null>;
  writePcicCard(card: Sm2Card): Promise<void>;
  // No ids = the whole table.
  deletePcicCards(itemIds?: string[]): Promise<void>;
  writeMistakeBatch(batchId: string, json: string, importedAt: string): Promise<void>;
  readMistakeBatches(): Promise<MistakeBatchRow[]>;
  readMistakeCards(): Promise<Sm2Card[]>;
  writeMistakeCard(card: Sm2Card): Promise<void>;

  // Every backup table as plain rows / replaces the stored state from them (lib/backup.ts).
  exportTables(): Promise<BackupPayload['tables']>;
  importTables(tables: BackupPayload['tables']): Promise<void>;
}
