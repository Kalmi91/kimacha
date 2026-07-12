import Constants from 'expo-constants';

// Q0: full learning-state backup. One JSON payload carrying every persisted
// table; written by DB.exportAll(), consumed by DB.importAll().
export const BACKUP_SCHEMA_VERSION = 1;

// Every persisted table, in import order. importAll clears + refills each.
export const BACKUP_TABLES = [
  'cards',
  'card_attempts',
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

// Throws on anything that isn't a payload this app version can import.
// Callers show the error message and leave the DB untouched.
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
  for (const table of BACKUP_TABLES) {
    if (!Array.isArray(p.tables[table])) {
      throw new Error(`Backup file is missing table: ${table}`);
    }
  }
  return p as BackupPayload;
}
