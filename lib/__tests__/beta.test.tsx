// Beta switches (lib/beta.ts): all off by default, saved in the DB, the hook follows setBeta, and they
// ride along in the backup (an old backup without them loads with every switch off).


import { act, renderHook } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { BETA_DEFAULTS, BETA_FLAGS, __resetBetaForTest, getBeta, loadBeta, setBeta, useBeta } from '../beta';
import { parseBetaFlagMap } from '../betaFlags';
import { validateBackupPayload } from '../backup';

const flush = async () => {
  for (let i = 0; i < 4; i++) await act(async () => { await Promise.resolve(); });
};

beforeEach(async () => {
  __resetBetaForTest();
  for (const f of BETA_FLAGS) await getDb().setBetaFlag(f, false);
});

describe('beta defaults', () => {
  it('has the four flags, every one off', () => {
    expect([...BETA_FLAGS]).toEqual(['practiceTab', 'sentenceTab', 'xpV2', 'levels']);
    for (const f of BETA_FLAGS) {
      expect(BETA_DEFAULTS[f]).toBe(false);
      expect(getBeta(f)).toBe(false);
    }
  });

  it('a db with nothing stored loads as all off', async () => {
    __resetBetaForTest();
    await loadBeta();
    for (const f of BETA_FLAGS) expect(getBeta(f)).toBe(false);
  });
});

describe('setBeta / loadBeta', () => {
  it('saves the flag in the db and keeps the others off', async () => {
    await setBeta('xpV2', true);
    expect(getBeta('xpV2')).toBe(true);
    expect(getBeta('levels')).toBe(false);
    expect(await getDb().getBetaFlags()).toMatchObject({ xpV2: true });
  });

  it('a new app run (cache cleared) reads the saved flags back', async () => {
    await setBeta('practiceTab', true);
    __resetBetaForTest();
    expect(getBeta('practiceTab')).toBe(false);
    await loadBeta();
    expect(getBeta('practiceTab')).toBe(true);
    await setBeta('practiceTab', false);
    __resetBetaForTest();
    await loadBeta();
    expect(getBeta('practiceTab')).toBe(false);
  });
});

describe('useBeta', () => {
  it('starts off, follows setBeta, and goes back off', async () => {
    const { result } = renderHook(() => useBeta('sentenceTab'));
    await flush();
    expect(result.current).toBe(false);
    await act(async () => { await setBeta('sentenceTab', true); });
    expect(result.current).toBe(true);
    await act(async () => { await setBeta('sentenceTab', false); });
    expect(result.current).toBe(false);
  });

  it('shows a flag that was saved before the hook mounted', async () => {
    await getDb().setBetaFlag('levels', true);
    const { result } = renderHook(() => useBeta('levels'));
    await flush();
    expect(result.current).toBe(true);
  });
});

describe('beta flags and practice counters in the backup', () => {
  it('beta flags round-trip through exportAll / importAll', async () => {
    const db = getDb();
    await db.setBetaFlag('xpV2', true);
    const payload = JSON.parse(JSON.stringify(await db.exportAll()));
    expect(() => validateBackupPayload(payload)).not.toThrow();
    expect(JSON.parse(payload.tables.user_meta[0].beta_flags)).toMatchObject({ xpV2: true });
    await db.setBetaFlag('xpV2', false);
    await db.importAll(payload);
    expect(await db.getBetaFlags()).toMatchObject({ xpV2: true });
  });

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

  it('an old backup (no beta_flags, no half_steps / wrong_streak) validates and loads: switches off, counters 0', async () => {
    const db = getDb();
    await db.setBetaFlag('levels', true);
    const payload = JSON.parse(JSON.stringify(await db.exportAll()));
    delete payload.tables.user_meta[0].beta_flags;
    payload.tables.pcic_cards = [
      { item_id: 'old-1', state: 'review', step: 0, ease: 2.5, interval: 3, reps: 1, lapses: 0, due: '2026-10-15', last_review: null, introduced_at: '2026-10-09', known: 0 },
    ];
    expect(() => validateBackupPayload(payload)).not.toThrow();
    await db.importAll(payload);
    expect(await db.getBetaFlags()).toEqual({});
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
