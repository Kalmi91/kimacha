import { getDb } from '../database.web';
import { buildQueue, applyCadence } from '../sessionQueue';
import { capNewWords, newWordIntake } from '../newWordBudget';
import { getWordsForLevel } from '@/data/words';
import type { Level } from '@/data/words';

// A session smoke test for every course: it runs the real pipeline a learner
// hits on the Learn tab (ensure cards → due rows → buildQueue → daily budget →
// cadence) against the in-memory database, and asserts the learner actually
// gets cards.
//
// Both halves of FB129 (the daily new-word budget counted across language
// pairs, and card ids were resolved only in the shared Spanish set) produced
// exactly one symptom: an empty queue and "done for today" before a single word
// was studied. Unit tests passed through all of it, so this drives the whole
// chain instead.
const QUEUE_POOL = 40;

async function buildSession(source: string, target: string, level: Level) {
  const db = getDb();
  await db.setOnboarding(source, target);

  const levelWords = getWordsForLevel(level, target).slice(0, 20);
  for (const w of levelWords) {
    await db.ensureCard(w.id, 'word');
    await db.ensureCard(w.id, 'sentence');
  }

  const rows = await db.getDueCardsForWordIds(levelWords.map((w) => w.id), QUEUE_POOL);
  const intake = newWordIntake({
    limit: await db.getDailyNewLimit(),
    bonus: await db.getNewLimitBonus(),
    startedToday: await db.getNewWordsToday(),
    unlearned: await db.getUnlearnedWordCount(),
  });
  return applyCadence(capNewWords(buildQueue(rows, target), intake), false, target);
}

const COURSES: [string, string, Level][] = [
  ['es', 'hu', 'A0'],
  ['es', 'hu', 'A1'],
  ['en', 'hu', 'A0'],
  ['hu', 'en', 'A0'],
  ['hu', 'en', 'A1'],
  ['hu', 'es', 'A1'],
  ['en', 'es', 'A1'],
  ['de', 'es', 'A1'],
  // A level with no branch content falls back to the shared Spanish set.
  ['es', 'hu', 'B1'],
];

describe('a fresh session hands out cards in every course', () => {
  it.each(COURSES)('%s→%s %s', async (source, target, level) => {
    const queue = await buildSession(source, target, level);
    expect(queue.length).toBeGreaterThan(0);
    // Every card must carry its word: an unresolved id is dropped silently by
    // buildQueue, which is how the Hungarian course lost its whole session.
    for (const item of queue) {
      expect(item.word).toBeDefined();
      expect(item.word.id).toBe(item.wordId);
    }
    // The learner starts on a word, not on a sentence build (FB24).
    expect(queue[0].type).toBe('word');
  });
});

// FB140/FB141/FB142: the half-learned pile parks the intake, and until now the
// "+N új szó" tap raised the ceiling along with the budget, so the button could
// leave the queue exactly as it was ("nem dobott fel többet hanem újra
// feldobta"). Driven through the real pipeline, because the pause is invisible
// to any single unit.
describe('a congested course still answers the "+N new words" tap', () => {
  const CONGESTED = 40; // way past the ceiling of a default 5-word limit

  async function congestedIntake(bonus: number) {
    const db = getDb();
    await db.setOnboarding('hu', 'en');
    const words = getWordsForLevel('A1', 'en');
    // Half-learn a pile: reps > 0 and FSRS state Learning (1).
    for (const w of words.slice(0, CONGESTED)) {
      await db.ensureCard(w.id, 'word');
      await db.updateCard(w.id, 'word', {
        due: new Date(Date.now() + 86400000),
        stability: 1, difficulty: 5, elapsed_days: 0, scheduled_days: 1,
        learning_steps: 1, reps: 2, lapses: 0, state: 1, last_review: new Date(),
      } as any);
    }
    return newWordIntake({
      limit: await db.getDailyNewLimit(),
      bonus,
      startedToday: 0,
      unlearned: await db.getUnlearnedWordCount(),
    });
  }

  it('pauses on its own', async () => {
    expect(await congestedIntake(0)).toBe(0);
  });

  it('hands out exactly the requested bonus once the learner asks', async () => {
    expect(await congestedIntake(5)).toBe(5);
  });
});
