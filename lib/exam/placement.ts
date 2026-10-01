// PLAN-vizsga C. szakasz (Kálmán, 2026-10-01, C4 a): az adaptív szintfelmérő lépcsője.
// Tiszta függvények, I/O nélkül: a hívó (app/placement.tsx) a válaszokat egyenként adja,
// a kérdéseket a lib/exam/placementQuestions.ts építi.
//
// Menete: A2-ről indul, lépcsőnként 5 kérdés. Egy szinten a találat 80% fölött (5-ből 4)
// = feljebb, 40% alatt vagy annyi (5-ből 2) = lejjebb. A köztes eredmény (5-ből 3) még
// nem dönt: ugyanazon a szinten kap még egy lépcsőt, a két lépcső együtt dönt (10-ből 8+
// feljebb, 4- lejjebb, a köztes már megáll). Megáll, ha eldőlt két szomszédos szint
// között, ha a legfelső szintről nincs feljebb, a legalsóról nincs lejjebb, vagy 20
// kérdésnél. A javasolt szint a legmagasabb nem megbukott szint.

import type { PcicLevel } from '@/data/pcic';

export const PLACEMENT_BLOCK = 5;
export const PLACEMENT_MAX_QUESTIONS = 20;
export const PLACEMENT_START_LEVEL: PcicLevel = 'A2';
/** Ennyi %-tól "feljebb" (4/5, 8/10). */
export const PLACEMENT_PASS_PCT = 80;
/** Ennyi %-ig "lejjebb" (2/5, 4/10). */
export const PLACEMENT_FAIL_PCT = 40;
/** Egy szinten legfeljebb ennyi lépcső (a köztes eredmény egyszer ismétel). */
export const PLACEMENT_MAX_BLOCKS_PER_LEVEL = 2;

export interface PlacementTally {
  asked: number;
  correct: number;
}

export type PlacementVerdict = 'pass' | 'mixed' | 'fail';

export interface PlacementState {
  /** A mérhető szintek növekvő sorrendben (csak amihez van adat). */
  levels: PcicLevel[];
  current: PcicLevel;
  tallies: Partial<Record<PcicLevel, PlacementTally>>;
  /** Eddig feltett kérdések (a végösszeg nem látszik a felhasználónak, mert a válaszoktól függ). */
  asked: number;
  /** A jelenlegi lépcsőn eddig megválaszolt kérdések (0..PLACEMENT_BLOCK-1). */
  blockAsked: number;
  done: boolean;
  /** A javasolt kezdő szint; csak `done` után van. */
  placed: PcicLevel | null;
}

/** A lépcső kezdőállapota. A kezdő szint az A2, ha nincs rá adat, akkor a legalsó mérhető. */
export function placementStart(levels: PcicLevel[]): PlacementState {
  const current = levels.includes(PLACEMENT_START_LEVEL) ? PLACEMENT_START_LEVEL : levels[0];
  return { levels, current, tallies: {}, asked: 0, blockAsked: 0, done: levels.length === 0, placed: null };
}

export function placementVerdict(tally: PlacementTally | undefined): PlacementVerdict {
  if (!tally || tally.asked === 0) return 'mixed';
  const pct = (tally.correct / tally.asked) * 100;
  if (pct >= PLACEMENT_PASS_PCT) return 'pass';
  if (pct <= PLACEMENT_FAIL_PCT) return 'fail';
  return 'mixed';
}

/** A legmagasabb nem megbukott mért szint; ha mind megbukott (vagy semmi nincs mérve), a legalsó szint. */
export function placedLevel(state: Pick<PlacementState, 'levels' | 'tallies'>): PcicLevel {
  const ok = state.levels.filter((l) => state.tallies[l] && placementVerdict(state.tallies[l]) !== 'fail');
  return ok.length > 0 ? ok[ok.length - 1] : state.levels[0];
}

function settle(state: PlacementState): PlacementState {
  return { ...state, done: true, placed: placedLevel(state) };
}

/** Egy lépcső végén dönt: marad (ismétel), feljebb, lejjebb, vagy megáll. */
function decide(state: PlacementState): PlacementState {
  const { levels, current, tallies } = state;
  if (state.asked >= PLACEMENT_MAX_QUESTIONS) return settle(state);
  const tally = tallies[current];
  const verdict = placementVerdict(tally);
  const at = levels.indexOf(current);
  if (verdict === 'mixed') {
    return (tally?.asked ?? 0) < PLACEMENT_BLOCK * PLACEMENT_MAX_BLOCKS_PER_LEVEL ? state : settle(state);
  }
  const next = levels[verdict === 'pass' ? at + 1 : at - 1];
  // Nincs több szint arra, vagy a szomszéd már le van mérve (onnan jöttünk): eldőlt.
  if (!next || tallies[next]) return settle(state);
  return { ...state, current: next };
}

/** Rögzíti egy kérdés eredményét; a lépcső végén a következő lépést is meghatározza. */
export function placementAnswer(state: PlacementState, correct: boolean): PlacementState {
  if (state.done) return state;
  const prev = state.tallies[state.current] ?? { asked: 0, correct: 0 };
  const next: PlacementState = {
    ...state,
    tallies: { ...state.tallies, [state.current]: { asked: prev.asked + 1, correct: prev.correct + (correct ? 1 : 0) } },
    asked: state.asked + 1,
    blockAsked: state.blockAsked + 1,
  };
  if (next.blockAsked < PLACEMENT_BLOCK) return next;
  return decide({ ...next, blockAsked: 0 });
}

/** Idő előtti lezárás (pl. elfogyott a kérdés-készlet): az eddigi mérésből ad javaslatot. */
export function placementFinish(state: PlacementState): PlacementState {
  return state.done ? state : settle(state);
}

/** Szintenként a találat az eredmény-képernyőhöz (csak a mért szintek, a szintek sorrendjében). */
export function placementBreakdown(state: Pick<PlacementState, 'levels' | 'tallies'>): { level: PcicLevel; correct: number; asked: number }[] {
  return state.levels.flatMap((level) => {
    const t = state.tallies[level];
    return t ? [{ level, correct: t.correct, asked: t.asked }] : [];
  });
}
