// NY2 (NYELVTAN.md "Unlock-modell"): egy nyelvtani témát a mondat-átírás
// (transform) itemjeinek szavai zárnak fel, nem egy globális szószám-szint.
// Tiszta modul, React nélkül: az "ismert szó" halmazát a hívó adja (a
// meglévő db.getWordStates definíciója, lap >= 3 VAGY buried), itt nem dől el.
// FB318: a `focusTopic` mezőjű leckéknél a szó-halmaz a transform-szavak ÉS
// a témakör kártyáinak uniója (lásd lessonWordIds), nem csak a transform-szavak.

import { isLessonV2, type GrammarTopicData } from '../games/content';
import { getWordsForTopic } from '@/data/words';

/** A lecke transform itemjeinek wordId-uniója, első előfordulás sorrendjében. */
export function transformWordIds(lesson: GrammarTopicData): string[] {
  if (!isLessonV2(lesson)) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of lesson.items) {
    if (item.kind !== 'transform') continue;
    for (const id of item.wordIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/**
 * A lecke teljes szó-halmaza: a transform-szavak, utána (ha van `focusTopic`)
 * a témakör kártyái, duplikátum nélkül, első előfordulás sorrendjében. Ezt
 * használja a zár (lockState) ÉS a "Ezen szavak tanulása" gomb, EGY szám.
 */
export function lessonWordIds(lesson: GrammarTopicData): string[] {
  if (!isLessonV2(lesson)) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const id of transformWordIds(lesson)) {
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  if (lesson.focusTopic) {
    for (const w of getWordsForTopic(lesson.level, lesson.focusTopic)) {
      const id = String(w.id);
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export type LockState = { state: 'locked' | 'unlocked'; have: number; need: number };

/**
 * A téma zár-állapota: `need` a lecke szó-halmazának mérete (lessonWordIds),
 * `have` ebből az ismert szavak száma. `need === 0` (nincs transform item, vagy
 * nem V2 lecke) mindig `unlocked`.
 */
export function lockState(lesson: GrammarTopicData, knownIds: Set<string>): LockState {
  const wordIds = lessonWordIds(lesson);
  const need = wordIds.length;
  if (need === 0) return { state: 'unlocked', have: 0, need: 0 };
  const have = wordIds.filter((id) => knownIds.has(id)).length;
  return { state: have === need ? 'unlocked' : 'locked', have, need };
}

// A "feloldás-sáv már látott" jelzők game_progress kulcsa (NY2, app/grammar/index.tsx).
export const GRAMMAR_UNLOCK_SEEN_KEY = 'grammar-unlock-seen';
