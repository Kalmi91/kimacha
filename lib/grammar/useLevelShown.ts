import { useEffect, useState } from 'react';

import { getDb } from '@/lib/database';
import { loadResumeValue } from '@/lib/resumeStore';
import { levelShownKey, parseShownPct, shownPctOf } from '@/lib/grammar/levelTest';

/**
 * The standing of a level (FB616): the stored, never-sinking number of the level test (lib/grammar/levelTest.ts nextShownPct),
 * at least the real percent. Reloaded whenever `reload` (the screen's evidence map, a new one on every focus) changes, so the syllabus header and the test button show the
 * same number as the test's bar after coming back from it.
 */
export function useLevelShown(pair: string, level: string, real: number, reload: unknown): number {
  const [stored, setStored] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    loadResumeValue(getDb(), levelShownKey(pair, level)).then((raw) => {
      if (alive) setStored(parseShownPct(raw));
    });
    return () => {
      alive = false;
    };
  }, [pair, level, reload]);
  return shownPctOf(stored, real);
}
