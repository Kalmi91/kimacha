// Opposites game of the Practice tab (beta practiceOpposites, PLAN-jatekok-1021 BRIEF-A4b): the word is shown and read aloud,
// "What is the opposite?", four words to tap. Pure round logic; the screen is components/practice/OppositesGame.tsx.
//
// The pairs are data/practice/opposites.json (Spanish lemmas, checked by scripts/check-opposites.mjs); the cards of a lemma come
// from data/words-open. A round is the 8 words of lib/practice/gameRound.ts that have a learned opposite of the same part of
// speech and at least 3 more learned words of that part of speech for the wrong options. The 4 options of a word are three
// learned words of its part of speech plus the opposite; none of them is the word itself or ANY opposite of it (viejo is a pair
// of joven and of nuevo: they are never both options). They are fixed when the round starts and saved with it.
//
// A right option is one half for the asked word (credited by the screen). A wrong one shows the right option, only the day
// counts, and the word is never sent back a step. Score = words answered right. Spanish words only: the es->en deck has no pairs,
// so there no word is usable (= the empty state).

import { findPcicItem, type PcicItem, type PcicTarget } from '@/data/pcic';
import pairs from '@/data/practice/opposites.json';
import openA1 from '@/data/words-open/a1.json';
import openA2 from '@/data/words-open/a2.json';
import openB1 from '@/data/words-open/b1.json';
import { pcicAlternatives } from '@/lib/pcicMatch';
import type { GameLogic } from '@/lib/practice/gameRound';
import { scrambleTiles, seedOf } from '@/lib/practice/scramble';

export const OPPOSITES_MODE = 'opposites';
/** Options per word: the opposite and three wrong ones. */
export const OPPOSITES_OPTIONS = 4;

type OpenCard = { order: number; lemma: string };

let partnerIndex: Map<string, string[]> | null = null;

// card id (o<order>, the en->es deck) -> the card ids of its opposites; the pairs are written with lemmas.
function partners(): Map<string, string[]> {
  if (!partnerIndex) {
    const idsOfLemma = new Map<string, string[]>();
    for (const file of [openA1, openA2, openB1] as OpenCard[][]) {
      for (const c of file) idsOfLemma.set(c.lemma, [...(idsOfLemma.get(c.lemma) ?? []), `o${c.order}`]);
    }
    const index = new Map<string, string[]>();
    const link = (from: string[], to: string[]) => {
      for (const id of from) index.set(id, [...(index.get(id) ?? []), ...to]);
    };
    for (const { a, b } of pairs) {
      const as = idsOfLemma.get(a) ?? [];
      const bs = idsOfLemma.get(b) ?? [];
      link(as, bs);
      link(bs, as);
    }
    partnerIndex = index;
  }
  return partnerIndex;
}

/** The card ids that are an opposite of this card in the pair data (none for most cards). */
export function oppositesOf(itemId: string): readonly string[] {
  return partners().get(itemId) ?? [];
}

/** What a card shows: the Spanish word with its article (the first of its alternatives). */
export function oppositeText(item: PcicItem): string {
  return (pcicAlternatives(item.es)[0] ?? item.es).trim();
}

export interface OppositesQuestion {
  /** The option card ids in the order shown (OPPOSITES_OPTIONS of them). */
  options: string[];
  /** The option that is the opposite. */
  answer: string;
}

const byOrder = (a: PcicItem, b: PcicItem) => a.order - b.order;

/**
 * The question of one word, or null when it has none: no learned opposite of the same part of speech, or fewer than 3 other
 * learned words of that part of speech with a text of their own. `learned` = the ids of the learned cards. Deterministic
 * (the word's id seeds every choice), so the same inputs give the same question.
 */
export function buildQuestion(item: PcicItem, learned: ReadonlySet<string>): OppositesQuestion | null {
  const text = oppositeText(item);
  const partnerIds = new Set(oppositesOf(item.id));
  if (!item.pos || text === '' || partnerIds.size === 0) return null;
  const answers = [...partnerIds]
    .filter((id) => learned.has(id))
    .map((id) => findPcicItem(id))
    .filter((p): p is PcicItem => p !== undefined && p.pos === item.pos && oppositeText(p) !== '')
    .sort(byOrder);
  if (answers.length === 0) return null;
  const answer = answers[seedOf(`answer:${item.id}`) % answers.length];
  const pool = new Map<string, PcicItem>();
  for (const id of [...learned].sort()) {
    if (id === item.id || partnerIds.has(id)) continue;
    const other = findPcicItem(id);
    if (other && other.pos === item.pos) pool.set(id, other);
  }
  if (pool.size < OPPOSITES_OPTIONS - 1) return null;
  // no two options (or the word) with the same text
  const shown = new Set([text.toLowerCase(), oppositeText(answer).toLowerCase()]);
  const wrong: string[] = [];
  for (const id of scrambleTiles([...pool.keys()], seedOf(`wrong:${item.id}`))) {
    const label = oppositeText(pool.get(id)!).toLowerCase();
    if (label === '' || shown.has(label)) continue;
    shown.add(label);
    wrong.push(id);
    if (wrong.length === OPPOSITES_OPTIONS - 1) break;
  }
  if (wrong.length < OPPOSITES_OPTIONS - 1) return null;
  return { options: scrambleTiles([answer.id, ...wrong], seedOf(`options:${item.id}`)), answer: answer.id };
}

/** A word can be asked when it has a question over the learned words. */
export function isOppositesUsable(item: PcicItem, _target: PcicTarget, learned: ReadonlySet<string>): boolean {
  return buildQuestion(item, learned) !== null;
}

export interface OppositesState {
  /** The question of every word of the round, by card id. */
  questions: Record<string, OppositesQuestion>;
  /** Card ids still to do, the head is the word on screen. */
  queue: string[];
  /** The option tapped on the head word; null = not answered yet. Set = the screen shows the result, Next moves on. */
  picked: string | null;
  /** Words answered right (the score). */
  right: string[];
  /** How many times the screen moved on. */
  turn: number;
}

export function startOpposites(ids: string[], ctx: { items: PcicItem[]; learned: ReadonlySet<string> }): OppositesState {
  const byId = new Map(ctx.items.map((i) => [i.id, i]));
  const questions: Record<string, OppositesQuestion> = {};
  for (const id of ids) {
    const item = byId.get(id);
    const question = item ? buildQuestion(item, ctx.learned) : null;
    if (question) questions[id] = question;
  }
  return { questions, queue: ids.filter((id) => questions[id] !== undefined), picked: null, right: [], turn: 0 };
}

export function currentWordId(state: OppositesState): string | undefined {
  return state.queue[0];
}

export function oppositesDone(state: OppositesState): boolean {
  return state.queue.length === 0;
}

export function oppositesScore(state: OppositesState): number {
  return state.right.length;
}

/** The 1-based position of the word on screen among the `total` words (the header counter). */
export function oppositesPosition(state: OppositesState, total: number): number {
  return Math.min(total, total - state.queue.length + 1);
}

/**
 * A tap on option `option` of the word on screen. hit: true = the opposite, false = a wrong option, null = nothing happened
 * (answered already, no word, not an option of this word).
 */
export function pickOption(state: OppositesState, option: string): { state: OppositesState; hit: boolean | null } {
  const head = currentWordId(state);
  const question = head === undefined ? undefined : state.questions[head];
  if (head === undefined || !question || state.picked !== null || !question.options.includes(option)) return { state, hit: null };
  const hit = option === question.answer;
  return { state: { ...state, picked: option, right: hit ? [...state.right, head] : state.right }, hit };
}

/** After the result: the next word. */
export function nextOpposites(state: OppositesState): OppositesState {
  if (currentWordId(state) === undefined || state.picked === null) return state;
  return { ...state, queue: state.queue.slice(1), picked: null, turn: state.turn + 1 };
}

const isIds = (x: unknown, allowed: ReadonlySet<string>): x is string[] =>
  Array.isArray(x) && x.every((id) => typeof id === 'string' && allowed.has(id)) && new Set(x).size === x.length;

// One saved question: 4 different cards of the deck, none of them the word, the opposite among them, and no other opposite of the word.
function parseQuestion(id: string, raw: unknown): OppositesQuestion | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const q = raw as Partial<OppositesQuestion>;
  const { options, answer } = q;
  if (!Array.isArray(options) || options.length !== OPPOSITES_OPTIONS || new Set(options).size !== options.length) return null;
  if (!options.every((o) => typeof o === 'string' && o !== id && findPcicItem(o) !== undefined)) return null;
  if (typeof answer !== 'string' || !options.includes(answer)) return null;
  const partnerIds = oppositesOf(id);
  if (!partnerIds.includes(answer) || options.some((o) => o !== answer && partnerIds.includes(o))) return null;
  return { options: options as string[], answer };
}

/** A saved state back, or null when it does not fit this round's words. */
export function parseOpposites(raw: unknown, ids: string[]): OppositesState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<OppositesState>;
  const allowed = new Set(ids);
  if (!isIds(r.queue, allowed) || !isIds(r.right, allowed)) return null;
  if (!Number.isInteger(r.turn) || (r.turn as number) < 0) return null;
  if (typeof r.questions !== 'object' || r.questions === null) return null;
  const questions: Record<string, OppositesQuestion> = {};
  for (const [id, saved] of Object.entries(r.questions)) {
    const question = allowed.has(id) ? parseQuestion(id, saved) : null;
    if (!question) return null;
    questions[id] = question;
  }
  const { queue, right } = r;
  if (![...queue, ...right].every((id) => questions[id] !== undefined)) return null;
  const picked = r.picked ?? null;
  const head = queue[0];
  if (head === undefined) {
    if (picked !== null) return null;
  } else {
    if (picked !== null && !questions[head].options.includes(picked)) return null;
    // the head word is among the right ones exactly when its answer was picked
    if (right.includes(head) !== (picked !== null && picked === questions[head].answer)) return null;
  }
  if (right.some((id) => queue.slice(1).includes(id))) return null;
  return { questions, queue, picked, right, turn: r.turn as number };
}

export const oppositesLogic: GameLogic<OppositesState> = {
  mode: OPPOSITES_MODE,
  start: startOpposites,
  parse: parseOpposites,
  usable: isOppositesUsable,
};
