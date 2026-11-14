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

it('upgrades v4 once, preserves old settings and cards, and defaults the detector off', async () => {
  const driver = await openSqlJsDb();
  await applyMigrations(driver as never, MIGRATIONS.filter(m => m.version <= 4));
  await driver.execAsync("INSERT INTO learn_settings (pair, tired_button) VALUES ('en-es', 1); INSERT INTO pcic_cards (item_id, interval) VALUES ('a', 20);");
  await runMigrations(driver as never);
  expect(await driver.getFirstAsync('SELECT tired_button, fatigue_detector FROM learn_settings')).toEqual({ tired_button: 1, fatigue_detector: null });
  expect(await driver.getFirstAsync('SELECT item_id, interval FROM pcic_cards')).toEqual({ item_id: 'a', interval: 20 });
  await driver.execAsync('UPDATE learn_settings SET fatigue_detector = 1');
  await runMigrations(driver as never);
  expect(await driver.getFirstAsync('SELECT fatigue_detector FROM learn_settings')).toEqual({ fatigue_detector: 1 });
  await driver.closeAsync();
});
it('persists native defaults, learner state, per-pair settings and validated backup restoration', async () => {
  mockDriver = await openSqlJsDb();
  const db = getDb();
  await db.setOnboarding('en', 'es');
  expect(await db.getFatigueDetector()).toBe(false);
  const store = new LearnerStore();
  expect(await store.refresh(['fatigueDetector'])).toMatchObject({ fatigueDetector: false });
  await store.setFatigueDetector(true);
  expect(store.getState().fatigueDetector).toBe(true);
  const payload = validateBackupPayload(await db.exportAll());
  expect(payload.tables.learn_settings[0]).toMatchObject({ fatigue_detector: 1 });
  expect(Object.keys(payload.tables)).not.toContain('answer_log');
  await db.setFatigueDetector(false); await db.importAll(payload);
  expect(await db.getFatigueDetector()).toBe(true);
  await db.setOnboarding('es', 'en'); expect(await db.getFatigueDetector()).toBe(false);
  await db.setOnboarding('en', 'es'); expect(await db.getFatigueDetector()).toBe(true);
  await mockDriver.closeAsync();
});
it('persists the web setting in cloud state and keeps language pairs independent', async () => {
  const db = new MemoryDB();
  await db.setOnboarding('en', 'es');
  expect(await db.getFatigueDetector()).toBe(false);
  await db.setFatigueDetector(true);
  const payload = await db.exportState();
  await db.setFatigueDetector(false); await db.importState(payload);
  expect(await db.getFatigueDetector()).toBe(true);
  await db.setOnboarding('es', 'en'); expect(await db.getFatigueDetector()).toBe(false);
});
