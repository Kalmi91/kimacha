import type { QueuedSm2Card } from '@/lib/pcicSession';

/** A new word the learner missed today and has not yet typed right (still in the learning state). */
const isMissedNewWord = (c: QueuedSm2Card, day: string): boolean => c.state === 'learning' && c.introducedAt === day;

/**
 * FB658: a separate queue-only layer, never touches cards or their scheduler state. While a new word missed today
 * is still waiting, every unseen word goes behind all other cards, so no new word comes before it is typed right.
 * The missed word always stays in the queue (it returns on its timer, or at once when nothing else is left), and a
 * typed-right word leaves the learning state, so the gate cannot trap the learner.
 */
export function holdNewUntilMissedTyped(queue: QueuedSm2Card[], day: string): QueuedSm2Card[] {
  if (!queue.some((c) => isMissedNewWord(c, day))) return queue;
  const fresh = queue.filter((c) => c.state === 'new');
  if (fresh.length === 0) return queue;
  return [...queue.filter((c) => c.state !== 'new'), ...fresh];
}
