// The level exam result (passed or not, best score, per level) on the memory DB; the native
// lib/database.ts calls the same two helpers (lib/exam/result.ts), so this test covers the shared behaviour.

import { getDb } from '../../database.web';
import { EXAM_PROGRESS_KEY, mergeExamResult } from '../result';

describe('mergeExamResult', () => {
  it('the first attempt is itself the result', () => {
    expect(mergeExamResult(undefined, 60, false, '2026-10-01')).toEqual({
      passed: false,
      best: 60,
      bestAt: '2026-10-01',
      last: 60,
      lastAt: '2026-10-01',
    });
  });

  it('the pass and the best score are not lost on a weaker retry', () => {
    const first = mergeExamResult(undefined, 90, true, '2026-10-01');
    const second = mergeExamResult(first, 70, false, '2026-10-02');
    expect(second).toEqual({ passed: true, best: 90, bestAt: '2026-10-01', last: 70, lastAt: '2026-10-02' });
  });

  it('a better score overwrites the best and its day', () => {
    const first = mergeExamResult(undefined, 60, false, '2026-10-01');
    const second = mergeExamResult(first, 85, true, '2026-10-03');
    expect(second).toEqual({ passed: true, best: 85, bestAt: '2026-10-03', last: 85, lastAt: '2026-10-03' });
  });
});

describe('getExamResults / saveExamResult (memory db)', () => {
  const db = getDb();

  it('no result before saving', async () => {
    expect(await db.getExamResults()).toEqual({});
  });

  it('the saved result can be read back, separately per level', async () => {
    await db.saveExamResult('A1', 60, false, '2026-10-01');
    await db.saveExamResult('A2', 95, true, '2026-10-02');
    expect(await db.getExamResults()).toEqual({
      A1: { passed: false, best: 60, bestAt: '2026-10-01', last: 60, lastAt: '2026-10-01' },
      A2: { passed: true, best: 95, bestAt: '2026-10-02', last: 95, lastAt: '2026-10-02' },
    });
  });

  it('a retry saves merged: the pass + best stay', async () => {
    await db.saveExamResult('A1', 88, true, '2026-10-03');
    const saved = await db.saveExamResult('A1', 50, false, '2026-10-04');
    expect(saved).toEqual({ passed: true, best: 88, bestAt: '2026-10-03', last: 50, lastAt: '2026-10-04' });
    expect((await db.getExamResults()).A1).toEqual(saved);
  });

  it('it lives in `level-exam` game_progress rows, and backup export/import brings it back', async () => {
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
