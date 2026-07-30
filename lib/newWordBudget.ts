// FB77: a topic full of unknown words is overwhelming, so the learner gets a
// daily budget of brand-new words (Settings) plus optional "+5 new words" taps.
// This module holds the pure queue-side rule; the counters live in the DB.

export interface BudgetedItem {
  type: string;
  card: { reps: number };
}

// Keeps only `remaining` brand-new WORD cards (reps 0, never studied);
// everything already started, and every sentence card, passes through
// untouched. Order is preserved, so the words that survive are the first ones
// the topic offers.
export function capNewWords<T extends BudgetedItem>(items: T[], remaining: number): T[] {
  let left = Math.max(0, remaining);
  return items.filter((item) => {
    if (item.type !== 'word' || item.card.reps > 0) return true;
    if (left <= 0) return false;
    left--;
    return true;
  });
}
