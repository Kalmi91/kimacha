// GAMES.md 3.1 (F0): "Ez a függvény a rendszer szíve. Egyetlen jest-teszt
// garantálja a user kritériumát: minden visszaadott entry vagy isNew ===
// false, vagy van hozzá feloldható gloss. Ha ez a teszt piros, a Game fül nem
// szállítható."
//
// getLearnedPool (production code) imports the platform-resolving
// '@/lib/database' (Metro picks database.web.ts on web, database.ts natively).
// Jest has no Metro platform resolution and would otherwise load the native
// expo-sqlite implementation, which throws outside a real app, so '../database'
// is redirected to the memory implementation for this test file only, the
// same effect Metro's web build gets for free (lib/__tests__/usageTimer.test.ts
// established the jest.mock('../database', ...) pattern this follows).

import { getWordsForLevel } from '@/data/words';

jest.mock('../database', () => jest.requireActual('../database.web'));

import { getDb } from '../database';
import { getLearnedPool } from '../games/vocabPool';

describe('getLearnedPool (GAMES.md 3.1, the core guarantee)', () => {
  const db = getDb();
  const PAIR = 'hu-es';
  const LEARNED = 'es';
  const LEVEL = 'A1' as const;

  beforeAll(async () => {
    await db.setOnboarding('hu', 'es');
  });

  it('never returns a blank gloss: isNew===false or a resolvable learned+native pair', async () => {
    // A mix of practiced (phase>=1) and untouched words, so the pool has to
    // both read real cards AND top up from the level's unseen vocabulary.
    const levelWords = getWordsForLevel(LEVEL, LEARNED).slice(0, 10);
    for (const w of levelWords) {
      await db.ensureCard(w.id, 'word');
    }
    // Give the first 5 at least one successful review (phase >= 1).
    for (const w of levelWords.slice(0, 5)) {
      await db.recordAttempt(w.id, 'word', true, 1000);
    }
    const cards = await db.getAllWordCards(PAIR);
    // Bump reps directly via updateCard isn't exposed generically here, so
    // fake the phase by re-reading through ensureCard's default (reps=0) and
    // relying on the top-up path for phase coverage, the pool has to hold
    // for BOTH sources (existing cards AND top-up), see below.
    expect(cards.length).toBeGreaterThan(0);

    const pool = await getLearnedPool({ pair: PAIR, learnedLang: LEARNED, level: LEVEL, minSize: 30 });

    expect(pool.length).toBeGreaterThan(0);
    for (const entry of pool) {
      const ok = entry.isNew === false || (entry.learned.length > 0 && entry.native.length > 0);
      expect(ok).toBe(true);
    }
  });

  it('tops up from the level vocabulary when the practiced pool is smaller than minSize, marking those entries isNew', async () => {
    await db.setOnboarding('en', 'es');
    // Fresh pair, nothing practiced yet: every returned entry must be a
    // top-up, and every one of them must be glossable.
    const pool = await getLearnedPool({ pair: 'en-es', learnedLang: 'es', level: 'A0', minSize: 15 });
    expect(pool.length).toBe(15);
    expect(pool.every((e) => e.isNew)).toBe(true);
    expect(pool.every((e) => e.learned && e.native)).toBe(true);
  });

  it('respects strictness: "practiced" excludes brand-new (phase 0, reps=0) cards from the existing-cards half', async () => {
    await db.setOnboarding('hu', 'es');
    const levelWords = getWordsForLevel('A0', 'es');
    const w = levelWords[0];
    await db.ensureCard(w.id, 'word'); // phase 0, never reviewed
    const pool = await getLearnedPool({ pair: 'hu-es', learnedLang: 'es', level: 'A0', strictness: 'practiced' });
    // phase-0 card must not surface as an "existing" (isNew:false) entry.
    const existingEntry = pool.find((e) => e.wordId === w.id && !e.isNew);
    expect(existingEntry).toBeUndefined();
  });

  it('scopes to a topic when topicId is given', async () => {
    await db.setOnboarding('hu', 'es');
    const topicId = getWordsForLevel('A1', 'es').find((w) => typeof w.topic === 'string')?.topic as string | undefined;
    if (!topicId) return; // defensive: skip if the fixture corpus has no topic field
    const pool = await getLearnedPool({ pair: 'hu-es', learnedLang: 'es', level: 'A1', minSize: 5, topicId });
    expect(pool.every((e) => e.topicId === topicId)).toBe(true);
  });
});
