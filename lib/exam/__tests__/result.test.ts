// PLAN-vizsga A. szakasz 2. lépés (A6 a): a szintvizsga eredménye (átment-e, legjobb
// pontszám, szintenként) a memory DB-n; a natív lib/database.ts ugyanezt a két segédet
// (lib/exam/result.ts) hívja, ezért ez a teszt a közös viselkedést fedi.

import { getDb } from '../../database.web';
import { EXAM_PROGRESS_KEY, mergeExamResult } from '../result';

describe('mergeExamResult', () => {
  it('az első próba önmaga az eredmény', () => {
    expect(mergeExamResult(undefined, 60, false, '2026-10-01')).toEqual({
      passed: false,
      best: 60,
      bestAt: '2026-10-01',
      last: 60,
      lastAt: '2026-10-01',
    });
  });

  it('az átmenés és a legjobb pontszám nem vész el egy gyengébb újrapróbán', () => {
    const first = mergeExamResult(undefined, 90, true, '2026-10-01');
    const second = mergeExamResult(first, 70, false, '2026-10-02');
    expect(second).toEqual({ passed: true, best: 90, bestAt: '2026-10-01', last: 70, lastAt: '2026-10-02' });
  });

  it('a jobb pontszám felülírja a legjobbat és a napját', () => {
    const first = mergeExamResult(undefined, 60, false, '2026-10-01');
    const second = mergeExamResult(first, 85, true, '2026-10-03');
    expect(second).toEqual({ passed: true, best: 85, bestAt: '2026-10-03', last: 85, lastAt: '2026-10-03' });
  });
});

describe('getExamResults / saveExamResult (memory db)', () => {
  const db = getDb();

  it('mentés előtt nincs eredmény', async () => {
    expect(await db.getExamResults()).toEqual({});
  });

  it('a mentett eredmény visszaolvasható, szintenként külön', async () => {
    await db.saveExamResult('A1', 60, false, '2026-10-01');
    await db.saveExamResult('A2', 95, true, '2026-10-02');
    expect(await db.getExamResults()).toEqual({
      A1: { passed: false, best: 60, bestAt: '2026-10-01', last: 60, lastAt: '2026-10-01' },
      A2: { passed: true, best: 95, bestAt: '2026-10-02', last: 95, lastAt: '2026-10-02' },
    });
  });

  it('az újrapróba összevonva ment: átmenés + legjobb megmarad', async () => {
    await db.saveExamResult('A1', 88, true, '2026-10-03');
    const saved = await db.saveExamResult('A1', 50, false, '2026-10-04');
    expect(saved).toEqual({ passed: true, best: 88, bestAt: '2026-10-03', last: 50, lastAt: '2026-10-04' });
    expect((await db.getExamResults()).A1).toEqual(saved);
  });

  it('a `level-exam` game_progress sorokban él, és a backup export/import hozza vissza', async () => {
    const rows = await db.getGameProgress(EXAM_PROGRESS_KEY);
    expect(rows.map((r) => r.itemId).sort()).toEqual(['A1', 'A2']);
    expect(rows.find((r) => r.itemId === 'A1')?.state).toBe('passed');

    const payload = await db.exportAll();
    await db.resetGameProgress(EXAM_PROGRESS_KEY);
    expect(await db.getExamResults()).toEqual({});
    await db.importAll(payload);
    expect((await db.getExamResults()).A1?.best).toBe(88);
  });
});
