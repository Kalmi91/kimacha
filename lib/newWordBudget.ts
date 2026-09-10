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
  /**
   * FB210, Kálmán 2026-09-09 (word:mind): „csak akkor legyen a számláló kevesebb,
   * meg akkor jelölje megtanultnak a szót, ha le is tudom írni helyesen", és
   * 2026-09-10-én kimondta, hogy a 🌱 napi számlálóra is ez vonatkozzon.
   * Ezért a keretet nem az ELKEZDETT, hanem a MEGTANULT szavak fogyasztják:
   * megtanult = a létra végigjárva, a gépelős lap is jó volt
   * (lib/wordPhase.ts isLearned).
   */
  learnedToday: number;
  /** Elkezdett, de még meg nem tanult szavak: ennyi van „kézben". */
  unlearned?: number;
}

export function newWordsLeftToday({ limit, bonus, learnedToday }: NewWordAllowance): number {
  return Math.max(0, limit + bonus - learnedToday);
}

// FB112/FB113/FB114/FB115, Kálmán 2026-08-09/10: the badge jumped ("9 ből
// hirtelen 0 lett nem így egyesével fogyott", "megint 5 ből egy lett"), and the
// intake stayed at 5 however high the Settings limit was ("egyszerre mindig 5
// szót ad be és kicsi kevés"). Cause: FB103 subtracted the WHOLE half-learned
// backlog from the daily budget, so one badge number carried two unrelated
// counters and the backlog (which grows by several words per session, and
// survives across days) ate the setting.
//
// The two rules stay separate, and FB210 gave each a clean meaning:
//   * `newWordsLeftToday` = the visible badge: how many new words are still to be
//     LEARNED today (it falls when a word is spelled right, not when it is met);
//   * `newWordIntake` = how many new words the QUEUE may hand out now, which is
//     the badge minus the words already in hand and not yet learned. So the day's
//     total new words stays at `limit + bonus` however the session goes, and no
//     pile builds up ("ne rakjon be 5 új szót, mert akkor torlódik").
export function newWordIntake({ limit, bonus, learnedToday, unlearned = 0 }: NewWordAllowance): number {
  const left = newWordsLeftToday({ limit, bonus, learnedToday });
  const inHand = Math.max(0, left - Math.max(0, unlearned));
  // FB140/FB142, Kálmán 2026-08-18: "5 új szóra kattintottak az A0 szinten és nem
  // dobott fel többet hanem újra feldobta", "már rég óta 0 új szót ír de mintha
  // újra és újra régi szavakat bedobna ismétlésre ... újakat nem tanulok ami
  // viszont baj". A "+N új szó" tap is an explicit demand: it delivers even when
  // the half-learned pile would otherwise hold everything back. The standing
  // limit still waits for that pile to clear.
  return Math.max(inHand, Math.min(left, bonus));
}

// FB226, Kálmán 2026-09-10: „azt is akarom, hogy az új szavak abból a szintből
// jöjjenek ahol éppen állok. Ha nincsen benne új szó akkor jelöljön 0 át." A napi
// keret az egész tanulásra szól, a 🌱 jelvény viszont azt ígéri, hogy MOST kap
// annyi új szót; ha a szinten már nincs el nem kezdett szó, az ígéret hamis.
// Az ismétlés ettől független: az továbbra is átjár a szintek között (FB225).
export function badgeNewWordsLeft(allowance: NewWordAllowance, levelNewWords: number): number {
  return Math.min(newWordsLeftToday(allowance), Math.max(0, levelNewWords));
}

export type NewWordPause = 'none' | 'congested' | 'daily-limit';

// Why the queue is not taking new words, for the screens that have to explain it
// (FB141: the learner read the empty queue as "az a0 szint bugos").
export function newWordPauseReason(allowance: NewWordAllowance): NewWordPause {
  if (newWordIntake(allowance) > 0) return 'none';
  if (newWordsLeftToday(allowance) <= 0) return 'daily-limit';
  return 'congested';
}
