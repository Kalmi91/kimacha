import type { DB } from '@/lib/database';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';

// Card-level resume: if the app was closed during one exercise (drill) of a grammar lesson, on the
// next cold start (lib/useAppResume.ts navigates to the lesson) the lesson opens in the same exercise;
// the exercise itself gives the same item from the saved round (the `run` field of the progress row). When the lesson
// is left (the screen unmounts) the save is deleted, so opening the lesson later from the list does not jump into the drill.
// Invalid after a day change.

const DRILL_KEY = 'drill';

interface DrillResume {
  topicId: string;
  kind: string;
  day: string;
}

export async function loadDrillResume(db: DB): Promise<DrillResume | null> {
  const raw = await loadResumeValue(db, DRILL_KEY);
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<DrillResume>;
  return typeof r.topicId === 'string' && typeof r.kind === 'string' && typeof r.day === 'string'
    ? { topicId: r.topicId, kind: r.kind, day: r.day }
    : null;
}

export async function saveDrillResume(db: DB, resume: DrillResume): Promise<void> {
  await saveResumeValue(db, DRILL_KEY, resume);
}

export async function clearDrillResume(db: DB): Promise<void> {
  await saveResumeValue(db, DRILL_KEY, null);
}

/** The saved exercise, if it belongs to this lesson and today, and the lesson still offers this kind. */
export function drillToResume<K extends string>(saved: DrillResume | null, topicId: string, day: string, availableKinds: readonly K[]): K | null {
  if (!saved || saved.topicId !== topicId || saved.day !== day) return null;
  return availableKinds.find((k) => k === saved.kind) ?? null;
}
