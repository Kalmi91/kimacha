import { pickSm2Session, type Sm2Card, type Sm2Grade } from './sm2';
import type { PcicKind } from '@/data/pcic';

// Advancing the queue after a rating and on undo, in a testable way.

// A missed ("again") card used to go to the END of the queue without a timer,
// so behind many new words it took a long time to come back.
// It now gets a `returnAt` timestamp (now + N s); when the next card is
// picked (`reorderForReturn`), the missed card with an expired returnAt (or, if there is no
// other card in the queue, the one expiring soonest) comes to the front,
// no matter how many new/due words are in the queue. "Knew it" (`good`) and
// graduated cards get no timer (the old append-to-the-end behavior applies).
export type QueuedSm2Card = Sm2Card & { returnAt?: number };

export const DEFAULT_AGAIN_DELAY_SEC = 60;
export const MIN_AGAIN_DELAY_SEC = 15;
export const MAX_AGAIN_DELAY_SEC = 300;
export const AGAIN_DELAY_STEP_SEC = 15;

/**
 * Moves at most ONE missed (returnAt-marked) card to the front of the
 * queue: the oldest of the expired returnAt cards, or - if the queue has nothing
 * but the marked cards - the one expiring soonest (so the learner does not
 * wait needlessly). The relative order of the other cards does not
 * change.
 */
export function reorderForReturn(queue: QueuedSm2Card[], now: number): QueuedSm2Card[] {
  if (queue.length <= 1) return queue;
  const flagged = queue
    .map((card, index) => ({ card, index }))
    .filter((entry) => entry.card.returnAt !== undefined);
  if (flagged.length === 0) return queue;

  const expired = flagged.filter((entry) => entry.card.returnAt! <= now);
  const pool = expired.length > 0 ? expired : flagged.length === queue.length ? flagged : [];
  if (pool.length === 0) return queue;

  const chosen = pool.reduce((oldest, entry) => (entry.card.returnAt! < oldest.card.returnAt! ? entry : oldest));
  if (chosen.index === 0) return queue;
  return [chosen.card, ...queue.filter((_, i) => i !== chosen.index)];
}

/**
 * After a rating: the first card is removed; if it is still due today (learning), it
 * goes to the end of the queue. On `again` the returned card gets the mark `returnAt = now +
 * delaySec * 1000`; `reorderForReturn` then decides when it comes
 * up (possibly before the deadline, if there is no other card in the queue).
 */
export function requeueAfterGrade(
  queue: QueuedSm2Card[],
  next: Sm2Card,
  today: string,
  grade: Sm2Grade = 'good',
  now: number = Date.now(),
  delaySec: number = DEFAULT_AGAIN_DELAY_SEC
): QueuedSm2Card[] {
  const rest = queue.slice(1);
  // FB535: a graduating card also lets an expired missed card back to the front (before, only a
  // card staying today did, so after right answers the missed new word waited for the queue's end).
  if (next.due !== today) return reorderForReturn(rest, now);
  // The returned card would carry its expired returnAt in the copy made by `sm2Review`,
  // and after "Knew it" it would immediately jump to the front of the queue again
  // (4.1.0 web smoke test, 2026-09-24). Only `again` gets a new timer.
  const { returnAt: _stale, ...clean } = next as QueuedSm2Card;
  const entry: QueuedSm2Card = grade === 'again' ? { ...clean, returnAt: now + delaySec * 1000 } : clean;
  return reorderForReturn([...rest, entry], now);
}

/**
 * Undo: the rated card is removed from the queue from ANYWHERE (by itemId,
 * not by position - `reorderForReturn` may have moved the returnAt-marked
 * card elsewhere), so no orphan timer is left; the pre-rating
 * state goes to the FRONT of the queue.
 */
export function requeueAfterUndo(
  queue: QueuedSm2Card[],
  before: Sm2Card,
  graded: Sm2Card,
  today: string
): QueuedSm2Card[] {
  const rest = graded.due === today ? queue.filter((c) => c.itemId !== graded.itemId) : queue;
  return [before, ...rest];
}

// FB535: the new words used to wait at the end of the queue, behind every review. Now, while
// reviews are left (a card not introduced today), exactly ONE new word is in the round: the next
// one comes in only after this one was typed right ("Knew it" graduates it, it leaves the queue);
// until then it rotates with the missed reviews. Once the reviews are done, the new words flow
// as before (several missed ones may rotate together).
const LEARNING_NEAR = 10;
const LEARNING_PULL_AT = 3;

function isReview(card: Sm2Card, today: string): boolean {
  return card.state !== 'new' && card.introducedAt !== today;
}

/**
 * The first new card goes right behind the next card (index 1, or stays at 0 if it is already up),
 * the other new cards wait behind every review; while a new word introduced today is still being
 * learned, all new cards wait. Without reviews left the queue is not touched.
 */
export function mixNewCards(queue: QueuedSm2Card[], today: string): QueuedSm2Card[] {
  if (!queue.some((c) => isReview(c, today))) return queue;
  const isMissedToday = (c: Sm2Card) => c.state === 'learning' && c.introducedAt === today;
  // FB636: a new word missed today and rebuilt without a timer (reload, level switch) sits behind every due
  // review; pull it to about index 3, in its order. One with a timer is left to reorderForReturn.
  let base = queue;
  const far = queue.filter((c, i) => i >= LEARNING_PULL_AT && isMissedToday(c) && c.returnAt === undefined);
  if (far.length > 0) {
    const others = queue.filter((c) => !far.includes(c));
    base = [...others.slice(0, LEARNING_PULL_AT), ...far, ...others.slice(LEARNING_PULL_AT)];
  }
  const fresh = base.filter((c) => c.state === 'new');
  if (fresh.length === 0) return base;
  const rest = base.filter((c) => c.state !== 'new');
  // A missed new word near the front blocks the next new one (one at a time); so do 2 or more anywhere, so
  // missed words cannot pile up. One far back with a timer does not hold all new words for hundreds of cards.
  if (rest.slice(0, LEARNING_NEAR).some(isMissedToday) || rest.filter(isMissedToday).length >= 2) return [...rest, ...fresh];
  const [first, ...later] = fresh;
  const at = base[0] === first ? 0 : 1;
  return [...rest.slice(0, at), first, ...rest.slice(at), ...later];
}

/** FB535: the daily new-word budget ran out while reviews are left (reviews in the queue, no new word in it). */
export function needsNewTopUp(queue: Sm2Card[], today: string): boolean {
  return queue.some((c) => isReview(c, today)) && !queue.some((c) => c.state === 'new');
}

/**
 * FB542: the "+N" answer to the more-new-words question (needsNewTopUp): the new cards to append and the
 * bonus to persist, the same budget step as the "+N" buttons of the done screen (nextPcicNewBonus). Null when
 * no top-up is due or the level has no new word left.
 */
export function newTopUp(
  queue: Sm2Card[],
  cards: Sm2Card[],
  order: string[],
  today: string,
  budget: { limit: number; bonus: number; introducedAllLevels: number; introducedThisLevel: number },
  step: number = PCIC_NEW_BONUS_STEP
): { bonus: number; fresh: Sm2Card[] } | null {
  if (!needsNewTopUp(queue, today)) return null;
  const { limit, bonus, introducedAllLevels, introducedThisLevel } = budget;
  const next = nextPcicNewBonus({ limit, bonus, introducedToday: introducedAllLevels }, step);
  const inQueue = new Set(queue.map((c) => c.itemId));
  const fresh = pickSm2Session(cards, order, today, pcicSessionNewLimit({ limit, bonus: next, introducedAllLevels, introducedThisLevel })).filter(
    (c) => c.state === 'new' && !inQueue.has(c.itemId)
  );
  return fresh.length > 0 ? { bonus: next, fresh } : null;
}

/**
 * FB542: the learner is asked (instead of getting +10 by itself) when the budget ran out while reviews are
 * left, the level still has new words to offer, and "No, only reviews" was not answered today
 * (`declinedDay` is the day of that answer, '' when never; a new calendar day asks again).
 */
export function shouldAskMoreNew(
  queue: Sm2Card[],
  cards: Sm2Card[],
  order: string[],
  today: string,
  budget: { limit: number; bonus: number; introducedAllLevels: number; introducedThisLevel: number },
  declinedDay: string
): boolean {
  return declinedDay !== today && newTopUp(queue, cards, order, today, budget) !== null;
}

// Extracted into a pure function so that the daily progress (the header row and the
// bar) shows the real daily count computed from the persisted `lastReview`, even after a
// tab switch/app restart, not just the session counter (which resets on
// every mount).
export function countDoneToday(cards: Sm2Card[], today: string): number {
  return cards.filter((c) => c.lastReview === today).length;
}

export const PCIC_NEW_BONUS_STEP = 10;
// the +5 / +10 / +15 new word buttons of the "done for today" screen.
export const PCIC_NEW_BONUS_STEPS = [5, 10, 15] as const;

interface PcicNewBudgetInput {
  limit: number; // daily new-word budget from Settings (daily_new_limit)
  bonus: number; // bonus persisted for today (learn_settings.new_bonus, only if new_bonus_date === today)
  introducedToday: number; // number of cards introduced today (introducedAt === today)
}

/**
 * The "+10 new words" bonus used to live only in React state
 * (`extraNew`), which `load()` reset on every focus change/new day,
 * AND it added a flat +10 to the daily budget regardless of how many words had
 * already been introduced today. So (limit 10, 18 introduced today) the "+10" gave 2 new cards
 * (10+10-18), not 10. This is the next bonus value: it will be that much MORE
 * than the number already introduced today, plus the step (default 10).
 */
export function nextPcicNewBonus(
  { limit, bonus, introducedToday }: PcicNewBudgetInput,
  step: number = PCIC_NEW_BONUS_STEP
): number {
  return Math.max(bonus, introducedToday - limit) + step;
}

/**
 * The value to pass as the `newLimit` parameter of `pickSm2Session`: the budget plus the bonus
 * persisted for today, but never less than the number already introduced today
 * (`pickSm2Session` subtracts `introducedToday` from it, so if
 * this were already below `introducedToday`, 0 would come out instead of a negative budget
 * prematurely). On a day change the caller gets a 0 bonus from the DB (the
 * `new_bonus_date` is not today), so this function by itself does not know about the
 * calendar day - the `getPcicNewBonus(today)` DB call decides that.
 */
export function pcicNewBudget({ limit, bonus, introducedToday }: PcicNewBudgetInput): number {
  return Math.max(introducedToday, limit + bonus);
}

/**
 * The daily new-word budget and the +N bonus are DAILY values (one row in
 * learn_settings), but the caller counted the cards introduced today at the view level.
 * If the learner asked for "+10" three times on A1, then switched to A2,
 * there the full bonus budget (limit + bonus) came back as new words even with
 * 0 words of that level introduced today. The value for the newLimit parameter of pickSm2Session: the daily budget
 * reduced by the cards introduced today on EVERY level; the ones introduced at the view's level are
 * subtracted by pickSm2Session itself, so we add those back here. For a single level
 * (all === this) it is the same as pcicNewBudget.
 */
export function pcicSessionNewLimit({
  limit,
  bonus,
  introducedAllLevels,
  introducedThisLevel,
}: {
  limit: number;
  bonus: number;
  introducedAllLevels: number;
  introducedThisLevel: number;
}): number {
  const budget = pcicNewBudget({ limit, bonus, introducedToday: introducedAllLevels });
  return budget - (introducedAllLevels - introducedThisLevel);
}

/**
 * The level picker's exam row shows how many words are missing for the unlock ("N to go"), but the "Practice words" button gave nothing
 * once the daily budget was used up. If today's budget (limit + bonus) is already spent, the button gives ALL the missing new words of the level in one
 * tap ("all at once"); if there is budget left, it does not extend (the usual daily
 * batch comes). The returned value is the requested bonus step (0 = no extension).
 */
export function practiceTopUpStep({
  limit,
  bonus,
  introducedAllLevels,
  missing,
}: {
  limit: number;
  bonus: number;
  introducedAllLevels: number;
  missing: number;
}): number {
  if (missing <= 0 || limit + bonus > introducedAllLevels) return 0;
  return missing;
}

// The daily budget counts EVERY card
// (word, phrase, sentence, chain member), as before - this does not change. What was missing:
// the header did not show WHAT today's introductions consist of, so with a budget of 10 the
// "only 6 or 8 came" confusion arose (the rest went to the other kind, or
// was already introduced earlier in this day's round). This is the breakdown: `word` = kind
// word/phrase/pattern, `sentence` = kind sentence (chain sentences fall here too,
// because a chain member is the same `sentence`-kind PcicItem as any other sentence).
interface TodayIntroducedByKind {
  words: number;
  sentences: number;
}

export function countIntroducedTodayByKind(
  cards: Sm2Card[],
  today: string,
  kindOf: (itemId: string) => PcicKind | undefined
): TodayIntroducedByKind {
  let words = 0;
  let sentences = 0;
  for (const card of cards) {
    if (card.introducedAt !== today) continue;
    if (kindOf(card.itemId) === 'sentence') sentences++;
    else words++; // word / phrase / pattern / unknown -> word bucket
  }
  return { words, sentences };
}

// In the order of new cards to introduce, between two
// sentences (or groups, which count as ONE unit per `groupOf`) there must be
// at least `minGap` non-sentence cards ("max 1 sentence per 10
// cards"). Whatever would come too early is left out of THIS call (it is not moved to the end of the queue
// but dropped): the
// next queue build (load()/handleMoreNew()) re-checks it, because by then
// other cards have been introduced too.
export function thinSentences(
  orderedIds: string[],
  kindOf: (id: string) => PcicKind | undefined,
  groupOf: (id: string) => string,
  minGap: number = 9
): string[] {
  const result: string[] = [];
  let sinceLastGroup = minGap; // the first sentence group can go without waiting
  let activeGroup: string | null = null;
  for (const id of orderedIds) {
    if (kindOf(id) !== 'sentence') {
      result.push(id);
      sinceLastGroup++;
      continue;
    }
    const group = groupOf(id);
    if (group === activeGroup || sinceLastGroup >= minGap) {
      result.push(id);
      if (group !== activeGroup) {
        activeGroup = group;
        sinceLastGroup = 0;
      }
    }
    // else: it would come too early, so it is left out of this call.
  }
  return result;
}

// SRS rows whose id is not in the loaded corpus (data/pcic.ts) have no card to show. This
// filter skips them before the session is built, so the deck does not get stuck on an
// empty/unrevealable card.
export function dropOrphanCards(cards: Sm2Card[], itemExists: (id: string) => boolean): Sm2Card[] {
  return cards.filter((c) => itemExists(c.itemId));
}

// The black bar at the top should count how much of the deck is left and when it
// finishes; the old 10-card set bar restarted at every 10th card, so it was unclear what it counted.
// The bar now shows the remainder of TODAY's batch: empty at the first card, full at the last card of the day,
// and it does not restart mid-batch. A "finished" card = rated today and no longer in the queue
// (an "again" card stays in the queue, so it is not finished yet and the batch size does not fluctuate).
// The "+10 new words" extension grows the queue, so the bar measures against the new full batch.
export function countFinishedToday(cards: Sm2Card[], queue: Sm2Card[], today: string): number {
  const inQueue = new Set(queue.map((c) => c.itemId));
  return cards.filter((c) => c.lastReview === today && !inQueue.has(c.itemId)).length;
}

// The "+N new words" extension starts a new batch, but
// `countFinishedToday` counts the finished cards of the whole day, so after +N the bar did not start from 0
// but from e.g. 78% (the day's finished cards so far also counted as "finished" in the new batch).
// On extension the caller stores the number of already finished cards (batchBase), and relative to it the bar
// measures the progress of the NEW batch: empty at the first new card, full at the last.
export function finishedInBatch(finishedToday: number, batchBase: number): number {
  return Math.max(0, finishedToday - batchBase);
}

export function dayProgressPercent(finished: number, remaining: number): number {
  const total = finished + remaining;
  if (total <= 1) return remaining === 0 && finished > 0 ? 100 : 0;
  return Math.min(100, (finished / (total - 1)) * 100);
}
