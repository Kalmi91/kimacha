import { Platform } from 'react-native';

import type { DB } from '@/lib/database';
import { hasLesson } from '@/lib/grammar/syllabus';

// The app saves the last resumable place (tab, grammar lesson and its table exercise), and on cold start
// (also when returning from the background, if Android killed the process) steps back to it, so that quitting
// and coming back puts the learner where they were. The level of the Learn tab is already persisted with the
// PCIC level, and the queue is rebuilt from the saved SRS state, so it continues from the same place.
// Not saved: a half-typed answer, the exam / level test / onboarding (their state cannot be resumed).

export const RESUME_GAME_ID = 'app-resume';
const RESUME_ITEM_ID = 'route';
// The web DB lives in memory (lost on reload), so the web build keeps the place in localStorage.
const WEB_KEY = 'kimacha-resume';

const TAB_PATHS = new Set(['/course', '/stats', '/settings']);
const DECK_RE = /^\/grammar\/deck\/([^/]+)$/;
const LESSON_RE = /^\/grammar\/([^/]+)$/;

/** The place to save, from the expo-router pathname: the Learn tab ('/'), the three other tabs, the grammar lesson and its
 *  table exercise. Every other screen is not resumable: null (the previously saved place stays). */
export function resumablePath(pathname: string): string | null {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (p === '/' || p === '') return '/';
  if (TAB_PATHS.has(p) || DECK_RE.test(p)) return p;
  const lesson = LESSON_RE.exec(p);
  return lesson && lesson[1] !== 'deck' ? p : null;
}

/** The navigation to perform at startup for the saved place (the first step is `replace`, the rest `push`, so that
 *  Back leads to the Grammar list). An empty list = the home screen (Learn) stays: there is no saved place, Learn was the
 *  last one, or the saved place no longer exists (deleted lesson). */
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
    // Saving the place is a convenience: on error the app starts from the home screen, it must not crash because of it.
  }
}
