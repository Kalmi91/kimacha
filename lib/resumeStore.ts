import { Platform } from 'react-native';

import type { DB } from '@/lib/database';
import { activePairOf } from '@/lib/db/cardPairs';
import { RESUME_GAME_ID } from '@/lib/resumeRoute';

// Card-level resume: small, persistent "where I was" values for the Learn round and the grammar drill.
// On native it uses the existing game_progress table (game: RESUME_GAME_ID, item: the key), on web localStorage, because the
// web DB lives in memory (lost on reload). A `null` value = deleted. Saving is a convenience: on error
// the app carries on the normal way, it must not crash because of it. The error is logged, and a save
// reports false, so a caller can tell the learner the progress was not kept.

const WEB_PREFIX = 'kimacha-resume:';

// Web keys are per language pair (the native game_progress rows already are); no onboarding yet = the old unscoped key.
async function webKey(db: DB, key: string): Promise<string> {
  const ob = await db.getOnboarding();
  return ob ? `${WEB_PREFIX}${activePairOf(ob)}:${key}` : WEB_PREFIX + key;
}

// Values whose write is still in flight, by full storage key: a load right after a save sees the saved value (C53).
const pending = new Map<string, unknown>();

export async function loadResumeValue(db: DB, key: string): Promise<unknown> {
  try {
    if (Platform.OS === 'web') {
      const k = await webKey(db, key);
      if (pending.has(k)) return pending.get(k);
      if (typeof localStorage === 'undefined') return null;
      let raw = localStorage.getItem(k);
      if (raw === null && k !== WEB_PREFIX + key) {
        // Claim-once migration: the old unscoped value moves to the active pair's key.
        raw = localStorage.getItem(WEB_PREFIX + key);
        if (raw !== null) {
          localStorage.setItem(k, raw);
          localStorage.removeItem(WEB_PREFIX + key);
        }
      }
      return raw === null ? null : JSON.parse(raw);
    }
    if (pending.has(key)) return pending.get(key);
    const row = (await db.getGameProgress(RESUME_GAME_ID)).find((r) => r.itemId === key);
    return row?.data ?? null;
  } catch (e) {
    console.warn('resumeStore: could not read', key, e);
    return null;
  }
}

/** true when the value was saved (or removed), false when it could not be (logged, never thrown). */
export async function saveResumeValue(db: DB, key: string, value: unknown): Promise<boolean> {
  let k = key;
  try {
    if (Platform.OS === 'web') {
      k = await webKey(db, key);
      if (typeof localStorage === 'undefined') return false;
      pending.set(k, value);
      if (value === null) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(value));
      return true;
    }
    pending.set(k, value);
    await db.setGameProgress(RESUME_GAME_ID, key, value === null ? 'cleared' : 'saved', value);
    return true;
  } catch (e) {
    console.warn('resumeStore: could not save', key, e);
    return false;
  } finally {
    if (pending.get(k) === value) pending.delete(k);
  }
}
