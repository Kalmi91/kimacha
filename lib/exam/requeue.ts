// The card of a failed WORD item goes back into SM-2 review: it gets an `again` rating (due
// immediately, it comes up in the Learn tab's next round), as if the learner had failed it on the Learn tab.
// A failed GRAMMAR item has no SM-2 card, there only a lesson link appears on the result
// (lib/exam/skills.ts), so this module does not touch grammar, reading or speaking items.

import { sm2Review, type Sm2Card } from '@/lib/sm2';
import type { ExamItemResult } from './types';

/** Card ids of the word items solved wrongly, once each, in exam order. */
export function wrongWordItemIds(results: ExamItemResult[]): string[] {
  const ids: string[] = [];
  for (const { item, correct } of results) {
    if (correct || item.skill !== 'words') continue;
    // Matching is one item: if failed, all four of its words go back (the item does not isolate the wrong pair).
    if (item.kind === 'match') ids.push(...item.itemIds);
    else if (item.kind === 'word_type' || item.kind === 'sent_order' || item.kind === 'sent_type') ids.push(item.itemId);
  }
  return Array.from(new Set(ids));
}

/**
 * The cards to send back: the existing SM-2 card of the wrong words with an `again` rating, due
 * `today`. A word without a card is skipped (only learned words that have cards get into the exam).
 */
export function requeueWrongWords(cards: Sm2Card[], results: ExamItemResult[], today: string): Sm2Card[] {
  const byId = new Map(cards.map((c) => [c.itemId, c]));
  const out: Sm2Card[] = [];
  for (const id of wrongWordItemIds(results)) {
    const card = byId.get(id);
    if (card) out.push(sm2Review(card, 'again', today));
  }
  return out;
}
