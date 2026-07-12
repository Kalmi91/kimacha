import { createEmptyCard } from 'ts-fsrs';
import { getDb } from '../database.web';
import { BACKUP_SCHEMA_VERSION, BACKUP_TABLES, validateBackupPayload } from '../backup';

describe('backup export/import round-trip (memory db)', () => {
  const db = getDb();

  it('exports every table and restores an identical state', async () => {
    await db.setOnboarding('hu', 'en');
    await db.ensureCard(5001, 'word');
    const card = createEmptyCard();
    card.reps = 3;
    await db.updateCard(5001, 'word', card);
    await db.recordAttempt(5001, 'word', true, 1200);
    await db.updateLevel('A1', 2, 0, 0);
    await db.setWordsOnly(true);
    await db.setRandomTopics(true);
    await db.setFeedbackBtnSide('left');
    await db.setSelectedTopic('to_be');
    await db.addToSpellingList(5001);
    await db.updateStreak();

    const payload = await db.exportAll();
    expect(payload.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    for (const table of BACKUP_TABLES) {
      expect(Array.isArray(payload.tables[table])).toBe(true);
    }
    expect(payload.tables.cards).toHaveLength(1);
    expect(payload.tables.onboarding[0]).toMatchObject({ source: 'hu', target: 'en' });
    expect(payload.tables.spelling_list).toHaveLength(1);

    // Wreck the state, then restore from the payload.
    await db.resetAllProgress();
    await db.setSelectedTopic(null);
    await db.setWordsOnly(false);
    await db.setOnboarding('hu', 'es');

    await db.importAll(payload);
    const roundTrip = await db.exportAll();
    expect(roundTrip.tables).toEqual(payload.tables);

    // And the restored state behaves like the original through the public API.
    expect(await db.getOnboarding()).toEqual({ source: 'hu', target: 'en' });
    expect((await db.getLevel()).level).toBe('A1');
    expect(await db.getWordsOnly()).toBe(true);
    expect(await db.getRandomTopics()).toBe(true);
    expect(await db.getFeedbackBtnSide()).toBe('left');
    expect(await db.getSelectedTopic()).toBe('to_be');
    expect(await db.isInSpellingList(5001)).toBe(true);
    expect((await db.getWordReps([5001])).get(5001)).toBe(3);
  });
});

describe('validateBackupPayload', () => {
  const emptyTables = () => {
    const tables: any = {};
    for (const table of BACKUP_TABLES) tables[table] = [];
    return tables;
  };

  it('rejects junk input', () => {
    expect(() => validateBackupPayload(null)).toThrow();
    expect(() => validateBackupPayload('hello')).toThrow();
    expect(() => validateBackupPayload([])).toThrow();
    expect(() => validateBackupPayload({ schemaVersion: 999, tables: emptyTables() })).toThrow(/schema version/);
  });

  it('rejects a payload with a missing table', () => {
    const tables = emptyTables();
    delete tables.cards;
    expect(() =>
      validateBackupPayload({ schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: 'x', appVersion: 'y', tables })
    ).toThrow(/cards/);
  });

  it('accepts a well-formed payload', () => {
    const payload = validateBackupPayload({
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: 'x',
      appVersion: 'y',
      tables: emptyTables(),
    });
    expect(payload.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
  });
});
