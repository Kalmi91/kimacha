import type { DB } from '@/lib/database';
import type { QueuedSm2Card } from '@/lib/pcicSession';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';

// Card-level resume: the Learn round continues where it was left off when the app was closed. The queue
// is rebuilt from the saved SRS state anyway (the rated cards are saved); this snapshot puts the ORDER
// back onto the rebuilt queue (the current card, the place of the failed card) and the "again" timers, as
// well as the base of the "+N new words" batch bar (batchBase). Not saved: the half-typed / revealed answer.
// On a day change and a level change the snapshot is invalid (the queue is built the normal way); whatever
// is no longer due or no longer exists is not in the rebuilt queue either, so it drops out.

const LEARN_KEY = 'learn';

interface LearnResume {
  day: string;
  level: string;
  /** The queue's items in order, the first one is the current card. */
  order: string[];
  /** Return time of the failed ("again") cards (ms, Date.now()-based). */
  returns: Record<string, number>;
  /** Base of the "+N new words" batch (the cards the day had finished before the expansion), or null if there is no active batch. */
  base: number | null;
}

export function buildLearnResume(queue: QueuedSm2Card[], day: string, level: string, base: number | null): LearnResume {
  const returns: Record<string, number> = {};
  for (const c of queue) if (c.returnAt !== undefined) returns[c.itemId] = c.returnAt;
  return { day, level, order: queue.map((c) => c.itemId), returns, base };
}

/** Whether the snapshot is valid for this day and level. */
export function isLearnResumeFor(saved: LearnResume | null, day: string, level: string): saved is LearnResume {
  return saved !== null && saved.day === day && saved.level === level;
}

/**
 * Puts the saved order onto the normally rebuilt queue: the saved items (those still in the queue) go to the front in the
 * saved order, the failed cards get their timers back; the other items of the queue follow them in their
 * normal order. For an invalid snapshot (another day / level) the queue is unchanged.
 */
export function applyLearnResume(queue: QueuedSm2Card[], saved: LearnResume | null, day: string, level: string): QueuedSm2Card[] {
  if (!isLearnResumeFor(saved, day, level)) return queue;
  const rest = new Map(queue.map((c) => [c.itemId, c]));
  const head: QueuedSm2Card[] = [];
  for (const id of saved.order) {
    const card = rest.get(id);
    if (!card) continue;
    rest.delete(id);
    head.push(saved.returns[id] !== undefined ? { ...card, returnAt: saved.returns[id] } : card);
  }
  return [...head, ...queue.filter((c) => rest.has(c.itemId))];
}

function parseLearnResume(raw: unknown): LearnResume | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<LearnResume>;
  if (typeof r.day !== 'string' || typeof r.level !== 'string') return null;
  if (!Array.isArray(r.order) || !r.order.every((id) => typeof id === 'string')) return null;
  const returns: Record<string, number> = {};
  if (typeof r.returns === 'object' && r.returns !== null) {
    for (const [id, at] of Object.entries(r.returns)) if (typeof at === 'number') returns[id] = at;
  }
  return { day: r.day, level: r.level, order: r.order, returns, base: typeof r.base === 'number' ? r.base : null };
}

export async function loadLearnResume(db: DB): Promise<LearnResume | null> {
  return parseLearnResume(await loadResumeValue(db, LEARN_KEY));
}

export async function saveLearnResume(db: DB, resume: LearnResume): Promise<void> {
  await saveResumeValue(db, LEARN_KEY, resume);
}

/** After the progress is reset the snapshot referred to the old state, so it is dropped. */
export async function clearLearnResume(db: DB): Promise<void> {
  await saveResumeValue(db, LEARN_KEY, null);
}
