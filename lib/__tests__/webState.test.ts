import { MemoryDB, MemoryStore, exportWebState, getDb, importWebState } from '@/lib/database.web';
import type { Sm2Card } from '@/lib/sm2';
import { localDateString } from '@/lib/usageStats';

// The web store's whole state, for the cloud save (MemoryStore.serializeState / restoreState). The backup format
// (exportTables / importTables) leaves parts of the learning state out; these tests hold this one to everything.

const card: Sm2Card = {
  itemId: 'a1-0001',
  state: 'review',
  step: 0,
  ease: 2.3,
  interval: 6,
  reps: 3,
  lapses: 1,
  due: '2026-10-30',
  lastReview: '2026-10-23',
  introducedAt: '2026-10-20',
  known: false,
  halfSteps: 1,
  wrongStreak: 1,
};

function fresh() {
  const store = new MemoryStore();
  return { store, db: new MemoryDB(store) };
}

// Gives EVERY field of the store a non-default value, through the DB API where there is one.
async function fillEverything({ store, db }: ReturnType<typeof fresh>) {
  const today = localDateString();
  await db.setOnboarding('en', 'es');
  await db.setPcicLevel('A1');
  await db.setStrictAccents(true);
  await db.setAgainDelaySec(90);
  await db.setArticlePicker(false);
  await db.setWeeklyGoalMinutes(45);
  await db.setDailyNewLimit(7);
  await db.setPcicNewBonus(10, today);
  await db.setFeedbackBtnSide('left');
  await db.setStatusBarTint(2);
  await db.setBetaFlag('someFlag', true);
  await db.setPracticeRound('{"round":1}');
  await db.setSkin('brutal');
  await db.addDailyXpTenths(today, 30);
  await db.addUsageMinute();
  await db.updateStreak();
  expect(await db.claimDailyGreeting()).toBe(true);
  await db.upsertPcicCard(card);
  await db.upsertMistakeCard({ ...card, itemId: 'm-0001' });
  await db.saveMistakeBatch('batch-1', '{"items":[1]}', '2026-10-20T10:00:00.000Z');
  await db.setGameProgress('grammar', 'topic-1', 'done', { score: 3 });
  db.__setLevelForTest('B2');
  (store as any).userMeta = { userId: 'u-1', firstUseDate: '2026-01-01T00:00:00.000Z', lastSyncDate: '2026-10-22' };
}

describe('web state round trip', () => {
  it('brings back the learning state the backup format drops (PCIC level, XP, greeting, settings, card)', async () => {
    const source = fresh();
    await fillEverything(source);
    const raw = source.store.serializeState();

    const target = fresh();
    await target.db.importState(raw);
    const today = localDateString();

    expect(await target.db.getOnboarding()).toEqual({ source: 'en', target: 'es' });
    expect(await target.db.getPcicLevel()).toBe('A1');
    expect(await target.db.hasPcicLevel()).toBe(true);
    expect(await target.db.getStrictAccents()).toBe(true);
    expect(await target.db.getAgainDelaySec()).toBe(90);
    expect(await target.db.getArticlePicker()).toBe(false);
    expect(await target.db.getWeeklyGoalMinutes()).toBe(45);
    expect(await target.db.getDailyNewLimit()).toBe(7);
    expect(await target.db.getPcicNewBonus(today)).toBe(10);
    expect(await target.db.getFeedbackBtnSide()).toBe('left');
    expect(await target.db.getStatusBarTint()).toBe(2);
    expect(await target.db.getBetaFlags()).toEqual({ someFlag: true });
    expect(await target.db.getPracticeRound()).toBe('{"round":1}');
    expect(await target.db.getSkin()).toBe('brutal');
    expect(await target.db.getDailyXpTenths(today)).toBe(30);
    expect(await target.db.getStreak()).toEqual(await source.db.getStreak());
    expect(await target.db.getLevel()).toEqual(await source.db.getLevel());
    expect(await target.db.getUsageStats()).toEqual(await source.db.getUsageStats());
    expect(await target.db.getPcicCard(card.itemId)).toEqual(await source.db.getPcicCard(card.itemId));
    expect(await target.db.getMistakeCards()).toEqual(await source.db.getMistakeCards());
    expect(await target.db.getMistakeBatches()).toEqual(await source.db.getMistakeBatches());
    expect(await target.db.getGameProgress('grammar')).toEqual([{ itemId: 'topic-1', state: 'done', data: { score: 3 } }]);
    // the daily greeting was claimed before the save: it must not come up again after the restore
    expect(await target.db.claimDailyGreeting()).toBe(false);
  });

  it('is lossless: the restored store serializes to the very same string', async () => {
    const source = fresh();
    await fillEverything(source);
    const target = fresh();
    await target.db.importState(source.store.serializeState());
    expect(target.store.serializeState()).toBe(source.store.serializeState());
  });

  it('follows the restored onboarding with the active pair, and corrects a pair that is no longer supported', async () => {
    const old = fresh();
    await old.db.setOnboarding('fr', 'es');
    const target = fresh();
    await target.db.importState(old.store.serializeState());
    expect(await target.db.getOnboarding()).toEqual({ source: 'en', target: 'es' });
  });

  it('works on the getDb() singleton through exportWebState / importWebState', async () => {
    const db = getDb();
    await db.setOnboarding('en', 'es');
    await db.setPcicLevel('A1');
    const raw = await exportWebState();
    await db.setPcicLevel('C1');
    await importWebState(raw);
    expect(await db.getPcicLevel()).toBe('A1');
  });

  it('rejects a string that is not a web state and leaves the store as it was', async () => {
    const target = fresh();
    await fillEverything(target);
    const before = target.store.serializeState();
    const good = JSON.parse(before);
    for (const bad of [
      'not json',
      'null',
      JSON.stringify({ schemaVersion: 2, tables: {} }),
      JSON.stringify({ ...good, v: 2 }),
      JSON.stringify({ ...good, streak: null }),
      JSON.stringify({ ...good, settings: 'x' }),
      JSON.stringify({ ...good, pcicCards: [['a', 'b'], 5] }),
      JSON.stringify({ ...good, gameProgress: [['p:g', 'not an array']] }),
    ]) {
      await expect(target.db.importState(bad)).rejects.toThrow();
      expect(target.store.serializeState()).toBe(before);
    }
  });
});

describe('web state guard', () => {
  // Fails when a field is added to MemoryStore and forgotten in serializeState / restoreState:
  // the new field is in no list below, so it either is missing from the output or not restored.
  it('lists every own field of MemoryStore in the serialized state', () => {
    const store = new MemoryStore();
    const keys = Object.keys(JSON.parse(store.serializeState()));
    const fields = Object.keys(store);
    expect(fields.length).toBeGreaterThan(8);
    for (const field of fields) expect(keys).toContain(field);
  });

  it('restores every own field of MemoryStore', async () => {
    const source = fresh();
    await fillEverything(source);
    const filled = JSON.parse(source.store.serializeState());
    const empty = JSON.parse(new MemoryStore().serializeState());
    const target = fresh();
    await target.db.importState(source.store.serializeState());
    const restored = JSON.parse(target.store.serializeState());
    for (const field of Object.keys(source.store)) {
      // the fill really changed the field (a field nobody fills would pass the next line for nothing) ...
      expect({ field, differs: JSON.stringify(filled[field]) !== JSON.stringify(empty[field]) }).toEqual({ field, differs: true });
      // ... and the restore brought it back
      expect({ field, value: restored[field] }).toEqual({ field, value: filled[field] });
    }
  });
});
