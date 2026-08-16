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
// The FB77 daily budget: `limit + bonus` new words may START on a given day.
// This is what the 🌱 header badge counts down, and it is the ONLY number the
// learner sees, so it must fall by exactly one per new word started.
export interface NewWordAllowance {
  limit: number;
  bonus: number;
  startedToday: number;
  /** Half-learned words (FSRS Learning/Relearning). Congestion only, see below. */
  unlearned?: number;
}

export function newWordsLeftToday({ limit, bonus, startedToday }: NewWordAllowance): number {
  return Math.max(0, limit + bonus - startedToday);
}

// FB112/FB113/FB114/FB115, Kálmán 2026-08-09/10: the badge jumped ("9 ből
// hirtelen 0 lett nem így egyesével fogyott", "megint 5 ből egy lett"), and the
// intake stayed at 5 however high the Settings limit was ("egyszerre mindig 5
// szót ad be és kicsi kevés"). Cause: FB103 subtracted the WHOLE half-learned
// backlog from the daily budget, so one badge number carried two unrelated
// counters and the backlog (which grows by several words per session, and
// survives across days) ate the setting.
//
// The two rules are separate now:
//   * `newWordsLeftToday` = the visible daily countdown (monotone, -1 per word);
//   * `newWordIntake` = how many new words the QUEUE may carry, which is the
//     daily countdown unless the half-learned pile has grown past
//     `WIP_CEILING_FACTOR × (limit + bonus)`, at which point intake pauses so
//     nothing piles up ("ne rakjon be 5 új szót, mert akkor torlódik").
export const WIP_CEILING_FACTOR = 2;

export function newWordWipCeiling(limit: number, bonus: number): number {
  return WIP_CEILING_FACTOR * (limit + bonus);
}

export function newWordIntake({ limit, bonus, startedToday, unlearned = 0 }: NewWordAllowance): number {
  if (unlearned >= newWordWipCeiling(limit, bonus)) return 0;
  return newWordsLeftToday({ limit, bonus, startedToday });
}
