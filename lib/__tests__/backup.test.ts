import { getDb } from '@/lib/database.web';

// Verifies the backup serialization: a full export then a wipe then an import of
// that export must restore every kind of progress/setting. Uses the web MemoryDB
// (same table format the phone's SQLite export/import uses).
describe('progress backup round-trip (web DB)', () => {
  const empty = {
    app: 'kimacha' as const,
    version: 1,
    createdAt: '',
    tables: {
      cards: [], streak: [], card_attempts: [], onboarding: [],
      user_level: [], user_meta: [], selected_topic: [],
      learn_settings: [], spelling_list: [],
    },
  };

  it('exportAll then importAll restores full state', async () => {
    const db = getDb();
    await db.setOnboarding('en', 'es');
    await db.updateLevel('A1', 3, 1, 0);
    await db.ensureCard(1001, 'word');
    await db.recordAttempt(1001, 'word', true, 1200);
    await db.setWordsOnly(true);
    await db.setSelectedTopic('numeros');
    await db.addToSpellingList(1001);

    const backup = await db.exportAll();
    expect(backup.app).toBe('kimacha');
    expect(backup.tables.cards.length).toBe(1);
    expect(backup.tables.card_attempts.length).toBe(1);

    // Wipe everything, then confirm it's gone.
    await db.importAll(empty);
    expect((await db.exportAll()).tables.cards.length).toBe(0);
    expect(await db.getWordsOnly()).toBe(false);

    // Restore from the earlier backup.
    await db.importAll(backup);
    expect(await db.getWordsOnly()).toBe(true);
    expect((await db.getLevel()).level).toBe('A1');
    expect(await db.getSelectedTopic()).toBe('numeros');
    expect((await db.getSpellingList()).length).toBe(1);
    const restored = await db.exportAll();
    expect(restored.tables.cards.length).toBe(1);
    expect(restored.tables.card_attempts.length).toBe(1);
  });
});
