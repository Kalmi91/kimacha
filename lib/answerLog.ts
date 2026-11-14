import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { MAX_ANSWER_ROWS, formatAnswerLog, isAnswerLogEntry, type AnswerLogEntry } from './answerLogFormat';

export { MAX_ANSWER_ROWS, type AnswerLogEntry } from './answerLogFormat';
let database: SQLiteDatabase | null = null;

function getLogDb(): SQLiteDatabase {
  if (database) return database;
  const db = openDatabaseSync('kimacha-diagnostics.db');
  try {
    db.execSync(`CREATE TABLE IF NOT EXISTS answer_log (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      at INTEGER NOT NULL, pair TEXT NOT NULL, itemId TEXT NOT NULL,
      thinkMs INTEGER NOT NULL, knew INTEGER NOT NULL
    );`);
    database = db;
    return db;
  } catch (error) {
    db.closeSync();
    throw error;
  }
}

const decode = (rows: (Omit<AnswerLogEntry, 'knew'> & { knew: number })[]): AnswerLogEntry[] =>
  rows.map(row => ({ at: row.at, pair: row.pair, itemId: row.itemId, thinkMs: row.thinkMs, knew: row.knew === 1 }));

// Diagnostics must never interrupt grading, even when storage is unavailable.
export const answerLog = {
  append(entry: AnswerLogEntry): void {
    try {
      if (!isAnswerLogEntry(entry)) return;
      const db = getLogDb();
      db.withTransactionSync(() => {
        db.runSync('INSERT INTO answer_log (at, pair, itemId, thinkMs, knew) VALUES (?, ?, ?, ?, ?)',
          [entry.at, entry.pair, entry.itemId, entry.thinkMs, entry.knew ? 1 : 0]);
        db.runSync(`DELETE FROM answer_log WHERE seq NOT IN (SELECT seq FROM answer_log ORDER BY seq DESC LIMIT ${MAX_ANSWER_ROWS})`);
      });
    } catch { /* Diagnostic storage is best effort. */ }
  },
  recent(pair: string, limit = MAX_ANSWER_ROWS): AnswerLogEntry[] {
    try {
      if (!Number.isSafeInteger(limit) || limit <= 0) return [];
      return decode(getLogDb().getAllSync('SELECT at, pair, itemId, thinkMs, knew FROM answer_log WHERE pair = ? ORDER BY at DESC, seq DESC LIMIT ?',
        [pair, Math.min(limit, MAX_ANSWER_ROWS)])).reverse();
    } catch { return []; }
  },
  removeLast(pair: string, itemId: string): void {
    try {
      getLogDb().runSync('DELETE FROM answer_log WHERE seq = (SELECT seq FROM answer_log WHERE pair = ? ORDER BY seq DESC LIMIT 1) AND itemId = ?', [pair, itemId]);
    } catch { /* Diagnostic storage is best effort. */ }
  },
  exportText(): string {
    try {
      return formatAnswerLog(decode(getLogDb().getAllSync('SELECT at, pair, itemId, thinkMs, knew FROM answer_log ORDER BY at, seq')));
    } catch { return ''; }
  },
};
