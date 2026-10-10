import { getDb } from '../database.web';
import { sm2NewCard } from '../sm2';
import { BACKUP_SCHEMA_VERSION, BACKUP_TABLES, validateBackupPayload } from '../backup';

describe('backup export/import round-trip (memory db)', () => {
  const db = getDb();

  it('exports every table and restores an identical state', async () => {
    await db.setOnboarding('hu', 'en');
    // Play cut: the cards/card_attempts/user_level writers
    // (ensureCard, updateCard, recordAttempt, updateLevel) are gone, no
    // app-code caller; __setLevelForTest replaces updateLevel for fixtures.
    (db as any).__setLevelForTest('A1');
    await db.setFeedbackBtnSide('left');
    await db.setGrammarPalette('lime');
    await db.setGameProgress('grammar', 'ser-estar:done', 'done', { correct: 3, total: 3 });
    // The main learning progress (schema v2): PCIC cards, the mistake deck, usage minutes.
    const pcic = { ...sm2NewCard('b1-0001'), state: 'review' as const, interval: 4, reps: 2, due: '2026-10-12', lastReview: '2026-10-08', introducedAt: '2026-10-07', known: true };
    await db.upsertPcicCard(pcic);
    await db.upsertPcicCard({ ...sm2NewCard('b1-0002'), state: 'learning' as const, due: '2026-10-08', introducedAt: '2026-10-08' });
    const mistake = { ...sm2NewCard('2026-09-23-claude:w:w1'), state: 'learning' as const, due: '2026-10-08', introducedAt: '2026-10-08' };
    await db.upsertMistakeCard(mistake);
    await db.saveMistakeBatch('2026-09-23-claude', '{"a":1}', '2026-09-23T10:00:00.000Z');
    await db.addUsageMinute();

    const payload = await db.exportAll();
    expect(payload.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    for (const table of BACKUP_TABLES) {
      expect(Array.isArray(payload.tables[table])).toBe(true);
    }
    expect(payload.tables.onboarding[0]).toMatchObject({ source: 'hu', target: 'en' });
    expect(payload.tables.game_progress).toHaveLength(1);
    expect(payload.tables.pcic_cards).toHaveLength(2);
    expect(payload.tables.pcic_cards.find((r: any) => r.item_id === 'b1-0001')).toMatchObject({ state: 'review', interval: 4, known: 1, introduced_at: '2026-10-07' });
    expect(payload.tables.mistake_cards).toHaveLength(1);
    expect(payload.tables.mistake_batches).toEqual([{ batch_id: '2026-09-23-claude', json: '{"a":1}', imported_at: '2026-09-23T10:00:00.000Z' }]);
    expect(payload.tables.usage_minutes).toHaveLength(1);
    // the dead FSRS tables are no longer exported
    expect(payload.tables).not.toHaveProperty('cards');
    expect(payload.tables).not.toHaveProperty('card_attempts');
    expect(() => validateBackupPayload(JSON.parse(JSON.stringify(payload)))).not.toThrow();

    // Wreck the state, then restore from the payload.
    await db.setOnboarding('hu', 'es');
    await db.setGrammarPalette('classic');
    await db.resetPcicCards();
    await db.upsertMistakeCard({ ...mistake, itemId: 'stray' });

    await db.importAll(payload);
    const roundTrip = await db.exportAll();
    // Play cut: restore forces the active pair to the single
    // supported one (en-es), so the onboarding row differs from the backup's
    // own hu-en; every other table round-trips byte for byte.
    expect(roundTrip.tables).toEqual({ ...payload.tables, onboarding: [{ id: 1, source: 'en', target: 'es' }] });
    expect(await db.getOnboarding()).toEqual({ source: 'en', target: 'es' });
    expect(await db.getGrammarPalette()).toBe('lime');
    expect((await db.getPcicCards()).find(c => c.itemId === 'b1-0001')).toEqual(pcic);
    expect((await db.getMistakeCards()).map(c => c.itemId)).toEqual([mistake.itemId]);
    expect((await db.getMistakeBatches()).map(b => b.batchId)).toEqual(['2026-09-23-claude']);
    expect((await db.getDayStats(payload.tables.usage_minutes[0].date)).minutes).toBe(1);

    // The hu-en rows themselves are untouched, just no longer active: switching
    // back to that pair (not a restore, just a normal pair switch) reaches them.
    await db.setOnboarding('hu', 'en');
    expect((await db.getLevel()).level).toBe('A1');
    expect(await db.getFeedbackBtnSide()).toBe('left');
    expect(await db.getGameProgress('grammar')).toEqual([{ itemId: 'ser-estar:done', state: 'done', data: { correct: 3, total: 3 } }]);
  });

  // Play cut: game_scores/game_settings/selected_topic lost their
  // last DB method this step (no app-code caller); an older backup (e.g.
  // 4.0.25) can still carry them, and a restore must accept and skip them.
  // Same for the spelling-practice lists (the feature was removed).
  it('accepts and restores an older backup that still carries legacy tables', async () => {
    // Own pair, so this test's state can't collide with the one above (the
    // singleton memory db is shared across tests in this file).
    await db.setOnboarding('pt', 'es');
    await db.setGameProgress('grammar', 'ser-estar:done', 'done');
    const payload = await db.exportAll();
    const legacyPayload = {
      ...payload,
      tables: {
        ...payload.tables,
        game_scores: [{ pair: 'pt-es', game_id: 'word-rain', best_score: 900, best_at: 'x', plays: 3, last_played: 'x' }],
        game_settings: [{ pair: 'pt-es', game_id: 'bubble-pop', settings_json: '{}' }],
        selected_topic: [{ pair: 'pt-es', topic_id: 'to_be' }],
        spelling_list: [{ pair: 'pt-es', word_id: 7001, step: 0, due: 'x' }],
        pcic_spelling_list: [{ item_id: 'b1-0184', step: 0, due: 'x' }],
      },
    };

    expect(() => validateBackupPayload(legacyPayload)).not.toThrow();

    await db.importAll(legacyPayload as any);
    // Play cut: restore forces the active pair to en-es; the pt-es
    // row is still there and reachable once that pair is active again.
    expect(await db.getOnboarding()).toEqual({ source: 'en', target: 'es' });
    await db.setOnboarding('pt', 'es');
    expect(await db.getGameProgress('grammar')).toEqual([{ itemId: 'ser-estar:done', state: 'done', data: undefined }]);
  });

  // Schema v1 (before pcic_cards / mistake_* / usage_minutes joined the backup)
  // still restores: it carried the since-dropped cards + card_attempts tables, and
  // the progress the file knows nothing about is left as it is on the device.
  it('restores a v1 backup and keeps the local pcic_cards, mistake_* and usage_minutes', async () => {
    await db.setOnboarding('en', 'es');
    await db.upsertPcicCard({ ...sm2NewCard('b1-0100'), state: 'learning' as const, due: '2026-10-08', introducedAt: '2026-10-08' });
    await db.saveMistakeBatch('local-batch', '{}', '2026-10-01T00:00:00.000Z');
    const { pcic_cards, mistake_batches, mistake_cards, usage_minutes, ...v2 } = (await db.exportAll()).tables;
    const v1 = {
      schemaVersion: 1,
      exportedAt: '2026-09-20T10:00:00.000Z',
      appVersion: '4.1.0',
      tables: {
        ...v2,
        cards: [{ id: 1, word_id: 5001, type: 'word', pair: 'en-es', due: '2026-09-21', stability: 1, difficulty: 5, elapsed_days: 0, scheduled_days: 1, learning_steps: 0, reps: 1, lapses: 0, state: 2, last_review: null, buried: 0, learned_at: null, lap: 0, in_hand: 0, started_at: null }],
        card_attempts: [{ id: 1, word_id: 5001, type: 'word', pair: 'en-es', correct: 1, response_time_ms: 900, timestamp: '2026-09-20T09:00:00.000Z' }],
        streak: [{ id: 1, current_count: 9, last_date: '2026-09-20', longest_count: 12 }],
      },
    };
    const payload = validateBackupPayload(v1);
    await db.importAll(payload);
    expect((await db.getStreak()).current_count).toBe(9);
    expect((await db.getPcicCards()).map(c => c.itemId)).toContain('b1-0100');
    expect((await db.getMistakeBatches()).map(b => b.batchId)).toContain('local-batch');
    const after = (await db.exportAll()).tables;
    expect(after).not.toHaveProperty('cards');
    expect(after.pcic_cards.length).toBeGreaterThan(0);
  });

  // Play cut: the exact scenario the step's own
  // acceptance check names, an older-schema backup whose onboarding/active
  // pair is hu-es restores onto en-es, not onto the pair it was saved with.
  it('forces the active pair to en-es when the backup carries an older pair', async () => {
    await db.setOnboarding('hu', 'es');
    const payload = await db.exportAll();
    expect(payload.tables.onboarding[0]).toMatchObject({ source: 'hu', target: 'es' });

    await db.importAll(payload);
    expect(await db.getOnboarding()).toEqual({ source: 'en', target: 'es' });
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
    delete tables.streak;
    expect(() =>
      validateBackupPayload({ schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: 'x', appVersion: 'y', tables })
    ).toThrow(/streak/);
  });

  it('requires the v2 progress tables in a v2 file but not in a v1 file', () => {
    const tables = emptyTables();
    delete tables.pcic_cards;
    expect(() =>
      validateBackupPayload({ schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: 'x', appVersion: 'y', tables })
    ).toThrow(/pcic_cards/);
    expect(() => validateBackupPayload({ schemaVersion: 1, exportedAt: 'x', appVersion: 'y', tables })).not.toThrow();
    delete tables.streak;
    expect(() => validateBackupPayload({ schemaVersion: 1, exportedAt: 'x', appVersion: 'y', tables })).toThrow(/streak/);
  });

  it('still validates the v2 progress tables inside a v1 file when it carries them', () => {
    const tables = emptyTables();
    tables.pcic_cards = [{ item_id: 'b1-0001', ease: 'high' }];
    expect(() => validateBackupPayload({ schemaVersion: 1, exportedAt: 'x', appVersion: 'y', tables })).toThrow(/wrong-type/);
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
    tables.pcic_cards = [{ item_id: 'b1-0001', state: 'new', ease: 'not-a-number' }];
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

  it('rejects a row whose key is not a plain column name (SQL in the INSERT column list)', () => {
    const tables = emptyTables();
    tables.streak = [{ id: 1, current_count: 0, longest_count: 0, 'last_date) VALUES (1); DROP TABLE cards; --': 'x' }];
    expect(() =>
      validateBackupPayload({ schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: 'x', appVersion: 'y', tables })
    ).toThrow(/invalid column name/);
    tables.streak = [];
    tables.pcic_cards = [{ item_id: 'b1-0001', 'known) VALUES (1); DROP TABLE pcic_cards; --': 1 }];
    expect(() =>
      validateBackupPayload({ schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: 'x', appVersion: 'y', tables })
    ).toThrow(/invalid column name/);
  });

  it('rejects null in a non-nullable mistake_cards column', () => {
    const tables = emptyTables();
    tables.mistake_cards = [{ item_id: 'x', due: null }];
    expect(() =>
      validateBackupPayload({ schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: 'x', appVersion: 'y', tables })
    ).toThrow(/wrong-type/);
  });

  it('keeps columns that are missing from the type table (again_delay_sec, pcic_level)', () => {
    const tables = emptyTables();
    tables.learn_settings = [{ pair: 'en-es', again_delay_sec: 30, pcic_level: 'a2' }];
    tables.user_meta = [{ id: 1, user_id: '', first_use_date: '2026-10-08', pcic_level: 'a2' }];
    const payload = validateBackupPayload({ schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: 'x', appVersion: 'y', tables });
    expect(payload.tables.learn_settings[0]).toMatchObject({ again_delay_sec: 30, pcic_level: 'a2' });
    expect(payload.tables.user_meta[0]).toMatchObject({ pcic_level: 'a2' });
  });
});
