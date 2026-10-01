// PLAN-vizsga A. szakasz 3. lépés (Kálmán, 2026-10-01, A2 b + A3 a + A4 b): a
// szintvizsga akkor nyílik, ha a szint words-open kártyáinak legalább 80%-a
// TANULT, ÉS a szint legalább egy nyelvtani leckéje kész. Tiszta függvények, I/O
// nélkül; a hívó adja a kártyákat és a lecke-sorokat.

import { pcicItemsForLevel, type PcicLevel, type PcicTarget } from '@/data/pcic';
import { doneGrammarTopicProgress, syllabusTopic } from '@/lib/grammar/syllabus';
import type { Sm2Card } from '@/lib/sm2';
import type { ExamResult } from './types';

export const EXAM_UNLOCK_PCT = 80;

/**
 * "Tanult" szó (A2 b): az SM-2-ben graduált, vagyis `review` állapotú kártya, nem
 * csak bemutatott (`learning`) és nem új. A `known` jelölés (sm2MarkKnown) is
 * `review`-ba teszi a kártyát, tehát azt ez külön nélkül lefedi. A visszaesett
 * (lapse után újra `learning`) kártya nem tanult, amíg újra nem graduál; szigorúbb,
 * mint lib/knownSentence.ts isLearnedCard-ja, ami a mondatkártya-kapuhoz kell.
 */
export function isExamLearned(card: Sm2Card): boolean {
  return card.state === 'review';
}

export interface ExamUnlock {
  level: PcicLevel;
  /** A szint kártyáinak száma. */
  total: number;
  /** Ebből tanult. */
  learned: number;
  /** Ennyi tanult szó kell a feloldáshoz (a total 80%-a, felfelé kerekítve). */
  needed: number;
  /** Még ennyi hiányzik a szavakból (0, ha elég). */
  missing: number;
  /** Van-e kész nyelvtani lecke a szinten. */
  lessonDone: boolean;
  unlocked: boolean;
}

export function examUnlock(level: PcicLevel, levelItemIds: string[], cards: Sm2Card[], lessonDone: boolean): ExamUnlock {
  const ids = new Set(levelItemIds);
  const total = ids.size;
  const learned = cards.filter((c) => ids.has(c.itemId) && isExamLearned(c)).length;
  const needed = Math.ceil((total * EXAM_UNLOCK_PCT) / 100);
  const missing = Math.max(0, needed - learned);
  return { level, total, learned, needed, missing, lessonDone, unlocked: total > 0 && missing === 0 && lessonDone };
}

/** A kész leckék közül azok, amik a megadott szint tantervében vannak. */
export function doneLessonsOfLevel(level: PcicLevel, lang: string, doneTopicIds: Iterable<string>): string[] {
  return [...doneTopicIds].filter((id) => syllabusTopic(id, lang)?.level === level);
}

export type ExamLevelStatus = ExamUnlock & { result?: ExamResult };

/**
 * A szintválasztó lap vizsga-sorának adata: a feloldás állapota + a mentett eredmény.
 * A szint kártyái a betöltött korpuszból jönnek (`setPcicTarget` után az aktív irányé).
 */
export function examStatusFor(
  level: PcicLevel,
  target: PcicTarget,
  cards: Sm2Card[],
  grammarRows: { itemId: string; state: string; data: unknown }[],
  result?: ExamResult,
): ExamLevelStatus {
  const doneTopics = doneGrammarTopicProgress(target, grammarRows).keys();
  const lessonDone = doneLessonsOfLevel(level, target, doneTopics).length > 0;
  const unlock = examUnlock(level, pcicItemsForLevel(level).map((i) => i.id), cards, lessonDone);
  return result ? { ...unlock, result } : unlock;
}
