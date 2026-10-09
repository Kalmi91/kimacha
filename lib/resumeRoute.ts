import { Platform } from 'react-native';

import type { DB } from '@/lib/database';
import { hasLesson } from '@/lib/grammar/syllabus';

// ("csináld meg úgy az appot, ha kilépek és visszalépek, akkor oda tegyen vissza, ahol voltam"):
// az app az utolsó folytatható helyet menti (fül, nyelvtani lecke és táblás gyakorlata), és hidegindításkor
// (háttérből visszatéréskor is, ha az Android kilőtte a folyamatot) oda lép vissza. A Learn fül szintje a
// PCIC-szintnél eleve perzisztált, a sor a mentett SRS-állapotból épül újra, ezért ugyanonnan folytatódik.
// Nem mentődik: a félig begépelt válasz, a vizsga / szintfelmérés / onboarding (azok állapota nem folytatható).

export const RESUME_GAME_ID = 'app-resume';
const RESUME_ITEM_ID = 'route';
// A webes DB memóriában él (újratöltéskor elvész), ezért a webes build a helyet a localStorage-ban őrzi.
const WEB_KEY = 'kimacha-resume';

const TAB_PATHS = new Set(['/course', '/stats', '/settings']);
const DECK_RE = /^\/grammar\/deck\/([^/]+)$/;
const LESSON_RE = /^\/grammar\/([^/]+)$/;

/** A mentendő hely az expo-router pathname-jéből: a Learn fül ('/'), a három másik fül, a nyelvtani lecke és a
 *  táblás gyakorlata. Minden más képernyő nem folytatható: null (a korábban mentett hely marad). */
export function resumablePath(pathname: string): string | null {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (p === '/' || p === '') return '/';
  if (TAB_PATHS.has(p) || DECK_RE.test(p)) return p;
  const lesson = LESSON_RE.exec(p);
  return lesson && lesson[1] !== 'deck' ? p : null;
}

/** A mentett helyhez az induláskor végrehajtandó navigáció (az első lépés `replace`, a többi `push`, hogy a
 *  Vissza a Nyelvtan listára vigyen). Üres lista = a kezdőlap (Learn) marad: nincs mentett hely, a Learn volt az
 *  utolsó, vagy a mentett hely már nem létezik (törölt lecke). */
export function resumeSteps(saved: string | null, lang: string): string[] {
  const path = saved ? resumablePath(saved) : null;
  if (!path || path === '/') return [];
  if (TAB_PATHS.has(path)) return [`/(tabs)${path}`];
  const deck = DECK_RE.exec(path);
  const topicId = (deck ?? LESSON_RE.exec(path))?.[1];
  if (!topicId || !hasLesson(lang, topicId)) return [];
  return deck ? ['/(tabs)/course', `/grammar/${topicId}`, path] : ['/(tabs)/course', path];
}

export async function loadResumePath(db: DB): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return typeof localStorage === 'undefined' ? null : localStorage.getItem(WEB_KEY);
    const row = (await db.getGameProgress(RESUME_GAME_ID)).find((r) => r.itemId === RESUME_ITEM_ID);
    const path = (row?.data as { path?: unknown } | undefined)?.path;
    return typeof path === 'string' ? path : null;
  } catch {
    return null;
  }
}

export async function saveResumePath(db: DB, path: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(WEB_KEY, path);
      return;
    }
    await db.setGameProgress(RESUME_GAME_ID, RESUME_ITEM_ID, 'saved', { path });
  } catch {
    // A hely mentése kényelmi funkció: hiba esetén az app a kezdőlapról indul, nem állhat le miatta.
  }
}
