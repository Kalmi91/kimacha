// Quick match game of the Practice tab (beta practiceMatch, PLAN-jatekok-1021 BRIEF-A3): Spanish words (with article) on the
// left, English meanings on the right, both shuffled; tap one of each. A round is up to 3 tables of 5 pairs and 60 seconds for
// the whole round. Pure round logic; the screen is components/practice/MatchGame.tsx.
//
// A pair found with no miss on either word is one half for that word; a pair found after a miss only counts the day. A miss
// (a wrong pair tapped) marks both words, changes nothing else, and never sends a word back a step. Two words with the same
// English text never share a table. The time left is part of the state, so a round that is left continues from there.

import type { PcicItem, PcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { activeSourceFor, type Lang } from '@/lib/languagePair';
import { wordIn } from '@/lib/pcicItemText';
import { pcicAlternatives } from '@/lib/pcicMatch';
import type { GameLogic } from '@/lib/practice/gameRound';
import { scrambleTiles, seedOf } from '@/lib/practice/scramble';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';

export const MATCH_MODE = 'match';
export const MATCH_BOARD_SIZE = 5;
export const MATCH_BOARDS = 3;
export const MATCH_ROUND_MS = 60_000;
/** Words asked for: more than the 15 a round needs, because a word whose English text is already on its table is passed over. */
export const MATCH_CANDIDATES = 24;
/** The fewest words that make a round: one table. */
export const MATCH_MIN_WORDS = MATCH_BOARD_SIZE;

export type MatchEnd = 'all' | 'time';

export interface MatchState {
  /** Card ids per table, in play order. */
  boards: string[][];
  /** Pairs found (both cards gone). */
  found: string[];
  /** Pairs found with no miss: each got its half. */
  firstTry: string[];
  /** Words with a miss mark (a wrong pair was tapped with them). */
  missed: string[];
  /** Milliseconds left of the round. */
  leftMs: number;
  /** null while the round runs. */
  over: MatchEnd | null;
}

const firstForm = (text: string) => (pcicAlternatives(text)[0] ?? text).trim();

/** The languages of the left and right column: Spanish and English, or with Hungarian in the pair, the Hungarian on the left and the pair's other language on the right. */
function columnLangs(target: PcicTarget): { left: Lang; right: Lang } {
  const source = activeSourceFor(target);
  if (target === 'hu') return { left: 'hu', right: source };
  if (source === 'hu') return { left: 'hu', right: target };
  return { left: 'es', right: 'en' };
}

/** What a card shows: the left word (Spanish with its article) as `es`, and the right meaning (English as written, its notes in brackets too) as `en`; the keys name the columns. */
export function matchCard(item: PcicItem, target: PcicTarget = 'es'): { es: string; en: string } {
  const { left, right } = columnLangs(target);
  return { es: firstForm(wordIn(item, left) ?? ''), en: (wordIn(item, right) ?? '').trim() };
}

/** A word needs both texts. */
export function isMatchUsable(item: PcicItem, target: PcicTarget = 'es'): boolean {
  const card = matchCard(item, target);
  return card.es !== '' && card.en !== '';
}

/** The tables: the words in order into the first table that has room and no word with the same English text; others are passed over. */
export function buildBoards(items: PcicItem[], target: PcicTarget = 'es'): string[][] {
  const boards: { ids: string[]; meanings: Set<string> }[] = [];
  for (const item of items) {
    const meaning = matchCard(item, target).en.toLowerCase();
    let board = boards.find((b) => b.ids.length < MATCH_BOARD_SIZE && !b.meanings.has(meaning));
    if (!board && boards.length < MATCH_BOARDS) {
      board = { ids: [], meanings: new Set() };
      boards.push(board);
    }
    if (!board || board.ids.length >= MATCH_BOARD_SIZE || board.meanings.has(meaning)) continue;
    board.ids.push(item.id);
    board.meanings.add(meaning);
  }
  return boards.map((b) => b.ids);
}

export function startMatch(ids: string[], ctx: { items: PcicItem[]; target?: PcicTarget }): MatchState {
  const byId = new Map(ctx.items.map((i) => [i.id, i]));
  const items = ids.map((id) => byId.get(id)).filter((i): i is PcicItem => i !== undefined);
  return { boards: buildBoards(items, ctx.target), found: [], firstTry: [], missed: [], leftMs: MATCH_ROUND_MS, over: null };
}

export function matchTotal(state: MatchState): number {
  return state.boards.reduce((n, b) => n + b.length, 0);
}

/** The table in play: the first one with a pair left; -1 when every pair is found. */
export function currentBoard(state: MatchState): number {
  return state.boards.findIndex((b) => b.some((id) => !state.found.includes(id)));
}

/** The two columns of a table (card ids): both shuffled, deterministically, never in table order. */
export function boardColumns(board: string[]): { es: string[]; en: string[] } {
  const key = board.join(',');
  const es = scrambleTiles(board, seedOf(`es:${key}`));
  let en = scrambleTiles(board, seedOf(`en:${key}`));
  for (let salt = 0; salt < 8 && board.length > 2 && en.join() === es.join(); salt++) en = scrambleTiles(board, seedOf(`en${salt}:${key}`));
  return { es, en };
}

/**
 * The Spanish card `esId` and the English card `enId` were tapped. hit: true = a pair, false = a miss, null = nothing (the round
 * is over, or a card is gone). firstTry: the pair had no miss mark on its word.
 */
export function tryPair(state: MatchState, esId: string, enId: string): { state: MatchState; hit: boolean | null; firstTry: boolean } {
  if (state.over || state.found.includes(esId) || state.found.includes(enId)) return { state, hit: null, firstTry: false };
  if (esId !== enId) {
    const missed = [...new Set([...state.missed, esId, enId])];
    return { state: { ...state, missed }, hit: false, firstTry: false };
  }
  const firstTry = !state.missed.includes(esId);
  const found = [...state.found, esId];
  const next: MatchState = { ...state, found, firstTry: firstTry ? [...state.firstTry, esId] : state.firstTry };
  return { state: found.length >= matchTotal(state) ? { ...next, over: 'all' } : next, hit: true, firstTry };
}

/** The clock moved on by `elapsedMs`; at 0 the round is over. */
export function tickMatch(state: MatchState, elapsedMs: number): MatchState {
  if (state.over) return state;
  const leftMs = Math.max(0, state.leftMs - elapsedMs);
  return leftMs === 0 ? { ...state, leftMs, over: 'time' } : { ...state, leftMs };
}

/** Milliseconds the round took (the whole round when the time ran out). */
export function usedMs(state: MatchState): number {
  return MATCH_ROUND_MS - state.leftMs;
}

const isIds = (x: unknown, allowed: ReadonlySet<string>): x is string[] =>
  Array.isArray(x) && x.every((id) => typeof id === 'string' && allowed.has(id)) && new Set(x).size === x.length;

/** A saved state back, or null when it does not fit this round's words. */
export function parseMatch(raw: unknown, ids: string[]): MatchState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<MatchState>;
  const allowed = new Set(ids);
  if (!Array.isArray(r.boards) || r.boards.length === 0 || r.boards.length > MATCH_BOARDS) return null;
  if (!r.boards.every((b) => Array.isArray(b) && b.length > 0 && b.length <= MATCH_BOARD_SIZE && isIds(b, allowed))) return null;
  const inBoards = new Set(r.boards.flat());
  if (inBoards.size !== r.boards.flat().length) return null;
  if (!isIds(r.found, inBoards) || !isIds(r.firstTry, new Set(r.found)) || !isIds(r.missed, inBoards)) return null;
  if (!Number.isInteger(r.leftMs) || (r.leftMs as number) < 0 || (r.leftMs as number) > MATCH_ROUND_MS) return null;
  const over = r.over ?? null;
  if (over !== null && over !== 'all' && over !== 'time') return null;
  const all = r.found.length === inBoards.size;
  if ((over === 'all') !== all) return null;
  if (over === 'time' && r.leftMs !== 0) return null;
  if (over === null && r.leftMs === 0) return null;
  return { boards: r.boards, found: r.found, firstTry: r.firstTry, missed: r.missed, leftMs: r.leftMs as number, over };
}

export const matchLogic: GameLogic<MatchState> = {
  mode: MATCH_MODE,
  size: MATCH_CANDIDATES,
  minWords: MATCH_MIN_WORDS,
  start: startMatch,
  parse: parseMatch,
  usable: isMatchUsable,
};

const BEST_KEY = 'practice-match-best';

/** The fastest round with every pair found, in milliseconds; null = none yet. */
export async function loadMatchBest(): Promise<number | null> {
  const raw = await loadResumeValue(getDb(), BEST_KEY);
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : null;
}

/** Keeps `ms` when it beats the stored best; returns the best after it. */
export async function recordMatchTime(took: number): Promise<number> {
  const ms = Math.max(1, took);
  const best = await loadMatchBest();
  if (best !== null && best <= ms) return best;
  await saveResumeValue(getDb(), BEST_KEY, ms);
  return ms;
}
