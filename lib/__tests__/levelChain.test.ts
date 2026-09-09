import { createEmptyCard } from 'ts-fsrs';

import { getDb } from '../database.web';
import { getWordsForLevel, getWordsUpToLevel, LEVELS } from '@/data/words';

// FB207 / FB206, Kálmán 2026-09-09: „most hogy van nekem még A1 es szavakból is új,
// ez legyen egy ilyen folyamatos lánc a szavakkal, mondog keljen ismételni a régebbi
// szavakat is", és „a másik régi szint A1 es szavakat felhozza? A2 ben?".
//
// Eddig nem: a sor a MOSTANI szint szavaira épült, tehát az A2-re lépéssel az A1
// ismétlései eltűntek. A szint innentől csak azt szabja meg, hol jönnek az ÚJ
// szavak; az ismétlés a kumulált készletet nézi.

const QUEUE_POOL = 40;

/** Egy megkezdett, esedékes szókártya: reps > 0 és a due a múltban. */
async function makeDueReview(db: ReturnType<typeof getDb>, wordId: number) {
  await db.ensureCard(wordId, 'word');
  const card = createEmptyCard();
  card.reps = 3;
  card.due = new Date(Date.now() - 24 * 60 * 60 * 1000);
  card.last_review = new Date(Date.now() - 48 * 60 * 60 * 1000);
  await db.updateCard(wordId, 'word', card);
}

describe('getWordsUpToLevel', () => {
  it('gathers every level up to and including the current one', () => {
    const upto = getWordsUpToLevel('A2');
    const levels = new Set(upto.map(w => w.level));
    expect(levels).toEqual(new Set(['A0', 'A1', 'A2']));
  });

  it('leaves the levels above out', () => {
    const upto = getWordsUpToLevel('A1');
    expect(upto.some(w => w.level === 'A2')).toBe(false);
  });

  it('is the level itself at the very bottom', () => {
    expect(getWordsUpToLevel('A0')).toEqual(getWordsForLevel('A0'));
  });

  it('grows with every level', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(getWordsUpToLevel(LEVELS[i]).length).toBeGreaterThan(
        getWordsUpToLevel(LEVELS[i - 1]).length
      );
    }
  });
});

describe('an A2 session keeps reviewing the A1 words', () => {
  it('brings a started A1 word back while the learner is on A2', async () => {
    const db = getDb();
    await db.setOnboarding('hu', 'es');

    const a1 = getWordsForLevel('A1', 'es')[0];
    await makeDueReview(db, a1.id);

    const rows = await db.getDueCardsForLevel('A2', QUEUE_POOL);
    expect(rows.map((r: any) => r.word_id)).toContain(a1.id);
  });

  it('still takes its new words from the current level only', async () => {
    const db = getDb();
    await db.setOnboarding('hu', 'es');

    // Egy érintetlen A1 szó: esedékes, de reps = 0, tehát ÚJ.
    const freshA1 = getWordsForLevel('A1', 'es')[1];
    await db.ensureCard(freshA1.id, 'word');

    const rows = await db.getDueCardsForLevel('A2', QUEUE_POOL);
    expect(rows.map((r: any) => r.word_id)).not.toContain(freshA1.id);
  });

  it('counts the older level in the due pile the header shows', async () => {
    const db = getDb();
    await db.setOnboarding('hu', 'es');

    const a1 = getWordsForLevel('A1', 'es')[2];
    await makeDueReview(db, a1.id);

    expect(await db.countDueReviewWordsForLevel('A2')).toBeGreaterThan(0);
  });

  it('leaves a level-scoped call alone when no wider review scope is given', async () => {
    const db = getDb();
    await db.setOnboarding('hu', 'es');

    const a1 = getWordsForLevel('A1', 'es')[3];
    await makeDueReview(db, a1.id);

    const a2Ids = getWordsForLevel('A2', 'es').map(w => w.id);
    const rows = await db.getDueCardsForWordIds(a2Ids, QUEUE_POOL);
    expect(rows.map((r: any) => r.word_id)).not.toContain(a1.id);
  });
});
