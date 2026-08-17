import { getDb } from '../database.web';
import { buildQueue, applyCadence } from '../sessionQueue';
import { capNewWords } from '../newWordBudget';
import { borrowNewWords } from '../topicRotation';
import { getWordsForTopic, type Level } from '@/data/words';
import { getTopicsForLevel } from '@/data/topics';

// FB139 end to end on the real A1 corpus: the unit tests cover the picking rule
// on made-up topics, this one drives the wiring the Learn tab uses (active topic
// dry → borrow → ensureCard → due rows → buildQueue → daily budget → cadence),
// so a borrowed word that does not exist, or one labelled with a topic it does
// not belong to, fails here rather than on the phone.
const LEVEL: Level = 'A1';
const TARGET = 'es';
const QUEUE_POOL = 40;

describe('borrowed new words reach the queue (FB139)', () => {
  const topics = getTopicsForLevel(LEVEL, TARGET);
  const active = topics[0];
  // Everything in the active topic is already started, so it has no new word to
  // give: exactly the state that used to hand out fewer cards than asked for.
  const startedReps = new Map(
    getWordsForTopic(LEVEL, active.id, TARGET).map(w => [w.id, 3] as [number, number]),
  );
  const intake = 15;

  const picked = borrowNewWords(
    topics
      .filter(t => t.id !== active.id)
      .map(t => ({
        id: t.id,
        order: t.order,
        newWordIds: getWordsForTopic(LEVEL, t.id, TARGET)
          .filter(w => (startedReps.get(w.id) ?? 0) === 0)
          .map(w => w.id),
      })),
    active.order,
    intake,
  );

  it('fills the whole raised budget', () => {
    expect(picked).toHaveLength(intake);
  });

  it('labels every word with a topic that really holds it', () => {
    for (const p of picked) {
      expect(getWordsForTopic(LEVEL, p.topicId, TARGET).some(w => w.id === p.wordId)).toBe(true);
    }
  });

  it('never borrows from the active topic', () => {
    expect(picked.some(p => p.topicId === active.id)).toBe(false);
  });

  it('hands the borrowed words to the learner as cards', async () => {
    const db = getDb();
    await db.setOnboarding('en', TARGET);
    const ids = picked.map(p => p.wordId);
    for (const id of ids) {
      await db.ensureCard(id, 'word');
      await db.ensureCard(id, 'sentence');
    }
    const rows = await db.getDueCardsForWordIds(ids, QUEUE_POOL);
    const queue = applyCadence(capNewWords(buildQueue(rows, TARGET), intake), false, TARGET);
    expect(queue.length).toBeGreaterThan(0);
    const borrowed = new Set(ids);
    for (const item of queue) {
      expect(item.word).toBeDefined();
      expect(borrowed.has(item.wordId)).toBe(true);
    }
  });
});
