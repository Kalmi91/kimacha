// SM-2 (Anki-style) scheduler for the PCIC tab. Completely
// independent of the existing FSRS `cards` table/`lib/sessionQueue.ts` scheduler,
// only es→en items go through here. Pure functions, no I/O; the DB caller
// side (lib/database.ts / lib/database.web.ts) stores the `Sm2Card`s.

export type Sm2Grade = 'again' | 'hard' | 'good' | 'easy';
export type Sm2State = 'new' | 'learning' | 'review';

export interface Sm2Card {
  itemId: string; // PCIC item id, e.g. "b1-0184"
  state: Sm2State;
  step: number; // index of the learning step (0..), only meaningful in the learning state
  ease: number; // starts at 2.5, floor 1.3
  interval: number; // in days, in the review state
  reps: number;
  lapses: number;
  due: string; // 'YYYY-MM-DD', an empty string for a new card
  lastReview: string | null;
  introducedAt: string | null; // on which day it was first asked
  known?: boolean; // the learner marked it as "known" by hand; rare check, counted as known in the statistics
}

// one correct answer is enough to graduate (the earlier 2 steps
// were annoying, the same word had to be written correctly twice). A "good" takes the card
// from the learning state straight to review (interval =
// GRADUATE_INTERVAL_DAYS); "again" still goes back to the end of the round
// (see pickSm2Session), and graduates from there the same way with one good answer.
export const LEARNING_STEPS = 1;
const EASE_FLOOR = 1.3;
const DEFAULT_EASE = 2.5;
const GRADUATE_INTERVAL_DAYS = 1;
const EASY_LEARNING_INTERVAL_DAYS = 4;
export const DEFAULT_NEW_LIMIT = 20;
export const KNOWN_INTERVAL_DAYS = 60;

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const da = new Date(ay, am - 1, ad).getTime();
  const db = new Date(by, bm - 1, bd).getTime();
  return Math.round((db - da) / 86400000);
}

export function sm2NewCard(itemId: string): Sm2Card {
  return {
    itemId,
    state: 'new',
    step: 0,
    ease: DEFAULT_EASE,
    interval: 0,
    reps: 0,
    lapses: 0,
    due: '',
    lastReview: null,
    introducedAt: null,
  };
}

export function sm2Review(card: Sm2Card, grade: Sm2Grade, today: string): Sm2Card {
  const next: Sm2Card = { ...card, reps: card.reps + 1, lastReview: today };

  if (card.state === 'new' || card.state === 'learning') {
    switch (grade) {
      case 'again':
        next.state = 'learning';
        next.step = 0;
        next.due = today;
        break;
      case 'hard':
        next.state = 'learning';
        next.step = card.step;
        next.due = today;
        break;
      case 'good': {
        const step = card.step + 1;
        if (step >= LEARNING_STEPS) {
          next.state = 'review';
          next.step = 0;
          next.interval = GRADUATE_INTERVAL_DAYS;
          next.due = addDays(today, GRADUATE_INTERVAL_DAYS);
        } else {
          next.state = 'learning';
          next.step = step;
          next.due = today;
        }
        break;
      }
      case 'easy':
        next.state = 'review';
        next.step = 0;
        next.interval = EASY_LEARNING_INTERVAL_DAYS;
        next.due = addDays(today, EASY_LEARNING_INTERVAL_DAYS);
        break;
    }
    if (card.state === 'new') {
      next.introducedAt = card.introducedAt ?? today;
    }
    return next;
  }

  // review state
  switch (grade) {
    case 'again':
      next.lapses = card.lapses + 1;
      next.ease = Math.max(EASE_FLOOR, card.ease - 0.2);
      next.state = 'learning';
      next.step = 0;
      next.due = today;
      break;
    case 'hard': {
      const interval = Math.max(card.interval + 1, Math.round(card.interval * 1.2));
      next.interval = interval;
      next.ease = Math.max(EASE_FLOOR, card.ease - 0.15);
      next.due = addDays(today, interval);
      break;
    }
    case 'good': {
      const interval = Math.max(card.interval + 1, Math.round(card.interval * card.ease));
      next.interval = interval;
      next.due = addDays(today, interval);
      break;
    }
    case 'easy': {
      const interval = Math.max(card.interval + 1, Math.round(card.interval * card.ease * 1.3));
      next.interval = interval;
      next.ease = Math.max(EASE_FLOOR, card.ease + 0.15);
      next.due = addDays(today, interval);
      break;
    }
  }
  return next;
}

// Interval preview of all 4 buttons in days (0 = still today); it calls sm2Review
// hypothetically for every grade, so the number can never drift from the
// actual scheduling. The label (i18n) is formatted by the caller side.
export function sm2PreviewDays(card: Sm2Card, today: string): Record<Sm2Grade, number> {
  const grades: Sm2Grade[] = ['again', 'hard', 'good', 'easy'];
  const days = {} as Record<Sm2Grade, number>;
  for (const grade of grades) {
    const next = sm2Review(card, grade, today);
    days[grade] = next.due === today ? 0 : daysBetween(today, next.due);
  }
  return days;
}

// Order: (1) due review cards, ascending by due; (2) learning cards
// (due <= today); (3) new cards in newOrder (file order), at most
// newLimit − (number of new cards already introduced today). Reviews are unlimited, the daily
// budget only limits the introduction of new cards.
export function pickSm2Session(
  cards: Sm2Card[],
  newOrder: string[],
  today: string,
  newLimit: number = DEFAULT_NEW_LIMIT
): Sm2Card[] {
  const byId = new Map(cards.map(c => [c.itemId, c]));

  const dueReview = cards
    .filter(c => c.state === 'review' && c.due <= today)
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));

  const learning = cards.filter(c => c.state === 'learning' && c.due <= today);

  const introducedToday = cards.filter(c => c.introducedAt === today).length;
  const newBudget = Math.max(0, newLimit - introducedToday);

  const newCards: Sm2Card[] = [];
  for (const itemId of newOrder) {
    if (newCards.length >= newBudget) break;
    const existing = byId.get(itemId);
    if (existing && existing.state !== 'new') continue; // already learning/review, listed elsewhere
    newCards.push(existing ?? sm2NewCard(itemId));
  }

  return [...dueReview, ...learning, ...newCards];
}

/** The word counts as known,
 *  but still comes back for a check rarely (KNOWN_INTERVAL_DAYS). Ease untouched. */
export function sm2MarkKnown(card: Sm2Card, today: string): Sm2Card {
  return {
    ...card,
    state: 'review',
    step: 0,
    interval: KNOWN_INTERVAL_DAYS,
    due: addDays(today, KNOWN_INTERVAL_DAYS),
    lastReview: today,
    introducedAt: card.introducedAt ?? today,
    known: true,
  };
}
