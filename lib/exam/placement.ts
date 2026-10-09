// The step of the adaptive placement test.
// Pure functions, no I/O: the caller (app/placement.tsx) supplies the answers one by one,
// the questions are built by lib/exam/placementQuestions.ts.
//
// Flow: it starts at A2, 5 questions per step. On a level, a result of 80% or more (4 out of 5)
// = up, 40% or less (2 out of 5) = down. The in-between result (3 out of 5) does not
// decide yet: the same level gets one more step, and the two steps together decide (8+ out of 10
// up, 4 or fewer down, in between it stops). It stops when it is decided between two adjacent levels,
// when there is no level above the top one or below the bottom one, or at 20
// questions. The suggested level is the highest level that was not failed.

import type { PcicLevel } from '@/data/pcic';

export const PLACEMENT_BLOCK = 5;
export const PLACEMENT_MAX_QUESTIONS = 20;
const PLACEMENT_START_LEVEL: PcicLevel = 'A2';
/** From this % on: "up" (4/5, 8/10). */
const PLACEMENT_PASS_PCT = 80;
/** Up to this %: "down" (2/5, 4/10). */
const PLACEMENT_FAIL_PCT = 40;
/** At most this many steps on one level (the in-between result repeats once). */
const PLACEMENT_MAX_BLOCKS_PER_LEVEL = 2;

export interface PlacementTally {
  asked: number;
  correct: number;
}

type PlacementVerdict = 'pass' | 'mixed' | 'fail';

export interface PlacementState {
  /** The measurable levels in ascending order (only those with data). */
  levels: PcicLevel[];
  current: PcicLevel;
  tallies: Partial<Record<PcicLevel, PlacementTally>>;
  /** Questions asked so far (the total is not shown to the user, because it depends on the answers). */
  asked: number;
  /** Questions answered so far on the current step (0..PLACEMENT_BLOCK-1). */
  blockAsked: number;
  done: boolean;
  /** The suggested starting level; only present after `done`. */
  placed: PcicLevel | null;
}

/** The initial state of the staircase. The starting level is A2, or if there is no data for it, the lowest measurable one. */
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

/** The highest measured level that was not failed; if all failed (or nothing is measured), the lowest level. */
export function placedLevel(state: Pick<PlacementState, 'levels' | 'tallies'>): PcicLevel {
  const ok = state.levels.filter((l) => state.tallies[l] && placementVerdict(state.tallies[l]) !== 'fail');
  return ok.length > 0 ? ok[ok.length - 1] : state.levels[0];
}

function settle(state: PlacementState): PlacementState {
  return { ...state, done: true, placed: placedLevel(state) };
}

/** Decides at the end of a step: stay (repeat), up, down, or stop. */
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
  // There is no further level in that direction, or the neighbour is already measured (we came from there): it is decided.
  if (!next || tallies[next]) return settle(state);
  return { ...state, current: next };
}

/** Records the result of a question; at the end of a step it also determines the next move. */
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

/** Early termination (e.g. the question pool ran out): it gives a suggestion from the measurements so far. */
export function placementFinish(state: PlacementState): PlacementState {
  return state.done ? state : settle(state);
}

/** The hits per level for the result screen (only the measured levels, in level order). */
export function placementBreakdown(state: Pick<PlacementState, 'levels' | 'tallies'>): { level: PcicLevel; correct: number; asked: number }[] {
  return state.levels.flatMap((level) => {
    const t = state.tallies[level];
    return t ? [{ level, correct: t.correct, asked: t.asked }] : [];
  });
}
