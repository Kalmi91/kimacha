// Which mode the Practice tab shows (the chip row, components/practice/modes.ts): the id of the last chosen one is kept
// in the resume store, so the tab opens on it again after a restart. Reading is the default and the fallback.

import { getDb } from '@/lib/database';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';

export const READING_MODE = 'reading';

const KEY = 'practice-mode';

export async function loadPracticeMode(): Promise<string | null> {
  const raw = await loadResumeValue(getDb(), KEY);
  return typeof raw === 'string' && raw !== '' ? raw : null;
}

export async function savePracticeMode(id: string): Promise<void> {
  await saveResumeValue(getDb(), KEY, id);
}

/** The mode to show: the saved one while it is still switched on, otherwise Reading. */
export function resolvePracticeMode(saved: string | null, enabledIds: readonly string[]): string {
  return saved !== null && enabledIds.includes(saved) ? saved : READING_MODE;
}
