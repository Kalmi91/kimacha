import Constants from 'expo-constants';

// Q0: full learning-state backup. One JSON payload carrying every persisted
// table; written by DB.exportAll(), consumed by DB.importAll().
// v2 adds the main learning progress (pcic_cards, the mistake_* tables) and the
// usage minutes; a v1 file is still restored (see V1_BACKUP_TABLES).
export const BACKUP_SCHEMA_VERSION = 2;

// Every persisted table, in import order. importAll clears + refills each
// table the payload carries.
export const BACKUP_TABLES = [
  'game_progress',
  'learn_settings',
  'onboarding',
  'streak',
  'user_level',
  'user_meta',
  'pcic_cards',
  'mistake_batches',
  'mistake_cards',
  'usage_minutes',
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

// The tables a v1 file carries (besides the legacy ones below). A v1 file has no
// pcic_cards / mistake_* / usage_minutes: the restore leaves those local tables alone.
const V1_BACKUP_TABLES: readonly BackupTable[] = [
  'game_progress',
  'learn_settings',
  'onboarding',
  'streak',
  'user_level',
  'user_meta',
];

// Play cut: tables an older backup (e.g. 4.0.25) may
// still carry, but the app no longer reads or writes (their DB methods were
// removed as dead: the Game tab's own score/settings tables, and the topic
// picker). A restore accepts and skips them, so an old backup still loads.
// The spelling-practice lists went the same way when the feature was removed
// (the tables stay in the schema, nothing reads or writes them). cards and
// card_attempts (the old FSRS progress, no writer or reader left) went with v2.
const LEGACY_BACKUP_TABLES = [
  'cards',
  'card_attempts',
  'game_scores',
  'game_settings',
  'selected_topic',
  'spelling_list',
  'pcic_spelling_list',
] as const;

export interface BackupPayload {
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  tables: Record<BackupTable, any[]>;
}

export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? 'unknown';
}

// Play cut (2026-09-23): the per-table column types a row is checked
// against, taken straight from the CREATE TABLE statements in database.ts.
// SQLite has no boolean type, so the 0/1 flag columns (buried, in_hand,
// words_only, ...) are 'number' like every other INTEGER/REAL column.
type ColumnType = 'number' | 'string';
interface ColumnSpec {
  type: ColumnType;
  nullable: boolean;
}
const TABLE_COLUMNS: Record<BackupTable, Record<string, ColumnSpec>> = {
  game_progress: {
    pair: { type: 'string', nullable: false },
    game_id: { type: 'string', nullable: false },
    item_id: { type: 'string', nullable: false },
    state: { type: 'string', nullable: false },
    data_json: { type: 'string', nullable: true },
  },
  learn_settings: {
    pair: { type: 'string', nullable: false },
    words_only: { type: 'number', nullable: true },
    random_topics: { type: 'number', nullable: true },
    strict_accents: { type: 'number', nullable: true },
    article_picker: { type: 'number', nullable: true },
    requeue_level: { type: 'string', nullable: true },
    feedback_btn_side: { type: 'string', nullable: true },
    weekly_goal_minutes: { type: 'number', nullable: true },
    daily_new_limit: { type: 'number', nullable: true },
    new_bonus: { type: 'number', nullable: true },
    new_bonus_date: { type: 'string', nullable: true },
    hand_cap: { type: 'number', nullable: true },
    gap_laps: { type: 'number', nullable: true },
    repair_gap: { type: 'number', nullable: true },
  },
  onboarding: {
    id: { type: 'number', nullable: false },
    source: { type: 'string', nullable: false },
    target: { type: 'string', nullable: false },
  },
  streak: {
    id: { type: 'number', nullable: false },
    current_count: { type: 'number', nullable: false },
    last_date: { type: 'string', nullable: true },
    longest_count: { type: 'number', nullable: false },
  },
  user_level: {
    pair: { type: 'string', nullable: false },
    level: { type: 'string', nullable: false },
    correct_streak: { type: 'number', nullable: false },
    mistakes_in_window: { type: 'number', nullable: false },
    fail_streak: { type: 'number', nullable: false },
  },
  user_meta: {
    id: { type: 'number', nullable: false },
    user_id: { type: 'string', nullable: false },
    first_use_date: { type: 'string', nullable: false },
    last_sync_date: { type: 'string', nullable: true },
    last_open_date: { type: 'string', nullable: true },
    status_bar_tint: { type: 'number', nullable: true },
    grammar_palette: { type: 'string', nullable: true },
    skin: { type: 'string', nullable: true },
    skin_mix: { type: 'string', nullable: true },
  },
  pcic_cards: {
    item_id: { type: 'string', nullable: false },
    state: { type: 'string', nullable: false },
    step: { type: 'number', nullable: false },
    ease: { type: 'number', nullable: false },
    interval: { type: 'number', nullable: false },
    reps: { type: 'number', nullable: false },
    lapses: { type: 'number', nullable: false },
    due: { type: 'string', nullable: false },
    last_review: { type: 'string', nullable: true },
    introduced_at: { type: 'string', nullable: true },
    known: { type: 'number', nullable: false },
  },
  mistake_batches: {
    batch_id: { type: 'string', nullable: false },
    json: { type: 'string', nullable: false },
    imported_at: { type: 'string', nullable: false },
  },
  mistake_cards: {
    item_id: { type: 'string', nullable: false },
    state: { type: 'string', nullable: false },
    step: { type: 'number', nullable: false },
    ease: { type: 'number', nullable: false },
    interval: { type: 'number', nullable: false },
    reps: { type: 'number', nullable: false },
    lapses: { type: 'number', nullable: false },
    due: { type: 'string', nullable: false },
    last_review: { type: 'string', nullable: true },
    introduced_at: { type: 'string', nullable: true },
    known: { type: 'number', nullable: false },
  },
  usage_minutes: {
    date: { type: 'string', nullable: false },
    minutes: { type: 'number', nullable: false },
  },
};

// Throws on anything that isn't a payload this app version can import.
// Callers show the error message and leave the DB untouched: validation runs
// to completion (or throws) before importAll ever gets to write a row.
export function validateBackupPayload(raw: unknown): BackupPayload {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Not a Kimacha backup file');
  }
  const p = raw as any;
  if (p.schemaVersion !== 1 && p.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error(`Unsupported backup schema version: ${p.schemaVersion}`);
  }
  if (!p.tables || typeof p.tables !== 'object' || Array.isArray(p.tables)) {
    throw new Error('Backup file has no tables');
  }
  for (const key of Object.keys(p.tables)) {
    if ((BACKUP_TABLES as readonly string[]).includes(key)) continue;
    if ((LEGACY_BACKUP_TABLES as readonly string[]).includes(key)) continue;
    throw new Error(`Backup file has an unknown table: ${key}`);
  }
  const required: readonly BackupTable[] = p.schemaVersion === 1 ? V1_BACKUP_TABLES : BACKUP_TABLES;
  for (const table of BACKUP_TABLES) {
    const rows = p.tables[table];
    if (rows === undefined && !required.includes(table)) continue;
    if (!Array.isArray(rows)) {
      throw new Error(`Backup file is missing table: ${table}`);
    }
    const columns = TABLE_COLUMNS[table];
    rows.forEach((row: unknown, i: number) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new Error(`Backup file has an invalid row in table ${table} at index ${i}`);
      }
      // importAll builds the INSERT column list from these keys, so a key that is
      // not a plain column identifier would end up inside the SQL text.
      for (const col of Object.keys(row)) {
        if (!/^[a-z_][a-z0-9_]*$/.test(col)) {
          throw new Error(`Backup file has an invalid column name in table ${table} at index ${i}`);
        }
      }
      for (const [col, spec] of Object.entries(columns)) {
        if (!(col in (row as any))) continue;
        const value = (row as any)[col];
        if (value === null) {
          if (!spec.nullable) throw new Error(`Backup file has a wrong-type value: ${table}.${col}`);
          continue;
        }
        if (typeof value !== spec.type) {
          throw new Error(`Backup file has a wrong-type value: ${table}.${col}`);
        }
      }
    });
  }
  return p as BackupPayload;
}
