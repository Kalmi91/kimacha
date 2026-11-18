/** @jest-environment node */
import { openSqlJsDb, type SqlJsDriver } from '@/lib/testing/sqljsDriver';
import { applyMigrations, MIGRATIONS, runMigrations } from '@/lib/db/migrations';
import { validateBackupPayload } from '@/lib/backup';
import { MemoryDB } from '@/lib/database.web';
import { LearnerStore } from '@/lib/learner';
import { getDb } from '../database';

let mockDriver: SqlJsDriver;
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: async () => mockDriver }));
jest.unmock('../database');

const saved = { srsDay: '2026-11-07', srsDayStepOn: '2026-11-17' };

it('upgrades v7 once without changing existing cards or a chosen daily limit', async () => {
  const driver = await openSqlJsDb();
  try {
    await applyMigrations(driver as never, MIGRATIONS.filter((m) => m.version <= 7));
    await driver.execAsync("INSERT INTO learn_settings (pair, daily_new_limit) VALUES ('en-es', 25); INSERT INTO pcic_cards (pair, item_id, due) VALUES ('en-es', 'a1-old', '2026-11-01');");
    await runMigrations(driver as never);
    expect(await driver.getFirstAsync('SELECT daily_new_limit, no_pile_up, srs_day, srs_day_step_on FROM learn_settings')).toEqual({ daily_new_limit: 25, no_pile_up: null, srs_day: null, srs_day_step_on: null });
    expect(await driver.getFirstAsync('SELECT item_id, due FROM pcic_cards')).toEqual({ item_id: 'a1-old', due: '2026-11-01' });
    await driver.execAsync("UPDATE learn_settings SET no_pile_up = 0, srs_day = '2026-11-07', srs_day_step_on = '2026-11-17'");
    await runMigrations(driver as never);
    expect(await driver.getFirstAsync('SELECT no_pile_up, srs_day FROM learn_settings')).toEqual({ no_pile_up: 0, srs_day: '2026-11-07' });
  } finally {
    await driver.closeAsync();
  }
});

it('persists the native pair clock and setting through the learner store and backup, accepting old backups', async () => {
  mockDriver = await openSqlJsDb();
  try {
    const db = getDb();
    await db.setOnboarding('en', 'es');
    expect(await db.getNoPileUp()).toBe(true);
    expect(await db.getSrsDay()).toBeNull();
    expect(await db.getDailyNewLimit()).toBe(5);
    const learner = new LearnerStore();
    expect(await learner.refresh(['noPileUp'])).toMatchObject({ noPileUp: true });
    await learner.setNoPileUp(false);
    expect(learner.getState().noPileUp).toBe(false);
    await db.setSrsDay(saved);
    await db.setDailyNewLimit(25);
    const payload = validateBackupPayload(await db.exportAll());
    expect(payload.tables.learn_settings[0]).toMatchObject({ no_pile_up: 0, srs_day: saved.srsDay, srs_day_step_on: saved.srsDayStepOn });
    await db.setOnboarding('hu', 'es');
    expect(await db.getNoPileUp()).toBe(true);
    expect(await db.getSrsDay()).toBeNull();
    await db.importAll(payload);
    expect(await db.getNoPileUp()).toBe(false);
    expect(await db.getSrsDay()).toEqual(saved);
    expect(await db.getDailyNewLimit()).toBe(25);
    for (const row of payload.tables.learn_settings) {
      delete row.no_pile_up;
      delete row.srs_day;
      delete row.srs_day_step_on;
    }
    await db.importAll(validateBackupPayload(payload));
    expect(await db.getNoPileUp()).toBe(true);
    expect(await db.getSrsDay()).toBeNull();
    expect(await db.getDailyNewLimit()).toBe(25);
  } finally {
    await mockDriver.closeAsync();
  }
});

it('round-trips web clocks and switches through cloud state and native-compatible backups', async () => {
  const db = new MemoryDB();
  await db.setOnboarding('en', 'es');
  await db.setSrsDay(saved);
  await db.setNoPileUp(false);
  await db.setDailyNewLimit(30);
  await db.setOnboarding('hu', 'es');
  await db.setSrsDay({ srsDay: '2026-11-10', srsDayStepOn: '2026-11-17' });
  const restored = new MemoryDB();
  await restored.importState(await db.exportState());
  expect(await restored.getNoPileUp()).toBe(true);
  expect((await restored.getSrsDay())?.srsDay).toBe('2026-11-10');
  await restored.setOnboarding('en', 'es');
  expect(await restored.getNoPileUp()).toBe(false);
  expect(await restored.getSrsDay()).toEqual(saved);
  expect(await restored.getDailyNewLimit()).toBe(30);
  const backup = validateBackupPayload(await restored.exportAll());
  const fromBackup = new MemoryDB();
  await fromBackup.importAll(backup);
  expect(await fromBackup.getNoPileUp()).toBe(false);
  expect(await fromBackup.getSrsDay()).toEqual(saved);
  for (const row of backup.tables.learn_settings) {
    delete row.no_pile_up;
    delete row.srs_day;
    delete row.srs_day_step_on;
  }
  const legacy = new MemoryDB();
  await legacy.importAll(validateBackupPayload(backup));
  expect(await legacy.getNoPileUp()).toBe(true);
  expect(await legacy.getSrsDay()).toBeNull();
});
