// PLAN-play 13. lépés (s6, Kálmán 2026-09-23, jóváhagyó lap
// https://claude.ai/artifact/HsKKPddM4KKt7wBQZmLVNo): "the words in the
// lesson's tables should be repeatable, same UI as the PCIC card, one pass
// through every word, then it resets; a wrong answer comes back a minute
// later like Anki". This module is the pure logic: which table cells count
// (conjugation tables only, decision (a): the reference GridTables are NOT
// included), the Anki-style scheduling (once right -> done, once wrong ->
// due again in 60s, "learn ahead" shows the soonest wrong cell if nothing
// else is due), and the reset once every cell has been answered right once.
//
// The UI (app/grammar/deck/[topic].tsx) owns rendering and persistence; this
// file only computes state, given an explicit `now`, so it is testable
// without timers.

import type { GrammarTopicData } from '../games/content';
import { isLessonV2 } from '../games/content';
import { isConjugationTable } from './tableShape';
import { hashString, shuffleArray } from '../shuffle';

export interface DeckCell {
  /** Stable within a lesson: `${tableId}::${person}::${verb}` (all lowercased). */
  id: string;
  /** The row's own label, e.g. "tú", "él/ella/usted". */
  person: string;
  /** The column header's infinitive, e.g. "ser". */
  verb: string;
  /** The table cell's raw text, e.g. "eres". strictAnswerMatch handles any
   *  "a / b" alternatives or parenthetical glosses on its own; this module
   *  does not need to split them out. */
  answer: string;
}

export interface DeckCellState {
  id: string;
  /** True once answered correctly; a done cell never comes back (until reset). */
  done: boolean;
  /** ms epoch it becomes due again after a wrong/empty answer; null = due now
   *  (never attempted yet, or freshly reset). */
  dueAt: number | null;
}

export interface DeckState {
  cells: DeckCellState[];
  /** FB377: bumped by resetDeck, part of the reshuffle seed so each pass
   *  through the deck gets a new (but still deterministic) order. */
  resetCount: number;
}

const COOLDOWN_MS = 60_000;

function normalizePerson(label: string): string {
  return label.trim().toLowerCase();
}

// FB357 convention (lib/grammar/vosotros.ts): vosotros stays in the lesson's
// reference tables, but never in something the learner has to produce. A
// table's row label is an exact, reliable signal here (unlike a drill item's
// free-text answer), so a plain set beats guessing from the conjugated form.
const VOSOTROS_PERSONS = new Set(['vosotros', 'vosotros/vosotras']);

/**
 * Every cell of every CONJUGATION table in a lesson (decision (a): reference
 * GridTables, e.g. hay-estar's article table, are excluded), vosotros rows
 * dropped, and the same person+verb pair counted once even if it somehow
 * repeats across two tables in the same lesson.
 */
export function tableCellsForLesson(lesson: GrammarTopicData | null | undefined): DeckCell[] {
  if (!lesson || !isLessonV2(lesson)) return [];
  const cells: DeckCell[] = [];
  const seen = new Set<string>();
  for (const block of lesson.body) {
    if (block.kind !== 'table') continue;
    if (!isConjugationTable(block.header, block.rows)) continue;
    const verbHeaders = block.header.slice(1);
    for (const row of block.rows) {
      const person = row[0];
      if (VOSOTROS_PERSONS.has(normalizePerson(person))) continue;
      for (let ci = 0; ci < verbHeaders.length; ci++) {
        const verb = verbHeaders[ci].es;
        const answer = row[ci + 1];
        if (!answer) continue;
        const key = `${normalizePerson(person)}::${verb.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        cells.push({ id: `${block.id}::${key}`, person, verb, answer });
      }
    }
  }
  return cells;
}

// FB377: the deck's cell order used to be the table's own row/column order
// (every learner saw "yo · ser" first, always), which makes the answers
// memorizable by position instead of by meaning. A seeded shuffle (lesson id
// + reset count) fixes the order for a given pass through the deck, so it is
// still deterministic and testable, but it is not the table's order, and a
// "Start again" reset gets a fresh shuffle.
// Sorted first, so the result depends only on the SET of ids, never on
// whatever order they happened to arrive in (table order from a fresh
// lesson load, or the previous pass's shuffled order on a reset), the
// order is a pure function of (ids, lessonId, resetCount).
function shuffledIds(cellIds: string[], lessonId: string, resetCount: number): string[] {
  return shuffleArray(cellIds.slice().sort(), hashString(`${lessonId}:${resetCount}`));
}

export function initDeckState(cells: DeckCell[], lessonId: string): DeckState {
  const order = shuffledIds(cells.map((c) => c.id), lessonId, 0);
  return { cells: order.map((id) => ({ id, done: false, dueAt: null })), resetCount: 0 };
}

/**
 * Reconciles freshly-derived cells (from the lesson data) with a persisted
 * state (from game_progress). A cell the lesson no longer has is dropped; a
 * new cell the persisted state has never seen starts fresh. The order is
 * reshuffled from `lessonId` + the persisted reset count, not read off the
 * persisted cell array, so a corpus change (a cell added/removed) does not
 * leave the new cell stuck at the end.
 */
export function mergeDeckState(cells: DeckCell[], lessonId: string, persisted: DeckState | undefined): DeckState {
  const resetCount = persisted?.resetCount ?? 0;
  const byId = new Map((persisted?.cells ?? []).map((c) => [c.id, c]));
  const order = shuffledIds(cells.map((c) => c.id), lessonId, resetCount);
  return { cells: order.map((id) => byId.get(id) ?? { id, done: false, dueAt: null }), resetCount };
}

export function doneCount(state: DeckState): number {
  return state.cells.filter((c) => c.done).length;
}

export function isDeckComplete(state: DeckState): boolean {
  return state.cells.length > 0 && state.cells.every((c) => c.done);
}

/**
 * The id of the cell to show next, or null if the deck is complete (or
 * empty). Preference: the first not-done cell that is due now (never
 * attempted, or its cooldown has passed), in the deck's own order. If
 * nothing is due yet, "learn ahead" like Anki: the not-done cell closest to
 * becoming due, so the learner is never stuck looking at a blank screen.
 */
export function nextCellId(state: DeckState, now: number): string | null {
  const pending = state.cells.filter((c) => !c.done);
  if (pending.length === 0) return null;
  const due = pending.find((c) => c.dueAt === null || c.dueAt <= now);
  if (due) return due.id;
  return pending.reduce((earliest, c) => (c.dueAt! < earliest.dueAt! ? c : earliest)).id;
}

/** Correct -> done, cleared cooldown. Wrong/empty -> due again in 60s. */
export function answerCell(state: DeckState, id: string, correct: boolean, now: number): DeckState {
  return {
    ...state,
    cells: state.cells.map((c) =>
      c.id === id ? { ...c, done: correct, dueAt: correct ? null : now + COOLDOWN_MS } : c
    ),
  };
}

/** Every cell answered right once -> start the pass over, with a fresh
 *  (still deterministic) shuffle, so the next pass isn't the same order. */
export function resetDeck(state: DeckState, lessonId: string): DeckState {
  const resetCount = state.resetCount + 1;
  const order = shuffledIds(state.cells.map((c) => c.id), lessonId, resetCount);
  return { cells: order.map((id) => ({ id, done: false, dueAt: null })), resetCount };
}
