import Constants from 'expo-constants';

// Q0: full learning-state backup. One JSON payload carrying every persisted
// table; written by DB.exportAll(), consumed by DB.importAll().
export const BACKUP_SCHEMA_VERSION = 1;

// Every persisted table, in import order. importAll clears + refills each.
export const BACKUP_TABLES = [
  'cards',
  'card_attempts',
  'game_progress',
  'game_scores',
  'game_settings',
  'learn_settings',
  'onboarding',
  'selected_topic',
  'spelling_list',
  'streak',
  'user_level',
  'user_meta',
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

export interface BackupPayload {
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  tables: Record<BackupTable, any[]>;
}

export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? 'unknown';
}

// Play-vágás (2026-09-23): the per-table column types a row is checked
// against, taken straight from the CREATE TABLE statements in database.ts.
// SQLite has no boolean type, so the 0/1 flag columns (buried, in_hand,
// words_only, ...) are 'number' like every other INTEGER/REAL column.
type ColumnType = 'number' | 'string';
interface ColumnSpec {
  type: ColumnType;
  nullable: boolean;
}
const TABLE_COLUMNS: Record<BackupTable, Record<string, ColumnSpec>> = {
  cards: {
    id: { type: 'number', nullable: false },
    word_id: { type: 'number', nullable: false },
    type: { type: 'string', nullable: false },
    pair: { type: 'string', nullable: false },
    due: { type: 'string', nullable: false },
    stability: { type: 'number', nullable: false },
    difficulty: { type: 'number', nullable: false },
    elapsed_days: { type: 'number', nullable: false },
    scheduled_days: { type: 'number', nullable: false },
    learning_steps: { type: 'number', nullable: false },
    reps: { type: 'number', nullable: false },
    lapses: { type: 'number', nullable: false },
    state: { type: 'number', nullable: false },
    last_review: { type: 'string', nullable: true },
    buried: { type: 'number', nullable: false },
    learned_at: { type: 'string', nullable: true },
    lap: { type: 'number', nullable: false },
    in_hand: { type: 'number', nullable: false },
    started_at: { type: 'string', nullable: true },
  },
  card_attempts: {
    id: { type: 'number', nullable: false },
    word_id: { type: 'number', nullable: false },
    type: { type: 'string', nullable: false },
    pair: { type: 'string', nullable: true },
    correct: { type: 'number', nullable: false },
    response_time_ms: { type: 'number', nullable: false },
    timestamp: { type: 'string', nullable: false },
  },
  game_progress: {
    pair: { type: 'string', nullable: false },
    game_id: { type: 'string', nullable: false },
    item_id: { type: 'string', nullable: false },
    state: { type: 'string', nullable: false },
    data_json: { type: 'string', nullable: true },
  },
  game_scores: {
    pair: { type: 'string', nullable: false },
    game_id: { type: 'string', nullable: false },
    best_score: { type: 'number', nullable: false },
    best_at: { type: 'string', nullable: true },
    plays: { type: 'number', nullable: false },
    last_played: { type: 'string', nullable: true },
  },
  game_settings: {
    pair: { type: 'string', nullable: false },
    game_id: { type: 'string', nullable: false },
    settings_json: { type: 'string', nullable: false },
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
  selected_topic: {
    pair: { type: 'string', nullable: false },
    topic_id: { type: 'string', nullable: true },
  },
  spelling_list: {
    pair: { type: 'string', nullable: false },
    word_id: { type: 'number', nullable: false },
    step: { type: 'number', nullable: false },
    due: { type: 'string', nullable: false },
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
  if (p.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error(`Unsupported backup schema version: ${p.schemaVersion}`);
  }
  if (!p.tables || typeof p.tables !== 'object' || Array.isArray(p.tables)) {
    throw new Error('Backup file has no tables');
  }
  for (const key of Object.keys(p.tables)) {
    if (!(BACKUP_TABLES as readonly string[]).includes(key)) {
      throw new Error(`Backup file has an unknown table: ${key}`);
    }
  }
  for (const table of BACKUP_TABLES) {
    const rows = p.tables[table];
    if (!Array.isArray(rows)) {
      throw new Error(`Backup file is missing table: ${table}`);
    }
    const columns = TABLE_COLUMNS[table];
    rows.forEach((row: unknown, i: number) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new Error(`Backup file has an invalid row in table ${table} at index ${i}`);
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
