// The A1 state set by the __DEV__-only control
// opens the exam (at least 80% of the level's cards are graduated + one A1 lesson is done).

import { pcicItemsForLevel, setPcicTarget } from '@/data/pcic';
import { GRAMMAR_PROGRESS_KEY } from '@/lib/grammar/syllabus';
import { getDb } from '../../database.web';
import { a1SeedCards, a1SeedLesson, DEV_SEED_PERCENT, seedA1ExamState, seedExamState } from '../devSeed';
import { EXAM_LEVELS } from '../types';
import { EXAM_UNLOCK_PCT, examStatusFor } from '../unlock';

describe('a1SeedCards', () => {
  const ids = pcicItemsForLevel('A1').map((i) => i.id);

  it('at least the unlock threshold share of the level cards is graduated, with a future due date', () => {
    expect(DEV_SEED_PERCENT).toBeGreaterThanOrEqual(EXAM_UNLOCK_PCT);
    const cards = a1SeedCards(ids, '2026-10-01');
    expect(cards.length).toBeGreaterThanOrEqual(Math.ceil((ids.length * EXAM_UNLOCK_PCT) / 100));
    expect(cards.length).toBeLessThan(ids.length);
    for (const c of cards) {
      expect(c.state).toBe('review');
      expect(c.due > '2026-10-01').toBe(true);
    }
  });
});

describe('seedA1ExamState (memory db)', () => {
  const db = getDb();

  it('after setup the A1 exam is open, and the same when run twice', async () => {
    setPcicTarget('es');
    const before = examStatusFor('A1', 'es', await db.getPcicCards(), await db.getGameProgress(GRAMMAR_PROGRESS_KEY));
    expect(before.unlocked).toBe(false);

    await seedA1ExamState(db, 'es', '2026-10-01');
    await seedA1ExamState(db, 'es', '2026-10-01');
    const after = examStatusFor('A1', 'es', await db.getPcicCards(), await db.getGameProgress(GRAMMAR_PROGRESS_KEY));
    expect(after).toMatchObject({ unlocked: true, lessonDone: true, missing: 0 });
    expect(after.learned).toBeGreaterThanOrEqual(after.needed);
  });

  it('the lesson it marks done is A1 and, in Spanish, the present tense', () => {
    expect(a1SeedLesson('es')).toBe('presente-regular');
  });
});

describe('seedExamState (step 4: all four levels)', () => {
  it('after setup the A1, A2, B1 and B2 exams are open, and the same when run twice', async () => {
    const db = getDb();
    setPcicTarget('es');
    await db.resetPcicCards();
    await db.resetGameProgress(GRAMMAR_PROGRESS_KEY);
    await seedExamState(db, 'es', '2026-10-01');
    await seedExamState(db, 'es', '2026-10-01');
    const cards = await db.getPcicCards();
    const rows = await db.getGameProgress(GRAMMAR_PROGRESS_KEY);
    for (const level of EXAM_LEVELS) {
      const status = examStatusFor(level, 'es', cards, rows);
      expect(status).toMatchObject({ level, unlocked: true, lessonDone: true, missing: 0 });
      expect(status.learned).toBeGreaterThanOrEqual(status.needed);
    }
  });
});
