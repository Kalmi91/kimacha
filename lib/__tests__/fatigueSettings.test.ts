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

it('upgrades an existing v3 database without changing its settings or cards; rerunning preserves the flags', async () => {
  const driver = await openSqlJsDb();
  await applyMigrations(driver as never, MIGRATIONS.filter((m) => m.version <= 3));
  await driver.execAsync("INSERT INTO learn_settings (pair, strict_accents) VALUES ('en-es', 1); INSERT INTO pcic_cards (item_id, interval) VALUES ('a', 20);");
  await runMigrations(driver as never);
  expect(await driver.getFirstAsync('SELECT strict_accents, tired_button, miss_cap FROM learn_settings')).toEqual({ strict_accents: 1, tired_button: null, miss_cap: null });
  expect(await driver.getFirstAsync('SELECT item_id, interval FROM pcic_cards')).toEqual({ item_id: 'a', interval: 20 });
  await driver.execAsync('UPDATE learn_settings SET tired_button = 1, miss_cap = 1');
  await runMigrations(driver as never);
  expect(await driver.getFirstAsync('SELECT tired_button, miss_cap FROM learn_settings')).toEqual({ tired_button: 1, miss_cap: 1 });
  await driver.closeAsync();
});

it('native defaults, learner actions, per-pair settings and backup restore include both flags', async () => {
  mockDriver = await openSqlJsDb();
  const db = getDb();
  await db.setOnboarding('en', 'es');
  expect(await db.getTiredButton()).toBe(false);
  expect(await db.getMissCap()).toBe(false);
  const store = new LearnerStore();
  expect(await store.refresh(['tiredButton', 'missCap'])).toMatchObject({ tiredButton: false, missCap: false });
  await store.setTiredButton(true);
  await store.setMissCap(true);
  expect(store.getState()).toMatchObject({ tiredButton: true, missCap: true });
  await db.setStrictAccents(true);
  const backup = await db.exportAll();
  const validated = validateBackupPayload(backup);
  expect(validated.tables.learn_settings).toEqual(backup.tables.learn_settings);
  await db.setTiredButton(false);
  await db.setMissCap(false);
  await db.importAll(backup);
  expect(await db.getTiredButton()).toBe(true);
  expect(await db.getMissCap()).toBe(true);
  expect(await db.getStrictAccents()).toBe(true);
  await db.setOnboarding('es', 'en');
  expect(await db.getTiredButton()).toBe(false);
  expect(await db.getMissCap()).toBe(false);
  await db.setOnboarding('en', 'es');
  expect(await store.refresh(['tiredButton', 'missCap'])).toMatchObject({ tiredButton: true, missCap: true });
  await mockDriver.closeAsync();
});

it('web cloud state restores the fatigue flags just like accent strictness', async () => {
  const source = new MemoryDB();
  await source.setOnboarding('en', 'es');
  expect(await source.getTiredButton()).toBe(false);
  expect(await source.getMissCap()).toBe(false);
  await source.setStrictAccents(true);
  await source.setTiredButton(true);
  await source.setMissCap(true);
  const restored = new MemoryDB();
  await restored.importState(await source.exportState());
  expect(await restored.getStrictAccents()).toBe(true);
  expect(await restored.getTiredButton()).toBe(true);
  expect(await restored.getMissCap()).toBe(true);
});
