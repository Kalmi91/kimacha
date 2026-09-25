import type { Sm2Card, Sm2Grade } from './sm2';
import type { PcicKind } from '@/data/pcic';

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

export const PCIC_NEW_BONUS_STEP = 10;

export interface PcicNewBudgetInput {
  limit: number; // a Beállítások napi új-szó kerete (daily_new_limit)
  bonus: number; // a mai napra perzisztált bónusz (learn_settings.new_bonus, csak ha new_bonus_date === ma)
  introducedToday: number; // a ma bevezetett (introducedAt === ma) kártyák száma
}

/**
 * FB385/386: a "+10 új szó" bónusz eddig csak React-state-ben élt
 * (`extraNew`), amit a `load()` minden fókusz-váltásnál/új napon nullázott,
 * ÉS a flat +10-et adta a napi kerethez, függetlenül attól, hány szó lett
 * már bevezetve ma. Emiatt (limit 10, ma bevezetve 18) a "+10" 2 új kártyát
 * adott (10+10-18), nem 10-et. Ez a következő bónusz-érték: annyival TÖBB
 * lesz, mint amennyi ma már be van vezetve, plusz a lépés (alap 10).
 */
export function nextPcicNewBonus(
  { limit, bonus, introducedToday }: PcicNewBudgetInput,
  step: number = PCIC_NEW_BONUS_STEP
): number {
  return Math.max(bonus, introducedToday - limit) + step;
}

/**
 * A `pickSm2Session` `newLimit` paraméterének adandó érték: a keret + a mai
 * napra perzisztált bónusz, de sosem kevesebb, mint amennyi ma már be van
 * vezetve (a `pickSm2Session` ebből vonja ki `introducedToday`-t, tehát ha
 * ez itt már `introducedToday` alatt lenne, negatív keret helyett 0 jönne ki
 * idő előtt). Nap-váltáskor a hívó oldal a DB-től 0 bónuszt kap (a
 * `new_bonus_date` nem a mai), tehát ez a függvény önmagában nem tud a
 * naptári napról - azt a `getPcicNewBonus(today)` DB-hívás dönti el.
 */
export function pcicNewBudget({ limit, bonus, introducedToday }: PcicNewBudgetInput): number {
  return Math.max(introducedToday, limit + bonus);
}

// FB387/395 (PLAN-fb0924 1b. lépés, D2 = b): a napi keret MINDEN kártyát számol
// (szó, kifejezés, mondat, lánc-tag), ahogy eddig - ez nem változik. Ami hiányzott:
// a fejléc nem mutatta meg, MIBŐL áll a mai bevezetés, ezért egy 10-es keretnél a
// "csak 6 vagy 8 jött" zavarba fulladt (a maradék a másik fajtára ment el, vagy
// korábban ebben a napi körben már bevezetődött). Ez a felbontás, `word` = kind
// word/phrase/pattern, `sentence` = kind sentence (a lánc-mondatok is ide esnek,
// mert egy lánc-tag ugyanolyan `sentence` kind-ú PcicItem, mint bármely más mondat).
export interface TodayIntroducedByKind {
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
    else words++; // word / phrase / pattern / ismeretlen -> szó-vödör
  }
  return { words, sentences };
}

// PLAN-fb0924 7b. lépés (FB384): a szintek közti duplikátum-egyesítéskor
// (lib/db/migrations.ts applyPcicDedup) ha MINDKÉT oldalon (a törölt és a
// megmaradó item-id-n is) van SRS-haladás, az "erősebb" oldal nyer: több
// sikeres ismétlés (reps - lapses), holtversenyben nagyobb interval, végül
// a korábbi esedékesség (hogy az ismétlés ne csússzon ki). A `cardMerge.ts`
// pickSurvivor-jának Sm2Card-megfelelője (az ottani `stability` mező itt
// nincs, az FSRS-only `cards` táblára épült).
// PLAN-fb0924 8. lépés (FB394/396): a bevezetendő új kártyák (a lánc-
// átrendezés, lib/pcicChains.ts applyChainOrder, UTÁN futó) sorrendjében két
// mondat (vagy lánc, ami `groupOf` szerint EGY egységnek számít) közt
// legalább `minGap` nem-mondat kártyának kell lennie ("10 kártyánként max 1
// mondat"). Ami idő előtt jönne, EBBŐL a hívásból kimarad (nem a sor végére
// kerül, hanem eldobódik - mint az applyChainOrder `excluded` halmaza): a
// következő sor-építés (load()/handleMoreNew()) újra megvizsgálja, mert addigra
// már más kártyák is bevezetődtek. Az "A1+"/"A2+" (csak mondatot tartalmazó)
// szinten NEM hívandó (ott minden ritkítás mindent kidobna).
export function thinSentences(
  orderedIds: string[],
  kindOf: (id: string) => PcicKind | undefined,
  groupOf: (id: string) => string,
  minGap: number = 9
): string[] {
  const result: string[] = [];
  let sinceLastGroup = minGap; // az első mondat-csoport várakozás nélkül mehet
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
    // else: idő előtt jönne, ebből a hívásból kimarad.
  }
  return result;
}

export function pickStrongerSm2Card(a: Sm2Card, b: Sm2Card): Sm2Card {
  const aSuccess = a.reps - a.lapses;
  const bSuccess = b.reps - b.lapses;
  if (aSuccess !== bSuccess) return aSuccess > bSuccess ? a : b;
  if (a.interval !== b.interval) return a.interval > b.interval ? a : b;
  return a.due <= b.due ? a : b;
}
