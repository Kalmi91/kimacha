// PLAN-vizsga A. szakasz 2. lépés (8. követelmény): a Settings alján, CSAK __DEV__-ben
// látszó vezérlő egy A1 állapotot állít be, hogy a szintvizsga a web-előnézetben
// végigkattintható legyen: a szint kártyáinak DEV_SEED_PERCENT%-a graduált (review),
// és egy A1 nyelvtani lecke kész. Release-buildben (`__DEV__ === false`) a vezérlő
// nem renderelődik, ez a modul onnan nem hívódik.

import { pcicItemsForLevel, type PcicTarget } from '@/data/pcic';
import { GRAMMAR_PROGRESS_KEY, hasLesson, syllabusForLevel } from '@/lib/grammar/syllabus';
import { addDays, sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { EXAM_LEVELS } from './types';

/** A feloldási küszöb (80%) fölött, hogy a vezérlő által beállított állapot biztosan nyitott legyen. */
export const DEV_SEED_PERCENT = 85;

/** Az első DEV_SEED_PERCENT% graduált kártya, a jövőbeli esedékesség miatt nem lepi el a tanulófület. */
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
 * Az A1 lecke, amit a vezérlő késznek jelöl. Spanyolon a jelen idő: az nyitja fel az igék
 * ragozott alakjait a mondat-kapuban, enélkül szinte nincs vizsga-mondat (lib/knownSentence.ts).
 */
export function a1SeedLesson(lang: PcicTarget): string | undefined {
  if (lang === 'es') return 'presente-regular';
  return syllabusForLevel('A1', lang).find((topic) => hasLesson(lang, topic.id))?.id;
}

type SeedStore = {
  upsertPcicCard(card: Sm2Card): Promise<void>;
  setGameProgress(gameId: string, itemId: string, state: string, data?: unknown): Promise<void>;
};

/** Beállítja az A1 vizsga-állapotot az aktív irány paklijára (a hívó előtte `setPcicTarget`-et hív). */
export async function seedA1ExamState(store: SeedStore, target: PcicTarget, today: string): Promise<void> {
  for (const card of a1SeedCards(pcicItemsForLevel('A1').map((i) => i.id), today)) {
    await store.upsertPcicCard(card);
  }
  const lesson = a1SeedLesson(target);
  // Az `itemId === topicId` sor minden feladat-fajtát késznek jelent (lib/grammar/syllabus.ts doneGrammarTopicProgress).
  if (lesson) await store.setGameProgress(GRAMMAR_PROGRESS_KEY, lesson, 'done', { correct: 1, total: 1 });
}

/**
 * 4. lépés: MINDEN vizsga-szint állapota egyszerre (A1-B2): a szint kártyáinak DEV_SEED_PERCENT%-a
 * graduált, és az irány minden megírt leckéje kész (egy A2+ vizsga-mondat a korábbi szintek
 * igeidőit és szavait is használja, ezért a feloldott igeidők a valós útnak megfelelően halmozódnak).
 * Újrafuttatva ugyanazt állítja be. A hívó előtte `setPcicTarget`-et hív.
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
