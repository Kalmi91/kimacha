import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { MAX_LOG_ROWS, newProcessExits, exitEntry, formatAppLog, type AppLogEntry, type ProcessExit } from './appLogFormat';

let database: SQLiteDatabase | null = null;

// Separate from learning-state backup and cloud sync. Sync writes finish before
// the previous fatal-error handler can terminate the process.
function getLogDb(): SQLiteDatabase {
  if (database) return database;
  const db = openDatabaseSync('kimacha-diagnostics.db');
  try {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS app_log (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        version TEXT NOT NULL,
        event TEXT NOT NULL,
        message TEXT NOT NULL,
        stack TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS diagnostics_meta (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        exit_seen INTEGER NOT NULL
      );
      INSERT OR IGNORE INTO diagnostics_meta (id, exit_seen) VALUES (1, 0);
    `);
    database = db;
    return db;
  } catch (error) {
    db.closeSync();
    throw error;
  }
}

function insert(db: SQLiteDatabase, entry: AppLogEntry): void {
  db.runSync('INSERT INTO app_log (timestamp, version, event, message, stack) VALUES (?, ?, ?, ?, ?)',
    [entry.timestamp, entry.version, entry.event, entry.message, entry.stack]);
}

function prune(db: SQLiteDatabase): void {
  db.runSync(`DELETE FROM app_log WHERE seq NOT IN (SELECT seq FROM app_log ORDER BY seq DESC LIMIT ${MAX_LOG_ROWS})`);
}

export const appLog = {
  append(entry: AppLogEntry): void {
    const db = getLogDb();
    db.withTransactionSync(() => {
      insert(db, entry);
      prune(db);
    });
  },

  lastExitTimestamp(): number {
    return getLogDb().getFirstSync<{ exit_seen: number }>('SELECT exit_seen FROM diagnostics_meta WHERE id = 1')!.exit_seen;
  },

  recordExits(exits: ProcessExit[]): void {
    const db = getLogDb();
    db.withTransactionSync(() => {
      const fresh = newProcessExits(exits, appLog.lastExitTimestamp());
      if (!fresh.length) return;
      for (const exit of fresh) insert(db, exitEntry(exit));
      prune(db);
      // The cursor and rows commit together, including on a process restart.
      db.runSync('UPDATE diagnostics_meta SET exit_seen = ? WHERE id = 1', [fresh[fresh.length - 1].timestamp]);
    });
  },

  exportText(): string {
    return formatAppLog(getLogDb().getAllSync<AppLogEntry>('SELECT timestamp, version, event, message, stack FROM app_log ORDER BY seq'));
  },
};
