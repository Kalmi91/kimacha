import { useEffect, useState } from 'react';

import { getDb } from '@/lib/database';
import { loadResumeValue } from '@/lib/resumeStore';
import { levelShownKey, parseShownPct, shownPctOf } from '@/lib/grammar/levelTest';

/**
 * The standing of a level (FB616): the stored, never-sinking number of the level test (lib/grammar/levelTest.ts nextShownPct),
 * at least the real percent. `null` until the stored value of THIS pair and level is read (so nothing is drawn with the real
 * percent first and then jumps); a failed read counts as "nothing stored". Reloaded whenever `reload` (the screen's evidence
 * map, a new one on every focus) changes; the value of another pair or level is never shown.
 */
export function useLevelShown(pair: string, level: string, real: number, reload: unknown): number | null {
  const key = levelShownKey(pair, level);
  const [stored, setStored] = useState<{ key: string; value: number | null } | null>(null);
  useEffect(() => {
    let alive = true;
    loadResumeValue(getDb(), key)
      .then((raw) => parseShownPct(raw))
      .catch(() => null)
      .then((value) => {
        if (alive) setStored({ key, value });
      });
    return () => {
      alive = false;
    };
  }, [key, reload]);
  return stored && stored.key === key ? shownPctOf(stored.value, real) : null;
}
