// A real SQLite (sql.js, pure JS, in memory) behind the async surface of expo-sqlite's
// SQLiteDatabase that lib/database.ts and lib/db/migrations.ts use: execAsync, runAsync,
// getAllAsync, getFirstAsync, withTransactionAsync, closeAsync. Tests run the real SQL
// against it instead of regex fakes, so syntax errors, constraint failures and rollbacks
// show up for real.

// The asm.js build of sql.js (same SQLite, no native build): the wasm build fails to open a
// database inside jest's sandbox ("new SQL.Database()" throws an empty Error), this one does not.
const initSqlJs = require('sql.js/dist/sql-asm.js');

let sqlPromise: Promise<any> | null = null;
function loadSql(): Promise<any> {
  if (!sqlPromise) sqlPromise = initSqlJs();
  return sqlPromise as Promise<any>;
}

// expo-sqlite takes the bind values as one array, a spread list, or a named object.
function bindValues(params: unknown[]): any {
  if (params.length === 1 && Array.isArray(params[0])) params = params[0];
  else if (params.length === 1 && params[0] && typeof params[0] === 'object' && !(params[0] instanceof Uint8Array)) {
    return params[0];
  }
  return params.map((v) => (v === undefined ? null : v));
}

export class SqlJsDriver {
  constructor(private readonly db: any) {}

  async execAsync(source: string): Promise<void> {
    this.db.exec(source);
  }

  async runAsync(source: string, ...params: unknown[]): Promise<{ changes: number; lastInsertRowId: number }> {
    this.db.run(source, bindValues(params));
    const changes = this.db.getRowsModified();
    const last = this.db.exec('SELECT last_insert_rowid() AS id');
    return { changes, lastInsertRowId: last[0].values[0][0] as number };
  }

  async getAllAsync<T = any>(source: string, ...params: unknown[]): Promise<T[]> {
    const stmt = this.db.prepare(source);
    try {
      stmt.bind(bindValues(params));
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      return rows;
    } finally {
      stmt.free();
    }
  }

  async getFirstAsync<T = any>(source: string, ...params: unknown[]): Promise<T | null> {
    const rows = await this.getAllAsync<T>(source, ...params);
    return rows[0] ?? null;
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.db.exec('BEGIN');
    try {
      await task();
      this.db.exec('COMMIT');
    } catch (e) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // SQLite already rolled the transaction back on its own
      }
      throw e;
    }
  }

  async closeAsync(): Promise<void> {
    this.db.close();
  }
}

export async function openSqlJsDb(): Promise<SqlJsDriver> {
  const SQL = await loadSql();
  return new SqlJsDriver(new SQL.Database());
}
