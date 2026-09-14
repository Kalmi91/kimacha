import { getDb } from '../database.web';
import { buildQueue, applyCadence } from '../sessionQueue';
import { getWordsForLevel } from '@/data/words';
import type { Level } from '@/data/words';

// A session smoke test for every course: it runs the real pipeline a learner
// hits on the Learn tab (ensure cards → due rows → buildQueue → cadence)
// against the in-memory database, and asserts the learner actually gets cards.
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
    await db.ensureCard(w.id, 'sentence');
    // UTEMEZO 11. szakasz: getDueCardsForWordIds mostantól csak MEGTANULT szót
    // ad vissza (lap >= 3, in_hand = 0); az érintetlen szavak az ütemező
    // `fresh` listáján jönnek, nem ezen a lekérdezésen (lásd loadCards). A
    // pipeline-teszt ezért előbb végigviszi a szavakat a létrán.
    await db.startWord(w.id);
    await db.passLap(w.id);
    await db.passLap(w.id);
    await db.passLap(w.id);
  }

  const rows = await db.getDueCardsForWordIds(levelWords.map((w) => w.id), QUEUE_POOL);
  return applyCadence(buildQueue(rows, target), false, target);
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
