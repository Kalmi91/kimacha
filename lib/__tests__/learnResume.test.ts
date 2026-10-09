// Card-level resume: a snapshot of the Learn round: save, read back, apply onto the rebuilt queue.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import { getDb } from '@/lib/database';
import { RESUME_GAME_ID } from '../resumeRoute';
import { applyLearnResume, buildLearnResume, clearLearnResume, isLearnResumeFor, loadLearnResume, saveLearnResume } from '../learnResume';
import { clearDrillResume, drillToResume, loadDrillResume, saveDrillResume } from '../drillResume';
import { sm2NewCard, type Sm2Card } from '../sm2';
import type { QueuedSm2Card } from '../pcicSession';

const DAY = '2026-10-05';
const q = (ids: string[], returns: Record<string, number> = {}): QueuedSm2Card[] =>
  ids.map((id) => ({ ...(sm2NewCard(id) as Sm2Card), ...(returns[id] !== undefined ? { returnAt: returns[id] } : {}) }));
const ids = (queue: QueuedSm2Card[]) => queue.map((c) => c.itemId);

describe('buildLearnResume / applyLearnResume', () => {
  it('the saved order and the "again" timer return to the rebuilt queue', () => {
    const saved = buildLearnResume(q(['d', 'e', 'a'], { a: 1234 }), DAY, 'A1', 3);
    expect(saved).toEqual({ day: DAY, level: 'A1', order: ['d', 'e', 'a'], returns: { a: 1234 }, base: 3 });
    // in the rebuilt (normal) queue "a" (failed, learning) is at the front, with "d" and "e" behind it
    const rebuilt = q(['a', 'd', 'e', 'f']);
    const applied = applyLearnResume(rebuilt, saved, DAY, 'A1');
    expect(ids(applied)).toEqual(['d', 'e', 'a', 'f']);
    expect(applied.find((c) => c.itemId === 'a')?.returnAt).toBe(1234);
    expect(applied.find((c) => c.itemId === 'd')?.returnAt).toBeUndefined();
  });

  it('invalid for another day / another level: the queue is unchanged', () => {
    const saved = buildLearnResume(q(['d', 'e']), DAY, 'A1', null);
    const rebuilt = q(['e', 'd']);
    expect(applyLearnResume(rebuilt, saved, '2026-10-06', 'A1')).toBe(rebuilt);
    expect(applyLearnResume(rebuilt, saved, DAY, 'A2')).toBe(rebuilt);
    expect(applyLearnResume(rebuilt, null, DAY, 'A1')).toBe(rebuilt);
    expect(isLearnResumeFor(saved, '2026-10-06', 'A1')).toBe(false);
    expect(isLearnResumeFor(saved, DAY, 'A1')).toBe(true);
  });

  it('what is no longer due / no longer exists in the saved queue drops out; a new item follows in the normal order', () => {
    const saved = buildLearnResume(q(['x', 'd', 'nincs-ilyen', 'e']), DAY, 'A1', null);
    const rebuilt = q(['e', 'd', 'f', 'g']); // x is no longer in the queue (graded)
    expect(ids(applyLearnResume(rebuilt, saved, DAY, 'A1'))).toEqual(['d', 'e', 'f', 'g']);
  });

  it('a duplicate item in the save does not duplicate the card', () => {
    const saved = { day: DAY, level: 'A1', order: ['d', 'd', 'e'], returns: {}, base: null };
    expect(ids(applyLearnResume(q(['e', 'd']), saved, DAY, 'A1'))).toEqual(['d', 'e']);
  });
});

describe('save and read back', () => {
  beforeEach(async () => {
    await getDb().resetGameProgress(RESUME_GAME_ID);
  });

  it('null without a save, readable back after saving', async () => {
    expect(await loadLearnResume(getDb())).toBeNull();
    const saved = buildLearnResume(q(['d', 'a'], { a: 99 }), DAY, 'B1', 7);
    await saveLearnResume(getDb(), saved);
    expect(await loadLearnResume(getDb())).toEqual(saved);
  });

  it('a corrupt save (wrong shape) is null', async () => {
    await getDb().setGameProgress(RESUME_GAME_ID, 'learn', 'saved', { day: 5, order: 'x' });
    expect(await loadLearnResume(getDb())).toBeNull();
  });
});

describe('drillResume', () => {
  beforeEach(async () => {
    await getDb().resetGameProgress(RESUME_GAME_ID);
  });

  it('save, read back, delete', async () => {
    expect(await loadDrillResume(getDb())).toBeNull();
    await saveDrillResume(getDb(), { topicId: 'ser-estar', kind: 'form', day: DAY });
    expect(await loadDrillResume(getDb())).toEqual({ topicId: 'ser-estar', kind: 'form', day: DAY });
    await clearDrillResume(getDb());
    expect(await loadDrillResume(getDb())).toBeNull();
  });

  it('valid only for the given lesson, today, and a kind offered by the lesson', () => {
    const saved = { topicId: 'ser-estar', kind: 'form', day: DAY };
    const kinds = ['choice', 'form'] as const;
    expect(drillToResume(saved, 'ser-estar', DAY, kinds)).toBe('form');
    expect(drillToResume(saved, 'imperfecto', DAY, kinds)).toBeNull();
    expect(drillToResume(saved, 'ser-estar', '2026-10-06', kinds)).toBeNull();
    expect(drillToResume(saved, 'ser-estar', DAY, ['choice'] as const)).toBeNull();
    expect(drillToResume(null, 'ser-estar', DAY, kinds)).toBeNull();
  });
});

describe('clearLearnResume', () => {
  it('after resetting progress the snapshot is gone', async () => {
    await saveLearnResume(getDb(), buildLearnResume(q(['d']), DAY, 'A1', null));
    expect(await loadLearnResume(getDb())).not.toBeNull();
    await clearLearnResume(getDb());
    expect(await loadLearnResume(getDb())).toBeNull();
  });
});
