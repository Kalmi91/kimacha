// NY2 (NYELVTAN.md "Unlock-modell"): egy nyelvtani témát a mondat-átírás
// (transform) itemjeinek szavai zárnak fel, nem egy globális szószám-szint.
// Tiszta modul, React nélkül: az "ismert szó" halmazát a hívó adja (a
// meglévő db.getWordStates definíciója, lap >= 3 VAGY buried), itt nem dől el.

import { isLessonV2, type GrammarTopicData } from '../games/content';

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

export type LockState = { state: 'locked' | 'unlocked'; have: number; need: number };

/**
 * A téma zár-állapota: `need` a transform-szavak uniójának mérete, `have`
 * ebből az ismert szavak száma. `need === 0` (nincs transform item, vagy nem
 * V2 lecke) mindig `unlocked`.
 */
export function lockState(lesson: GrammarTopicData, knownIds: Set<string>): LockState {
  const wordIds = transformWordIds(lesson);
  const need = wordIds.length;
  if (need === 0) return { state: 'unlocked', have: 0, need: 0 };
  const have = wordIds.filter((id) => knownIds.has(id)).length;
  return { state: have === need ? 'unlocked' : 'locked', have, need };
}

// A "feloldás-sáv már látott" jelzők game_progress kulcsa (NY2, app/grammar/index.tsx).
export const GRAMMAR_UNLOCK_SEEN_KEY = 'grammar-unlock-seen';
