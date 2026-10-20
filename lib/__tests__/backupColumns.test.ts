/** @jest-environment node */
// The hand-kept column table of the backup validator (TABLE_COLUMNS in lib/backup.ts) against the
// REAL schema a new install gets (sql.js + lib/db/migrations.ts, PRAGMA table_info): a column added
// to a migration but not to the table, a typo, a wrong type or a wrong nullability turns red here
// instead of silently skipping the type check of a restore.

import { openSqlJsDb } from '@/lib/testing/sqljsDriver';
import { runMigrations } from '../db/migrations';
import { BACKUP_TABLES, TABLE_COLUMNS } from '../backup';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: async () => ({}) }));

// Columns that exist in the schema but are deliberately not type-checked on a restore (a restore
// keeps them anyway, see backup.test.ts "keeps columns that are missing from the type table").
const UNTYPED_COLUMNS: Record<string, string[]> = {
  learn_settings: ['again_delay_sec', 'pcic_level'],
  user_meta: ['pcic_level'],
};

interface TableInfoRow {
  name: string;
  type: string;
  notnull: number;
  pk: number;
}

describe('backup TABLE_COLUMNS vs the real schema (PRAGMA table_info)', () => {
  it.each([...BACKUP_TABLES])('%s: same columns, types and nullability', async (table) => {
    const db = await openSqlJsDb();
    await runMigrations(db as any);
    const info = await db.getAllAsync<TableInfoRow>(`PRAGMA table_info(${table})`);
    const spec = TABLE_COLUMNS[table];
    const untyped = UNTYPED_COLUMNS[table] ?? [];

    expect(info.map((c) => c.name).filter((n) => !untyped.includes(n)).sort()).toEqual(Object.keys(spec).sort());
    for (const col of info.filter((c) => !untyped.includes(c.name))) {
      const type = /INT|REAL/i.test(col.type) ? 'number' : 'string';
      // a primary key is never null in a stored row, even where SQLite does not flag it NOT NULL
      const nullable = col.notnull === 0 && col.pk === 0;
      expect({ col: col.name, ...spec[col.name] }).toEqual({ col: col.name, type, nullable });
    }
    for (const name of untyped) expect(info.map((c) => c.name)).toContain(name);
  });
});
