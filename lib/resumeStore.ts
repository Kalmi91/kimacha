import { Platform } from 'react-native';

import type { DB } from '@/lib/database';
import { RESUME_GAME_ID } from '@/lib/resumeRoute';

// (kártya-szintű folytatás): kis, tartós "hol tartottam" értékek a Learn-körnek és a nyelvtani drillnek.
// Natívon a meglévő game_progress tábla (játék: RESUME_GAME_ID, tétel: a kulcs), weben a localStorage, mert a
// webes DB memóriában él (újratöltéskor elvész). `null` érték = törölve. A mentés kényelmi funkció: hiba esetén
// az app a normál úton megy tovább, nem állhat le miatta.

const WEB_PREFIX = 'kimacha-resume:';

export async function loadResumeValue(db: DB, key: string): Promise<unknown> {
  try {
    if (Platform.OS === 'web') {
      const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(WEB_PREFIX + key);
      return raw === null ? null : JSON.parse(raw);
    }
    const row = (await db.getGameProgress(RESUME_GAME_ID)).find((r) => r.itemId === key);
    return row?.data ?? null;
  } catch {
    return null;
  }
}

export async function saveResumeValue(db: DB, key: string, value: unknown): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') return;
      if (value === null) localStorage.removeItem(WEB_PREFIX + key);
      else localStorage.setItem(WEB_PREFIX + key, JSON.stringify(value));
      return;
    }
    await db.setGameProgress(RESUME_GAME_ID, key, value === null ? 'cleared' : 'saved', value);
  } catch {
    // lásd a fájl tetején
  }
}
