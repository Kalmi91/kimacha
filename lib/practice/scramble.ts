// Letter scramble game of the Practice tab (beta practiceScramble, PLAN-jatekok-1021 BRIEF-A2): the meaning is shown, the
// letters of the word lie shuffled below, the learner taps them in order. Pure round logic; the screen is
// components/practice/ScrambleGame.tsx.
//
// A round is the 8 words of lib/practice/gameRound.ts. Per word: a right letter jumps into its place, a wrong one is a
// mistake (counter +1, the screen shakes it) and changes nothing else. Finished with 0 mistakes = one half (credited by the
// screen); with mistakes = no half; Skip = the solution is shown, no half. A mistake never sends the word back a step.
// Score = words finished with 0 mistakes. An accented letter is its own tile (á is not a). The article of a Spanish noun
// is fixed text before the places, not a tile; spaces and punctuation in a phrase are fixed too.

import type { PcicItem, PcicTarget } from '@/data/pcic';
import { activeSourceFor } from '@/lib/languagePair';
import { wordIn } from '@/lib/pcicItemText';
import { pcicAlternatives } from '@/lib/pcicMatch';
import type { GameLogic } from '@/lib/practice/gameRound';

export const SCRAMBLE_MODE = 'scramble';

export type ScrambleOutcome = 'clean' | 'flawed' | 'skipped';

export interface ScrambleState {
  /** Card ids still to do, the head is the word on screen. */
  queue: string[];
  /** Tile indexes (in the shuffled row) tapped right for the head word, in order: the places they filled. */
  used: number[];
  /** Wrong taps on the head word. */
  mistakes: number;
  /** The head word is finished (credited already, or skipped): the screen shows the result, Next moves on. */
  finished: ScrambleOutcome | null;
  /** Words finished with 0 mistakes (the score). */
  clean: string[];
  /** How many times the screen moved on. */
  turn: number;
}

export function startScramble(ids: string[]): ScrambleState {
  return { queue: [...ids], used: [], mistakes: 0, finished: null, clean: [], turn: 0 };
}

const ARTICLE_RE = /^(el|la|los|las|un|una)\s+/i;
const LETTER_RE = /[\p{L}\p{N}]/u;

/** One character after the article: a letter (it has a place, `slot` = its number among the places) or fixed text. */
export interface ScrambleChar {
  ch: string;
  slot: number | null;
}

export interface ScrambleWord {
  /** The article of a Spanish noun without its space ("la"), or ''. */
  article: string;
  chars: ScrambleChar[];
  /** The letters in the order of the places. */
  letters: string[];
  /** The whole form with the article: what is read aloud. */
  say: string;
  meaning: string;
}

/** The word in the learned language split into article, places and fixed characters (the first of its alternatives). */
export function scrambleWord(item: PcicItem, target: PcicTarget): ScrambleWord {
  const written = wordIn(item, target) ?? '';
  const say = (pcicAlternatives(written)[0] ?? written).normalize('NFC').trim();
  const articleMatch = target === 'es' ? ARTICLE_RE.exec(say) : null;
  const rest = articleMatch ? say.slice(articleMatch[0].length) : say;
  const letters: string[] = [];
  const chars: ScrambleChar[] = Array.from(rest).map((ch) => {
    if (!LETTER_RE.test(ch)) return { ch, slot: null };
    letters.push(ch);
    return { ch, slot: letters.length - 1 };
  });
  return { article: articleMatch ? articleMatch[0].trim() : '', chars, letters, say, meaning: wordIn(item, activeSourceFor(target)) ?? '' };
}

/** A word needs two different letters, or there is nothing to put in order. */
export function isScrambleUsable(item: PcicItem, target: PcicTarget): boolean {
  const { letters } = scrambleWord(item, target);
  return letters.length >= 2 && new Set(letters).size >= 2;
}

// FNV-1a: a stable number from the card id, so the same word is always shuffled the same way (a resumed round shows the
// same tiles, and a test knows them).
export function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The letters in shuffled order, never in the original order (when there are two different letters, see isScrambleUsable). */
export function scrambleTiles(letters: string[], seed: number): string[] {
  const n = letters.length;
  const sameAsWord = (tiles: string[]) => tiles.every((l, i) => l === letters[i]);
  for (let attempt = 0; attempt < 32; attempt++) {
    const rand = mulberry32(seed + attempt * 0x9e3779b1);
    const tiles = [...letters];
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    if (!sameAsWord(tiles)) return tiles;
  }
  // practically never reached: rotate until the order differs
  for (let k = 1; k < n; k++) {
    const tiles = letters.map((_, i) => letters[(i + k) % n]);
    if (!sameAsWord(tiles)) return tiles;
  }
  return [...letters];
}

/** How many cells of `cell` width fit one row of `width` with `gap` between them (at least 1). */
export function cellsPerRow(width: number, cell: number, gap: number): number {
  return Math.max(1, Math.floor((width + gap) / (cell + gap)));
}

/** Row lengths for `count` cells, at most `perRow` in a row: as few rows as possible, filled evenly (longer rows first), so no lone cell is left in the last row. */
export function balancedRows(count: number, perRow: number): number[] {
  if (count <= 0) return [];
  const rows = Math.ceil(count / Math.max(1, perRow));
  const base = Math.floor(count / rows);
  const extra = count % rows;
  return Array.from({ length: rows }, (_, r) => base + (r < extra ? 1 : 0));
}

/** `items` cut, in order, into the rows of balancedRows(items.length, perRow). */
export function splitRows<T>(items: T[], perRow: number): T[][] {
  let start = 0;
  return balancedRows(items.length, perRow).map((n) => items.slice(start, (start += n)));
}

export function currentWordId(state: ScrambleState): string | undefined {
  return state.queue[0];
}

export function scrambleDone(state: ScrambleState): boolean {
  return state.queue.length === 0;
}

export function scrambleScore(state: ScrambleState): number {
  return state.clean.length;
}

/** The 1-based position of the word on screen among the `total` words (the header counter). */
export function scramblePosition(state: ScrambleState, total: number): number {
  return Math.min(total, total - state.queue.length + 1);
}

/**
 * A tap on tile `index`. hit: true = the right letter (it filled the next place), false = a mistake, null = nothing
 * happened (a used tile, no word, the word is finished). The last right letter finishes the word.
 */
export function tapTile(state: ScrambleState, letters: string[], tiles: string[], index: number): { state: ScrambleState; hit: boolean | null } {
  const head = currentWordId(state);
  if (head === undefined || state.finished || index < 0 || index >= tiles.length || state.used.includes(index)) return { state, hit: null };
  if (tiles[index] !== letters[state.used.length]) return { state: { ...state, mistakes: state.mistakes + 1 }, hit: false };
  const used = [...state.used, index];
  if (used.length < letters.length) return { state: { ...state, used }, hit: true };
  const finished: ScrambleOutcome = state.mistakes === 0 ? 'clean' : 'flawed';
  return { state: { ...state, used, finished, clean: finished === 'clean' ? [...state.clean, head] : state.clean }, hit: true };
}

/** Skip: the solution is shown, no half. */
export function skipScramble(state: ScrambleState): ScrambleState {
  if (currentWordId(state) === undefined || state.finished) return state;
  return { ...state, finished: 'skipped' };
}

/** After the result: the next word. */
export function nextScramble(state: ScrambleState): ScrambleState {
  if (currentWordId(state) === undefined || !state.finished) return state;
  return { ...state, queue: state.queue.slice(1), used: [], mistakes: 0, finished: null, turn: state.turn + 1 };
}

const isIds = (x: unknown, allowed: ReadonlySet<string>): x is string[] =>
  Array.isArray(x) && x.every((id) => typeof id === 'string' && allowed.has(id)) && new Set(x).size === x.length;

/** A saved state back, or null when it does not fit this round's words. */
export function parseScramble(raw: unknown, ids: string[], ctx: { items: PcicItem[]; target: PcicTarget }): ScrambleState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<ScrambleState>;
  const allowed = new Set(ids);
  if (!isIds(r.queue, allowed) || !isIds(r.clean, allowed)) return null;
  if (!Number.isInteger(r.turn) || (r.turn as number) < 0 || !Number.isInteger(r.mistakes) || (r.mistakes as number) < 0) return null;
  if (!Array.isArray(r.used) || !r.used.every((i) => Number.isInteger(i) && i >= 0) || new Set(r.used).size !== r.used.length) return null;
  const finished = r.finished ?? null;
  if (finished !== null && finished !== 'clean' && finished !== 'flawed' && finished !== 'skipped') return null;
  const head = r.queue[0];
  if (head === undefined) {
    if (r.used.length > 0 || finished !== null) return null;
  } else {
    const item = ctx.items.find((i) => i.id === head);
    if (!item) return null;
    const count = scrambleWord(item, ctx.target).letters.length;
    if (r.used.some((i) => i >= count) || r.used.length > count) return null;
    const complete = r.used.length === count;
    if ((finished === 'clean' || finished === 'flawed') !== complete && finished !== 'skipped') return null;
    if (finished === 'clean' && r.mistakes !== 0) return null;
  }
  return { queue: r.queue, used: r.used, mistakes: r.mistakes as number, finished, clean: r.clean, turn: r.turn as number };
}

export const scrambleLogic: GameLogic<ScrambleState> = {
  mode: SCRAMBLE_MODE,
  start: startScramble,
  parse: parseScramble,
  usable: isScrambleUsable,
};
