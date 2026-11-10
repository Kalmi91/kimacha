// Legacy backup compatibility and practice counters.

import { getDb } from '@/lib/database';
import { parseBetaFlagMap } from '../betaFlags';
import { validateBackupPayload } from '../backup';

describe('practice counters in the backup', () => {

  it('the unfinished practice round round-trips through exportAll / importAll; an old backup (no practice_round) loads as no round', async () => {
    const db = getDb();
    await db.setPracticeRound('{"v":1,"date":"2026-10-12"}');
    const payload = JSON.parse(JSON.stringify(await db.exportAll()));
    expect(() => validateBackupPayload(payload)).not.toThrow();
    expect(payload.tables.user_meta[0].practice_round).toBe('{"v":1,"date":"2026-10-12"}');
    await db.setPracticeRound(null);
    await db.importAll(payload);
    expect(await db.getPracticeRound()).toBe('{"v":1,"date":"2026-10-12"}');
    delete payload.tables.user_meta[0].practice_round;
    expect(() => validateBackupPayload(payload)).not.toThrow();
    await db.importAll(payload);
    expect(await db.getPracticeRound()).toBeNull();
  });

  it('the leaderboard identity is { token, name }; the backup never carries it and a restore keeps the own one', async () => {
    const db = getDb();
    expect(await db.getBoardIdentity()).toBeNull();
    await db.setBoardIdentity({ token: 'dev-tok', name: 'Kálmán' });
    expect(await db.getBoardIdentity()).toEqual({ token: 'dev-tok', name: 'Kálmán' });
    const payload = JSON.parse(JSON.stringify(await db.exportAll()));
    expect(() => validateBackupPayload(payload)).not.toThrow();
    expect(payload.tables.user_meta[0].board_identity).toBeNull();
    expect(JSON.stringify(payload)).not.toContain('dev-tok');

    // restoring (also a file from another device, or an old one without the column) leaves this device's identity alone
    await db.importAll(payload);
    expect(await db.getBoardIdentity()).toEqual({ token: 'dev-tok', name: 'Kálmán' });
    payload.tables.user_meta[0].board_identity = '{"token":"other","name":"Other"}';
    await db.importAll(payload);
    expect(await db.getBoardIdentity()).toEqual({ token: 'dev-tok', name: 'Kálmán' });
    delete payload.tables.user_meta[0].board_identity;
    expect(() => validateBackupPayload(payload)).not.toThrow();
    await db.importAll(payload);
    expect(await db.getBoardIdentity()).toEqual({ token: 'dev-tok', name: 'Kálmán' });
    await db.setBoardIdentity(null);
    await db.importAll(payload);
    expect(await db.getBoardIdentity()).toBeNull();
  });

  it('an old backup (no beta_flags, no half_steps / wrong_streak) validates and loads: counters 0', async () => {
    const db = getDb();
    const payload = JSON.parse(JSON.stringify(await db.exportAll()));
    delete payload.tables.user_meta[0].beta_flags;
    payload.tables.pcic_cards = [
      { item_id: 'old-1', state: 'review', step: 0, ease: 2.5, interval: 3, reps: 1, lapses: 0, due: '2026-10-15', last_review: null, introduced_at: '2026-10-09', known: 0 },
    ];
    expect(() => validateBackupPayload(payload)).not.toThrow();
    await db.importAll(payload);
    expect(await db.getPcicCard('old-1')).toMatchObject({ halfSteps: 0, wrongStreak: 0, interval: 3 });
  });

  it('the counters survive an export / import', async () => {
    const db = getDb();
    await db.resetPcicCards();
    await db.upsertPcicCard({
      itemId: 'c-1', state: 'review', step: 0, ease: 2.5, interval: 3, reps: 1, lapses: 0, due: '2026-10-15',
      lastReview: null, introducedAt: '2026-10-09', halfSteps: 1, wrongStreak: 1,
    });
    const payload = JSON.parse(JSON.stringify(await db.exportAll()));
    expect(payload.tables.pcic_cards[0]).toMatchObject({ half_steps: 1, wrong_streak: 1 });
    await db.resetPcicCards();
    await db.importAll(payload);
    expect(await db.getPcicCard('c-1')).toMatchObject({ halfSteps: 1, wrongStreak: 1 });
  });
});

describe('parseBetaFlagMap', () => {
  it('keeps only boolean entries of a JSON object and survives garbage', () => {
    expect(parseBetaFlagMap('{"xpV2":true,"levels":false,"x":1,"y":"yes"}')).toEqual({ xpV2: true, levels: false });
    for (const bad of [null, undefined, '', 'nope', '[1]', '7', '"s"', 5]) expect(parseBetaFlagMap(bad)).toEqual({});
  });
});
