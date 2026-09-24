import type { Sm2Card, Sm2Grade } from './sm2';

// SZ2 (SZAVAK.md): a sor léptetése értékelés után és visszavonáskor, tesztelhetően.

// FB364 (PLAN-fb0923 5. lépés, D2): a rontott ("again") kártya eddig időzítő
// nélkül a sor VÉGÉRE ment, ezért sok új szó mögött sokára jött vissza.
// Mostantól kap egy `returnAt` időbélyeget (most + N s); a következő kártya
// kiválasztásakor (`reorderForReturn`) a lejárt returnAt-ú (vagy - ha nincs
// más kártya a sorban - a leghamarabb lejáró) rontott kártya jön előre,
// akármennyi új/esedékes szó áll a sorban. A "Knew it" (`good`) és a
// graduált kártyákra nincs időzítő (a régi append-a-végére viselkedés él).
export type QueuedSm2Card = Sm2Card & { returnAt?: number };

export const DEFAULT_AGAIN_DELAY_SEC = 60;
export const MIN_AGAIN_DELAY_SEC = 15;
export const MAX_AGAIN_DELAY_SEC = 300;
export const AGAIN_DELAY_STEP_SEC = 15;

/**
 * A sorban legfeljebb EGY rontott (returnAt-tal jelölt) kártyát emel a sor
 * elejére: a lejárt returnAt-ok közül a legrégebbit, vagy - ha a sorban a
 * jelölt kártyákon kívül más nincs - a leghamarabb lejárót (a tanuló ne
 * várjon feleslegesen). A többi kártya egymáshoz viszonyított sorrendje nem
 * változik.
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
 * Értékelés után: az első kártya kikerül; ha ma még esedékes (learning), a
 * sor végére kerül. `again` esetén a visszatért kártya `returnAt = now +
 * delaySec * 1000` jelölést kap; ezután `reorderForReturn` dönt, mikor kerül
 * elő (lehet a lejárat előtt is, ha nincs más kártya a sorban).
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
  if (next.due !== today) return rest;
  // A visszahozott kártya a `sm2Review` másolatában magával hozná a lejárt
  // returnAt-ját, és "Knew it" után azonnal újra a sor elejére ugrana
  // (4.1.0 web-smoke, 2026-09-24). Csak az `again` kap új időzítőt.
  const { returnAt: _stale, ...clean } = next as QueuedSm2Card;
  const entry: QueuedSm2Card = grade === 'again' ? { ...clean, returnAt: now + delaySec * 1000 } : clean;
  return reorderForReturn([...rest, entry], now);
}

/**
 * Visszavonás: az értékelt kártya BÁRHONNAN kikerül a sorból (itemId
 * szerint, nem pozíció szerint - a `reorderForReturn` a returnAt-jelölt
 * kártyát máshova mozgathatta), így nem marad árva időzítő; az értékelés
 * előtti állapot a sor ELEJÉRE kerül.
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

// FB352: kiemelve tiszta függvénybe, hogy a napi haladás (a header-sor és a
// csík) tab-váltás/app-újraindítás után is a perzisztált `lastReview`-ból
// számolt, valós napi számot mutassa, ne csak a (mountonként nullázódó)
// menet-számlálót.
export function countDoneToday(cards: Sm2Card[], today: string): number {
  return cards.filter((c) => c.lastReview === today).length;
}
