// PLAN-pcic 4. lépés: SM-2 (Anki-módszerű) ütemező a PCIC fülhöz. Teljesen
// független a meglévő FSRS `cards` tábla/`lib/sessionQueue.ts` ütemezőtől,
// itt csak es→en tételek forognak. Tiszta függvények, I/O nélkül; a DB-hívó
// oldal (lib/database.ts / lib/database.web.ts) tárolja a `Sm2Card`-okat.

export type Sm2Grade = 'again' | 'hard' | 'good' | 'easy';
export type Sm2State = 'new' | 'learning' | 'review';

export interface Sm2Card {
  itemId: string; // PCIC tétel id, pl. "b1-0184"
  state: Sm2State;
  step: number; // learning lépés indexe (0..), csak learning állapotban értelmes
  ease: number; // 2.5-ről indul, padló 1.3
  interval: number; // napokban, review állapotban
  reps: number;
  lapses: number;
  due: string; // 'YYYY-MM-DD', new kártyánál üres string
  lastReview: string | null;
  introducedAt: string | null; // melyik napon lett először kérdezve
  known?: boolean; // SZ3: Kálmán kézzel »tudott«-nak jelölte; ritka ellenőrzés, a statisztikában ismert
}

// Anki alapértékek: 2 learning lépés, mindkettő ugyanabban a menetben kerül
// újra elő (percben itt nem mérünk, a menetsor végére kerül a "step" logika
// helyett a hívó oldal sorrendjén múlik, lásd pickSm2Session).
const LEARNING_STEPS = 2;
const EASE_FLOOR = 1.3;
export const DEFAULT_EASE = 2.5;
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

  // review állapot
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

// Mind a 4 gomb címkéje Anki-módra ("<1 nap", "1 nap", "4 nap" stb.), a
// sm2Review-t hívja meg hipotetikusan minden grade-re, hogy a szám sose
// csúszhasson el a tényleges ütemezéstől.
export function sm2Preview(card: Sm2Card, today: string): Record<Sm2Grade, string> {
  const grades: Sm2Grade[] = ['again', 'hard', 'good', 'easy'];
  const labels = {} as Record<Sm2Grade, string>;
  for (const grade of grades) {
    const next = sm2Review(card, grade, today);
    if (next.due === today) {
      labels[grade] = '<1 nap';
    } else {
      labels[grade] = `${daysBetween(today, next.due)} nap`;
    }
  }
  return labels;
}

// Sorrend: (1) esedékes review, due szerint növekvő; (2) learning kártyák
// (due <= today); (3) új kártyák a newOrder (fájl-sorrend) szerint, legfeljebb
// newLimit − (ma már bevezetett új kártyák száma). Review korlátlan, a napi
// keret csak az új kártyák bevezetését korlátozza.
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
    if (existing && existing.state !== 'new') continue; // már learning/review, máshol szerepel
    newCards.push(existing ?? sm2NewCard(itemId));
  }

  return [...dueReview, ...learning, ...newCards];
}

/** SZ3 (SZAVAK.md, Kálmán döntése 2026-09-18, (b) változat): a szó ismertnek számít,
 *  ritkán (KNOWN_INTERVAL_DAYS) mégis visszajön ellenőrzésre. Ease érintetlen. */
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
