// The control shown at the bottom of Settings, ONLY in __DEV__, sets up an A1 state so that the
// level exam can be clicked through in the web preview: DEV_SEED_PERCENT% of the level's
// cards are graduated (review) and one A1 grammar lesson is done. In a release build
// (`__DEV__ === false`) the control is not rendered and this module is never called from there.

import { pcicItemsForLevel, type PcicTarget } from '@/data/pcic';
import { GRAMMAR_PROGRESS_KEY, hasLesson, syllabusForLevel } from '@/lib/grammar/syllabus';
import { addDays, sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { EXAM_LEVELS } from './types';

/** Above the unlock threshold (80%) so that the state set by the control is guaranteed to be unlocked. */
export const DEV_SEED_PERCENT = 85;

/** The first DEV_SEED_PERCENT% of the cards, graduated; their due date is in the future, so they do not flood the Learn tab. */
export function a1SeedCards(itemIds: string[], today: string): Sm2Card[] {
  const n = Math.ceil((itemIds.length * DEV_SEED_PERCENT) / 100);
  return itemIds.slice(0, n).map((itemId) => ({
    ...sm2NewCard(itemId),
    state: 'review' as const,
    interval: 7,
    reps: 3,
    due: addDays(today, 7),
    lastReview: today,
    introducedAt: today,
  }));
}

/**
 * The A1 lesson the control marks as done. In Spanish this is the present tense: it unlocks the
 * conjugated verb forms in the sentence gate, without it there are almost no exam sentences (lib/knownSentence.ts).
 */
export function a1SeedLesson(lang: PcicTarget): string | undefined {
  if (lang === 'es') return 'presente-regular';
  return syllabusForLevel('A1', lang).find((topic) => hasLesson(lang, topic.id))?.id;
}

type SeedStore = {
  upsertPcicCard(card: Sm2Card): Promise<void>;
  setGameProgress(gameId: string, itemId: string, state: string, data?: unknown): Promise<void>;
};

/** Sets up the A1 exam state for the active direction's deck (the caller calls `setPcicTarget` first). */
export async function seedA1ExamState(store: SeedStore, target: PcicTarget, today: string): Promise<void> {
  for (const card of a1SeedCards(pcicItemsForLevel('A1').map((i) => i.id), today)) {
    await store.upsertPcicCard(card);
  }
  const lesson = a1SeedLesson(target);
  // The `itemId === topicId` row means every task kind is done (lib/grammar/syllabus.ts doneGrammarTopicProgress).
  if (lesson) await store.setGameProgress(GRAMMAR_PROGRESS_KEY, lesson, 'done', { correct: 1, total: 1 });
}

/**
 * The state of EVERY exam level at once (A1-B2): DEV_SEED_PERCENT% of the level's cards are
 * graduated and every written lesson of the direction is done (an A2+ exam sentence also uses the
 * tenses and words of earlier levels, so the unlocked tenses accumulate as on the real path).
 * Running it again sets up the same state. The caller calls `setPcicTarget` first.
 */
export async function seedExamState(store: SeedStore, target: PcicTarget, today: string): Promise<void> {
  for (const level of EXAM_LEVELS) {
    for (const card of a1SeedCards(pcicItemsForLevel(level).map((i) => i.id), today)) {
      await store.upsertPcicCard(card);
    }
    for (const topic of syllabusForLevel(level, target)) {
      if (hasLesson(target, topic.id)) await store.setGameProgress(GRAMMAR_PROGRESS_KEY, topic.id, 'done', { correct: 1, total: 1 });
    }
  }
}
