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

export function initDeckState(cells: DeckCell[]): DeckState {
  return { cells: cells.map((c) => ({ id: c.id, done: false, dueAt: null })) };
}

/**
 * Reconciles freshly-derived cells (from the lesson data) with a persisted
 * state (from game_progress). A cell the lesson no longer has is dropped; a
 * new cell the persisted state has never seen starts fresh.
 */
export function mergeDeckState(cells: DeckCell[], persisted: DeckCellState[] | undefined): DeckState {
  const byId = new Map((persisted ?? []).map((c) => [c.id, c]));
  return { cells: cells.map((c) => byId.get(c.id) ?? { id: c.id, done: false, dueAt: null }) };
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
    cells: state.cells.map((c) =>
      c.id === id ? { ...c, done: correct, dueAt: correct ? null : now + COOLDOWN_MS } : c
    ),
  };
}

/** Every cell answered right once -> start the pass over. */
export function resetDeck(state: DeckState): DeckState {
  return { cells: state.cells.map((c) => ({ id: c.id, done: false, dueAt: null })) };
}
