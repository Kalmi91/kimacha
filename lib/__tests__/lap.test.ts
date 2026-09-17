// UTEMEZO 1./3.3/3.4/11. szakasz: a lap.ts helper-ek + a database.web.ts
// startWord/passLap/getInHandWordCards/getMasteredWordCount/buryCard
// lap-alapú viselkedése.

import { isLearned, nextLap, lapShape, backfillLap, needsReviewLapBackfill } from '../lap';
import { getDb } from '../database.web';
import { getWordsForLevel } from '@/data/words';
import { isTopicMastered, masteredCount, isWordMastered } from '../topicMastery';

const WORD = getWordsForLevel('A1', 'es')[0];

describe('lib/lap.ts pure helpers', () => {
  it('isLearned is true only from lap 3', () => {
    expect(isLearned({ lap: 0 })).toBe(false);
    expect(isLearned({ lap: 2 })).toBe(false);
    expect(isLearned({ lap: 3 })).toBe(true);
    expect(isLearned({})).toBe(false);
  });

  it('nextLap is the lap after the current one, capped at 3', () => {
    expect(nextLap({ lap: 0 })).toBe(1);
    expect(nextLap({ lap: 1 })).toBe(2);
    expect(nextLap({ lap: 2 })).toBe(3);
    expect(nextLap({ lap: 3 })).toBe(3);
    expect(nextLap({})).toBe(1);
  });

  it('lapShape matches the old one-based phaseShape ladder', () => {
    expect(lapShape(1)).toEqual({ isTyping: false });
    expect(lapShape(2)).toEqual({ isTyping: false, typingDirection: 'native-to-learned' });
    expect(lapShape(3)).toEqual({ isTyping: true, typingDirection: 'native-to-learned' });
  });

  it('backfillLap mirrors reps-lapses, floored at 0 and capped at 3', () => {
    expect(backfillLap(0, 0)).toBe(0);
    expect(backfillLap(2, 0)).toBe(2);
    expect(backfillLap(5, 0)).toBe(3);
    expect(backfillLap(2, 5)).toBe(0); // lapses > reps must never go negative
  });

  // UTEMEZO 12/4: a masodik, utolagos migracio szabalya (lib/database.ts UPDATE
  // szo szerint ugyanezt a felteteltet futtatja SQL-ben).
  it('needsReviewLapBackfill flags an FSRS-Review word stuck below lap 3', () => {
    expect(needsReviewLapBackfill({ state: 2, lap: 0 })).toBe(true);
    expect(needsReviewLapBackfill({ state: 2, lap: 2 })).toBe(true);
    expect(needsReviewLapBackfill({ state: 3, lap: 1 })).toBe(true); // Relearning is also >= 2
    expect(needsReviewLapBackfill({ state: 2, lap: 3 })).toBe(false); // already caught up
    expect(needsReviewLapBackfill({ state: 1, lap: 2 })).toBe(false); // Learning, not Review
    expect(needsReviewLapBackfill({ state: 0 })).toBe(false);
  });
});

describe('database.web lap-tracking (UTEMEZO 11. szakasz)', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.setOnboarding('hu', 'es');
    await db.resetAllProgress();
  });

  it('startWord puts the word in hand and is idempotent', async () => {
    const db = getDb();
    await db.startWord(WORD.id);
    await db.startWord(WORD.id);

    const inHand = await db.getInHandWordCards();
    expect(inHand).toEqual([{ word_id: WORD.id, lap: 0 }]);
  });

  it('three passLap calls learn the word; a fourth is a no-op and does not touch learned_at', async () => {
    const db = getDb();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T10:00:00Z'));
    try {
      await db.startWord(WORD.id);
      expect(await db.passLap(WORD.id)).toBe(1);
      expect(await db.passLap(WORD.id)).toBe(2);
      expect(await db.passLap(WORD.id)).toBe(3);

      const [cardAfter3] = await db.getAllWordCards('hu-es');
      expect(cardAfter3.lap).toBe(3);
      expect(cardAfter3.in_hand).toBe(0);
      expect(await db.getWordsLearnedToday()).toBe(1);

      // A 4. hívás egy nappal később nem lép tovább, és nem írja felül a
      // learned_at-et (learned_at ilyenkor a tegnapi nap, nem a mai).
      jest.setSystemTime(new Date('2026-01-02T10:00:00Z'));
      expect(await db.passLap(WORD.id)).toBe(3);
      const [cardAfter4] = await db.getAllWordCards('hu-es');
      expect(cardAfter4.lap).toBe(3);
      expect(await db.getWordsLearnedToday()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('getInHandWordCards lists only non-buried in-hand words', async () => {
    const db = getDb();
    const other = getWordsForLevel('A1', 'es')[1];
    await db.startWord(WORD.id);
    await db.startWord(other.id);
    await db.buryCard(other.id, 'word');

    const inHand = await db.getInHandWordCards();
    expect(inHand.map((c) => c.word_id)).toEqual([WORD.id]);
  });

  it('getMasteredWordCount counts a lap-3 word and a buried word, not a lap-2 word', async () => {
    const db = getDb();
    const buried = getWordsForLevel('A1', 'es')[1];
    const inProgress = getWordsForLevel('A1', 'es')[2];

    await db.startWord(WORD.id);
    await db.passLap(WORD.id);
    await db.passLap(WORD.id);
    await db.passLap(WORD.id); // lap 3

    await db.ensureCard(buried.id, 'word');
    await db.buryCard(buried.id, 'word');

    await db.startWord(inProgress.id);
    await db.passLap(inProgress.id); // lap 1

    expect(await db.getMasteredWordCount('A1')).toBe(2);
  });

  // UTEMEZO 12/4: EGY "ismert"-definíció. A fa csempéje (getWordStates +
  // lib/topicMastery.ts) és a Stats-kártya (getMasteredWordCount) UGYANABBÓL az
  // adatból számol, tehát sose térhet el (a 928/931 vs 0/10 hiba gyökere).
  it('getWordStates agrees with getMasteredWordCount: lap-3 and buried known, lap-2 not', async () => {
    const db = getDb();
    const buried = getWordsForLevel('A1', 'es')[1];
    const inProgress = getWordsForLevel('A1', 'es')[2];

    await db.startWord(WORD.id);
    await db.passLap(WORD.id);
    await db.passLap(WORD.id);
    await db.passLap(WORD.id); // (a) lap 3

    await db.ensureCard(buried.id, 'word');
    await db.buryCard(buried.id, 'word'); // (b) eltemetve

    await db.startWord(inProgress.id);
    await db.passLap(inProgress.id);
    await db.passLap(inProgress.id); // (d) lap 2

    const ids = [WORD.id, buried.id, inProgress.id];
    const known = await db.getWordStates(ids);

    expect(isWordMastered(known.get(WORD.id))).toBe(true);
    expect(isWordMastered(known.get(buried.id))).toBe(true);
    expect(isWordMastered(known.get(inProgress.id))).toBe(false);
    expect(masteredCount(ids, known)).toBe(2);
    expect(isTopicMastered([WORD.id, buried.id], known)).toBe(true);
    expect(isTopicMastered(ids, known)).toBe(false);

    // A fa és a Stats-kártya ugyanazt a számot adja.
    expect(await db.getMasteredWordCount('A1')).toBe(masteredCount(ids, known));
  });

  it('buryCard clears in_hand', async () => {
    const db = getDb();
    await db.startWord(WORD.id);
    await db.buryCard(WORD.id, 'word');

    expect(await db.getInHandWordCards()).toEqual([]);
  });
});
