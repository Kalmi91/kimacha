// Shared shape for a full progress backup (used by both the SQLite and the web
// MemoryDB implementations, plus lib/backup.ts). A backup is a plain JSON dump of
// every progress table, so a file saved on one phone restores 1:1 on another.
// Pure types + constants only, no native deps, so it is safe to import anywhere.

export const BACKUP_VERSION = 1;

// Every table that holds user progress/settings. Order matters for restore only
// in that onboarding is read afterwards to refresh the active pair.
export const BACKUP_TABLES = [
  'cards',
  'streak',
  'card_attempts',
  'onboarding',
  'user_level',
  'user_meta',
  'selected_topic',
  'learn_settings',
  'spelling_list',
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

export interface BackupData {
  app: 'kimacha';
  version: number;
  createdAt: string; // ISO timestamp of when the backup was taken
  tables: Record<string, any[]>; // table name → row objects
}

export function isBackupData(x: any): x is BackupData {
  return !!x && x.app === 'kimacha' && typeof x.version === 'number' && !!x.tables && typeof x.tables === 'object';
}
