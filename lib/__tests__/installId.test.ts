// A new install no longer gets a random persistent id in user_meta.user_id (the
// column is NOT NULL and nothing reads it since the analytics removal), and a
// backup never carries one, even when the restored file still held an old id.

import { runMigrations } from '../db/migrations';
import { getDb } from '../database.web';
import { BACKUP_SCHEMA_VERSION, BACKUP_TABLES } from '../backup';

describe('user_meta.user_id (no install id)', () => {
  it('a fresh install inserts an empty user_id', async () => {
    const runAsync = jest.fn(async () => ({}));
    const fakeDb: any = {
      execAsync: jest.fn(async () => {}),
      runAsync,
      getFirstAsync: jest.fn(async () => null),
      getAllAsync: jest.fn(async () => []),
      withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => fn()),
    };
    await runMigrations(fakeDb);
    const insert = (runAsync.mock.calls as any[][]).find(([sql]) => String(sql).includes('INSERT INTO user_meta'));
    expect(insert).toBeDefined();
    expect(insert![1][0]).toBe('');
  });

  it('exportAll blanks user_id, also after restoring a backup that carried an id', async () => {
    const db = getDb();
    const tables: any = {};
    for (const table of BACKUP_TABLES) tables[table] = [];
    tables.user_meta = [{ id: 1, user_id: '3f1c0d52-1111-4222-8333-444455556666', first_use_date: '2026-09-08T00:00:00.000Z' }];
    await db.importAll({ schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: 'x', appVersion: 'y', tables });
    const out = await db.exportAll();
    expect(out.tables.user_meta[0].user_id).toBe('');
    expect(out.tables.user_meta[0].first_use_date).toBe('2026-09-08T00:00:00.000Z');
  });
});
