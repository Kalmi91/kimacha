// "Known" = a PCIC item whose
// review interval is >= KNOWN_THRESHOLD_DAYS; "graduated" = past
// the learning steps (state 'review', beyond the SM-2 "learning" phase),
// but below the threshold. Pure functions over the already loaded Sm2Card[],
// following the pattern of lib/pcicLevels.ts (the caller supplies the cards, this only filters).
//
// Items marked by hand as "I won't learn this" (sm2MarkKnown, `known: true`)
// are not included in either count: they did not become known through repetition,
// the learner just declared once that they know them.

import type { Sm2Card } from './sm2';

export const KNOWN_THRESHOLD_DAYS = 21;

function isGraduatedNaturally(card: Sm2Card): boolean {
  return card.state === 'review' && !card.known;
}

/** Past the learning steps (state === 'review'), excluding items marked
 *  "known" by hand. Also includes the set of `countKnown`. */
export function countGraduated(cards: Sm2Card[]): number {
  return cards.filter(isGraduatedNaturally).length;
}

/** Number of graduated items that reached a review interval of
 *  `thresholdDays` days. */
export function countKnown(cards: Sm2Card[], thresholdDays: number = KNOWN_THRESHOLD_DAYS): number {
  return cards.filter((c) => isGraduatedNaturally(c) && c.interval >= thresholdDays).length;
}

/**
 * The count of the "Words Known" card. The 21-day threshold
 * (`countKnown`) gave 0 for weeks for a beginner even though they had already learned words, so the
 * card counts LEARNED words: those past the learning steps (state
 * 'review'), or those the learner marked as known ("I won't learn this"). The stable (21+
 * day) number stays on a separate tile.
 */
export function countLearned(cards: Sm2Card[]): number {
  return cards.filter((c) => c.known || c.state === 'review').length;
}
