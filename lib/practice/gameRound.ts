// The part every Practice tab game shares (spec HAROM-JATEK.md 5 and 5.1; PLAN-jatekok-1021 BRIEF-KOZOS): which words a
// round of GAME_ROUND_SIZE uses, the credit of an answer (one half, the day counts for the streak), and the saved round.
// Pure logic plus thin wrappers; the hook is lib/practice/useGameRound.ts, the screen shell components/practice/GameFrame.tsx.
//
// Saved round: one value per mode in the resume store (lib/resumeStore.ts), key `practice-game-<mode>`:
//   {"v":1,"mode":"dictation","date":"2026-10-21","target":"es","ids":["o19","o37",...],"state":{...}}
// ids = the words of the round (card ids, in round order); state = whatever the mode keeps (the mode validates it). A round
// is only resumed on the same local day and in the same direction; anything broken or older is just not resumed.

import type { PcicItem, PcicTarget } from '@/data/pcic';
import { getBeta } from '@/lib/beta';
import { getDb } from '@/lib/database';
import { countLearningToday } from '@/lib/learningDay';
import { practiceCandidates } from '@/lib/practice/gapFill';
import { recordCorrectHalf } from '@/lib/practice/halfXp';
import { recordPracticeResult } from '@/lib/practice/halfStep';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import type { Sm2Card } from '@/lib/sm2';

/** A round holds this many words. */
export const GAME_ROUND_SIZE = 8;
/** Fewer words than this make no round: the screen shows the empty state. */
export const GAME_MIN_WORDS = 3;

export interface GameWordsDeps {
  /** Every card of the deck. */
  cards: Sm2Card[];
  today: string;
  findItem: (id: string) => PcicItem | undefined;
  /** Card ids of the round this one replaces: they go to the end of the candidates (kept, not dropped), so a new round differs. */
  avoid?: ReadonlySet<string>;
  size?: number;
  /** Fewer words than this make no round (default GAME_MIN_WORDS). */
  min?: number;
  /** Words the game cannot use (e.g. a letter game needs two different letters) are left out. */
  usable?: (item: PcicItem) => boolean;
}

/**
 * The words of a new round, in order: the learned words that are due (the longest overdue first), then the ones learned
 * in the last days (lib/practice/gapFill.ts practiceCandidates). Never a word without a card, never an unknown word.
 * Fewer than GAME_MIN_WORDS words: [] (= no round).
 */
export function pickGameWords({ cards, today, findItem, avoid, size = GAME_ROUND_SIZE, min = GAME_MIN_WORDS, usable }: GameWordsDeps): PcicItem[] {
  const items: PcicItem[] = [];
  for (const card of practiceCandidates(cards, today)) {
    const item = findItem(card.itemId);
    if (item && (!usable || usable(item))) items.push(item);
  }
  const fresh = items.filter((i) => !avoid?.has(i.id));
  const stale = items.filter((i) => avoid?.has(i.id));
  const picked = [...fresh, ...stale].slice(0, size);
  return picked.length >= min ? picked : [];
}

/** A right answer: one half (with its XP under the xpV2 switch), and the day counts for the streak. */
export async function creditRight(itemId: string): Promise<void> {
  await recordCorrectHalf(itemId, getBeta('xpV2'));
  await countLearningToday();
}

/**
 * A wrong answer. `typed`: it was written in (two in a row on the same word = one step back, like the Sentences tab's
 * wrongTyped); a pick or a match changes nothing, only the day counts.
 */
export async function creditWrong(itemId: string, typed: boolean): Promise<void> {
  await recordPracticeResult(itemId, typed ? 'wrongTyped' : 'wrongOther');
  await countLearningToday();
}

export interface SavedGame {
  v: 1;
  mode: string;
  date: string;
  target: PcicTarget;
  ids: string[];
  state: unknown;
}

/** What a mode supplies to useGameRound: its state at the start of a round, and the check of a saved one. */
export interface GameLogic<S> {
  /** Save key part and testID prefix of the mode. */
  mode: string;
  /** The state of a fresh round over these card ids (round order); the words and the direction are there for a game that sorts them. */
  start: (ids: string[], ctx: { items: PcicItem[]; target: PcicTarget }) => S;
  /** A saved state back, or null when it is broken or does not fit the words (= the round is not resumed). */
  parse: (raw: unknown, ids: string[], ctx: { items: PcicItem[]; target: PcicTarget }) => S | null;
  /** Words in a round (default GAME_ROUND_SIZE) and the fewest that make one (default GAME_MIN_WORDS). */
  size?: number;
  minWords?: number;
  /** Words this game can use; the others are left out of its rounds. Omitted: every learned word. */
  usable?: (item: PcicItem, target: PcicTarget) => boolean;
}

/** A round on screen: its words (round order) and the mode's state. */
export interface GameRound<S> {
  date: string;
  target: PcicTarget;
  ids: string[];
  items: PcicItem[];
  state: S;
}

export function startGame<S>(logic: GameLogic<S>, items: PcicItem[], date: string, target: PcicTarget): GameRound<S> {
  const ids = items.map((i) => i.id);
  return { date, target, ids, items, state: logic.start(ids, { items, target }) };
}

/** The saved round as the screen resumes it, or null when a new one has to be built: nothing saved, another day or direction, a card that is gone, a state that does not fit. */
export function resumeGame<S>(
  saved: SavedGame | null,
  logic: GameLogic<S>,
  today: string,
  target: PcicTarget,
  findItem: (id: string) => PcicItem | undefined,
): GameRound<S> | null {
  if (!saved || saved.date !== today || saved.target !== target) return null;
  const items: PcicItem[] = [];
  for (const id of saved.ids) {
    const item = findItem(id);
    if (!item) return null;
    items.push(item);
  }
  if (items.length < (logic.minWords ?? GAME_MIN_WORDS)) return null;
  const state = logic.parse(saved.state, saved.ids, { items, target });
  return state === null ? null : { date: saved.date, target, ids: saved.ids, items, state };
}

export function toSaved<S>(mode: string, round: GameRound<S>, state: S = round.state): SavedGame {
  return { v: 1, mode, date: round.date, target: round.target, ids: round.ids, state };
}

const gameKey = (mode: string) => `practice-game-${mode}`;
const isId = (x: unknown): x is string => typeof x === 'string' && x !== '';

// A missing, broken or wrongly shaped value gives null (= nothing to resume).
export function parseSavedGame(raw: unknown, mode: string): SavedGame | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<SavedGame>;
  if (r.v !== 1 || r.mode !== mode || typeof r.date !== 'string') return null;
  if (r.target !== 'es' && r.target !== 'en') return null;
  if (!Array.isArray(r.ids) || r.ids.length === 0 || !r.ids.every(isId) || r.state === undefined) return null;
  return { v: 1, mode, date: r.date, target: r.target, ids: r.ids, state: r.state };
}

export async function loadSavedGame(mode: string): Promise<SavedGame | null> {
  return parseSavedGame(await loadResumeValue(getDb(), gameKey(mode)), mode);
}

/** null deletes the saved round. */
export async function saveGame(mode: string, game: SavedGame | null): Promise<void> {
  await saveResumeValue(getDb(), gameKey(mode), game);
}
