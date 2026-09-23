import { getDb } from '../database.web';
import { BACKUP_SCHEMA_VERSION, BACKUP_TABLES, validateBackupPayload } from '../backup';

describe('backup export/import round-trip (memory db)', () => {
  const db = getDb();

  it('exports every table and restores an identical state', async () => {
    await db.setOnboarding('hu', 'en');
    // Play-vágás 7. lépés: the cards/card_attempts/user_level writers
    // (ensureCard, updateCard, recordAttempt, updateLevel) are gone, no
    // app-code caller; __setLevelForTest replaces updateLevel for fixtures.
    (db as any).__setLevelForTest('A1');
    await db.setFeedbackBtnSide('left');
    await db.addToSpellingList(5001);
    await db.setGameProgress('grammar', 'ser-estar:done', 'done', { correct: 3, total: 3 });

    const payload = await db.exportAll();
    expect(payload.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    for (const table of BACKUP_TABLES) {
      expect(Array.isArray(payload.tables[table])).toBe(true);
    }
    expect(payload.tables.onboarding[0]).toMatchObject({ source: 'hu', target: 'en' });
    expect(payload.tables.spelling_list).toHaveLength(1);
    expect(payload.tables.game_progress).toHaveLength(1);

    // Wreck the state, then restore from the payload.
    await db.setOnboarding('hu', 'es');

    await db.importAll(payload);
    const roundTrip = await db.exportAll();
    expect(roundTrip.tables).toEqual(payload.tables);

    // And the restored state behaves like the original through the public API.
    expect(await db.getOnboarding()).toEqual({ source: 'hu', target: 'en' });
    expect((await db.getLevel()).level).toBe('A1');
    expect(await db.getFeedbackBtnSide()).toBe('left');
    expect(await db.getSpellingList()).toEqual([{ wordId: 5001, step: 0, due: expect.any(String) }]);
  });

  // Play-vágás 7. lépés: game_scores/game_settings/selected_topic lost their
  // last DB method this step (no app-code caller); an older backup (e.g.
  // 4.0.25) can still carry them, and a restore must accept and skip them.
  it('accepts and restores an older backup that still carries legacy tables', async () => {
    // Own pair, so this test's state can't collide with the one above (the
    // singleton memory db is shared across tests in this file).
    await db.setOnboarding('pt', 'es');
    await db.addToSpellingList(7001);
    const payload = await db.exportAll();
    const legacyPayload = {
      ...payload,
      tables: {
        ...payload.tables,
        game_scores: [{ pair: 'pt-es', game_id: 'word-rain', best_score: 900, best_at: 'x', plays: 3, last_played: 'x' }],
        game_settings: [{ pair: 'pt-es', game_id: 'bubble-pop', settings_json: '{}' }],
        selected_topic: [{ pair: 'pt-es', topic_id: 'to_be' }],
      },
    };

    expect(() => validateBackupPayload(legacyPayload)).not.toThrow();

    await db.importAll(legacyPayload as any);
    expect(await db.getOnboarding()).toEqual({ source: 'pt', target: 'es' });
    expect(await db.getSpellingList()).toEqual([{ wordId: 7001, step: 0, due: expect.any(String) }]);
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

  it('accepts a real exported payload (round-trip with exportAll rows)', async () => {
    const db = getDb();
    await db.setOnboarding('en', 'es');
    const payload = await db.exportAll();
    expect(() => validateBackupPayload(payload)).not.toThrow();
  });

  it('rejects a foreign JSON file (no backup fields at all)', () => {
    expect(() => validateBackupPayload({ hello: 'world' })).toThrow();
  });

  it('rejects an unknown table', () => {
    const tables = emptyTables();
    tables.not_a_real_table = [];
    expect(() =>
      validateBackupPayload({ schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: 'x', appVersion: 'y', tables })
    ).toThrow(/unknown table/);
  });

  it('rejects a wrong-type field (string where a number belongs)', () => {
    const tables = emptyTables();
    tables.cards = [{ id: 1, word_id: 5001, type: 'word', pair: 'en-es', due: 'x', stability: 'not-a-number' }];
    expect(() =>
      validateBackupPayload({ schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: 'x', appVersion: 'y', tables })
    ).toThrow(/wrong-type/);
  });

  it('rejects a wrong-type field (number where a string belongs)', () => {
    const tables = emptyTables();
    tables.onboarding = [{ id: 1, source: 'en', target: 42 }];
    expect(() =>
      validateBackupPayload({ schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: 'x', appVersion: 'y', tables })
    ).toThrow(/wrong-type/);
  });

  it('rejects null in a non-nullable field', () => {
    const tables = emptyTables();
    tables.streak = [{ id: 1, current_count: null, last_date: null, longest_count: 0 }];
    expect(() =>
      validateBackupPayload({ schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: 'x', appVersion: 'y', tables })
    ).toThrow(/wrong-type/);
  });
});
