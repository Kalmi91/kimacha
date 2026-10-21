// Dictation game of the Practice tab (beta practiceDictation, PLAN-jatekok-1021 BRIEF-A1): the word is read aloud with its
// article ("la camisa"), the learner types it. Pure round logic; the screen is components/practice/DictationGame.tsx.
//
// A round is the 8 words of lib/practice/gameRound.ts. Right = the word is done (one half, credited by the screen).
// Wrong = the correct form is shown and the word goes to the end of the round ONCE more; a word is asked at most twice.
// Two wrong typings in a row on the same word are one step back: lib/practice/halfStep.ts counts that on the card, so it
// also holds across the two askings. Score = words typed right the first time they were asked.

import type { PcicItem, PcicTarget } from '@/data/pcic';
import { gradePcicAnswer, pcicAlternatives, suggestedGrade } from '@/lib/pcicMatch';
import type { GameLogic } from '@/lib/practice/gameRound';

export const DICTATION_MODE = 'dictation';

export interface DictationVerdict {
  typed: string;
  right: boolean;
}

export interface DictationState {
  /** Card ids still to ask, the head is the word on screen. */
  queue: string[];
  /** Words already sent to the end once. */
  retried: string[];
  /** Words typed right the first time they were asked (the score). */
  firstTry: string[];
  /** How many times the screen moved on: a word that comes back is a new turn (the read-aloud runs again). */
  turn: number;
  /** The head was checked (and credited): the screen shows the feedback, Next moves on. */
  checked: DictationVerdict | null;
}

export function startDictation(ids: string[]): DictationState {
  return { queue: [...ids], retried: [], firstTry: [], turn: 0, checked: null };
}

export function currentWordId(state: DictationState): string | undefined {
  return state.queue[0];
}

export function dictationDone(state: DictationState): boolean {
  return state.queue.length === 0;
}

export function dictationScore(state: DictationState): number {
  return state.firstTry.length;
}

/** The 1-based position of the word on screen among the `total` words (the header counter). */
export function dictationPosition(state: DictationState, total: number): number {
  return Math.min(total, total - state.queue.length + 1);
}

/** The head was typed: right or wrong. Does nothing when there is no word or it was checked already. */
export function checkDictation(state: DictationState, typed: string, right: boolean): DictationState {
  const head = currentWordId(state);
  if (head === undefined || state.checked) return state;
  const firstTry = right && !state.retried.includes(head) ? [...state.firstTry, head] : state.firstTry;
  return { ...state, firstTry, checked: { typed, right } };
}

/** After the feedback: the word is done, or (wrong, first time) at the end of the round once more. */
export function nextDictation(state: DictationState): DictationState {
  const head = currentWordId(state);
  if (head === undefined || !state.checked) return state;
  const again = !state.checked.right && !state.retried.includes(head);
  return {
    ...state,
    queue: again ? [...state.queue.slice(1), head] : state.queue.slice(1),
    retried: again ? [...state.retried, head] : state.retried,
    turn: state.turn + 1,
    checked: null,
  };
}

/** The word in the learned language (with its article), what is read aloud, and what it means. */
export function dictationWord(item: PcicItem, target: PcicTarget): { answer: string; say: string; meaning: string } {
  const answer = target === 'es' ? item.es : item.en;
  return { answer, say: pcicAlternatives(answer)[0] ?? answer, meaning: target === 'es' ? item.en : item.es };
}

/** Graded like the Words tab's typing card (accent switch included); an empty typing is never right. */
export function isDictationRight(typed: string, answer: string, strictAccents: boolean): boolean {
  return typed.trim() !== '' && suggestedGrade(gradePcicAnswer(typed, answer, strictAccents)) === 'good';
}

const isIds = (x: unknown, allowed: ReadonlySet<string>): x is string[] =>
  Array.isArray(x) && x.every((id) => typeof id === 'string' && allowed.has(id)) && new Set(x).size === x.length;

/** A saved state back, or null when it does not fit this round's words. */
export function parseDictation(raw: unknown, ids: string[]): DictationState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<DictationState>;
  const allowed = new Set(ids);
  if (!isIds(r.queue, allowed) || !isIds(r.retried, allowed) || !isIds(r.firstTry, allowed)) return null;
  if (!Number.isInteger(r.turn) || (r.turn as number) < 0) return null;
  let checked: DictationVerdict | null = null;
  if (r.checked !== null && r.checked !== undefined) {
    const c = r.checked as Partial<DictationVerdict>;
    if (typeof c.typed !== 'string' || typeof c.right !== 'boolean' || r.queue.length === 0) return null;
    checked = { typed: c.typed, right: c.right };
  }
  return { queue: r.queue, retried: r.retried, firstTry: r.firstTry, turn: r.turn as number, checked };
}

export const dictationLogic: GameLogic<DictationState> = {
  mode: DICTATION_MODE,
  start: startDictation,
  parse: parseDictation,
};
