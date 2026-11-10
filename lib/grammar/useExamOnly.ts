import { useCallback, useEffect, useState } from 'react';

import { getDb } from '@/lib/database';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';

/** The one global key of the "exam topics only" switch of the Grammar tab (resume store, no schema change). */
export const EXAM_ONLY_KEY = 'grammar-exam-only';

/**
 * The "exam topics only" switch, remembered across tab leaves and app restarts (stored like the level standing,
 * lib/grammar/useLevelShown.ts: the resume store, one global value). Until the stored value is read it is `false`,
 * so the list is drawn unfiltered first (no flicker of an empty level); a failed read counts as off.
 */
export function useExamOnly(): [boolean, () => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    loadResumeValue(getDb(), EXAM_ONLY_KEY)
      .then((raw) => raw === true)
      .catch(() => false)
      .then((value) => {
        if (alive) setOn(value);
      });
    return () => {
      alive = false;
    };
  }, []);
  const toggle = useCallback(() => {
    const next = !on;
    setOn(next);
    void saveResumeValue(getDb(), EXAM_ONLY_KEY, next);
  }, [on]);
  return [on, toggle];
}
