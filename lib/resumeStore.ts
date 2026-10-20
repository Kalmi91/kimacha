import { Platform } from 'react-native';

import type { DB } from '@/lib/database';
import { RESUME_GAME_ID } from '@/lib/resumeRoute';

// Card-level resume: small, persistent "where I was" values for the Learn round and the grammar drill.
// On native it uses the existing game_progress table (game: RESUME_GAME_ID, item: the key), on web localStorage, because the
// web DB lives in memory (lost on reload). A `null` value = deleted. Saving is a convenience: on error
// the app carries on the normal way, it must not crash because of it. The error is logged, and a save
// reports false, so a caller can tell the learner the progress was not kept.

const WEB_PREFIX = 'kimacha-resume:';

export async function loadResumeValue(db: DB, key: string): Promise<unknown> {
  try {
    if (Platform.OS === 'web') {
      const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(WEB_PREFIX + key);
      return raw === null ? null : JSON.parse(raw);
    }
    const row = (await db.getGameProgress(RESUME_GAME_ID)).find((r) => r.itemId === key);
    return row?.data ?? null;
  } catch (e) {
    console.warn('resumeStore: could not read', key, e);
    return null;
  }
}

/** true when the value was saved (or removed), false when it could not be (logged, never thrown). */
export async function saveResumeValue(db: DB, key: string, value: unknown): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') return false;
      if (value === null) localStorage.removeItem(WEB_PREFIX + key);
      else localStorage.setItem(WEB_PREFIX + key, JSON.stringify(value));
      return true;
    }
    await db.setGameProgress(RESUME_GAME_ID, key, value === null ? 'cleared' : 'saved', value);
    return true;
  } catch (e) {
    console.warn('resumeStore: could not save', key, e);
    return false;
  }
}
