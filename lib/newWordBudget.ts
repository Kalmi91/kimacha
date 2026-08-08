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

// FB103, Kálmán 2026-08-08: "az a baj, hogy nem tudom mikor fogy el a napi 5 új
// szó. azt kellene hogy mindig 5 új szó legyen benne ha nem találom mi őket
// akkor ne rakjon be 5 új szót, mert akkor torlódik."
//
// Two ceilings, the tighter one wins:
//   1. the FB77 daily one, `limit + bonus` new words may START on a given day;
//   2. a work-in-progress one, at most `limit` words may be half-learned at a
//      time (FSRS Learning/Relearning state). Words that keep being missed
//      therefore block tomorrow's intake instead of piling up on top of it.
// The "+5 new words" bonus overrides both, it is the learner's explicit ask.
export interface NewWordAllowance {
  limit: number;
  bonus: number;
  startedToday: number;
  unlearned: number;
}

export function newWordAllowance({ limit, bonus, startedToday, unlearned }: NewWordAllowance): number {
  const daily = limit + bonus - startedToday;
  const inFlight = limit + bonus - unlearned;
  return Math.max(0, Math.min(daily, inFlight));
}
