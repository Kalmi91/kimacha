// The Situations mode of the Practice tab (beta practiceSituations, PLAN-szituaciok): a short dialogue (data/practice/situations.json)
// the learner first learns and then uses, one step after the other: Words (the situation's words the learner does not know yet),
// Structures (its patterns), Fill in (the gaps of the dialogue from a word bank), Build (the learner's lines as tiles), Say it
// (every line by voice or typed), Questions (the other person's questions, answered by voice or typed), then the Summary.
// Only the Spanish target has situations. A situation is offered only when every word of it is known or taught by its own `words`
// (the same "never an unknown word" rule as the rest of the app). Pure logic, no I/O: the screen is components/practice/SituationGame.tsx,
// what is said is checked by lib/practice/situationMatch.ts. No SRS writes in this mode: the scores are for the summary only.

import type { PcicLevel, PcicTarget } from '@/data/pcic';
import situationsData from '@/data/practice/situations.json';
import { sentenceTokens } from '@/lib/knownSentence';
import type { Lang } from '@/lib/languagePair';
import { tileWords } from '@/lib/sentenceCards';
import { shuffleArray } from '@/lib/shuffle';

export const SITUATIONS_MODE = 'situations';

export type SituationText = Record<Lang, string>;

/** A word the situation uses: the headword (`es`), the forms it takes in the dialogue and what it means. */
export interface SituationWord {
  es: string;
  forms: string[];
  en: string;
  hu: string;
}

/** A structure the situation practises: the pattern (`title`, in the learner's language), an example sentence and the explanation. */
export interface SituationPattern {
  title: SituationText;
  example: string;
  en: string;
  hu: string;
}

export interface SituationLine {
  speaker: 'other' | 'me';
  es: string;
  en: string;
  hu: string;
  /** A whole word of `es` that is a blank in the Fill in step. */
  gap?: string;
  /** What the learner may answer to this line (the Questions step); the first is the model answer. */
  answers?: string[];
}

export interface Situation {
  id: string;
  level: PcicLevel;
  title: SituationText;
  setting: SituationText;
  words: SituationWord[];
  patterns: SituationPattern[];
  /** The 2 words of the dialogue that are added to the gap words in the Fill in word bank (wrong, but they look right). */
  distractors: string[];
  lines: SituationLine[];
  /** Indexes of the lines of the Build step. */
  build: number[];
}

export const SITUATIONS: Situation[] = situationsData as Situation[];

/** The situations of a target language (Spanish only for now). */
export function situationsFor(target: PcicTarget): readonly Situation[] {
  return target === 'es' ? SITUATIONS : [];
}

/** The words of the situation the learner does not know yet: none of their forms is in `known` (lib/knownSentence.ts knownTokens). */
export function unknownWords(s: Situation, known: ReadonlySet<string>): SituationWord[] {
  return s.words.filter((w) => !w.forms.some((f) => known.has(f.toLowerCase())));
}

/** Every token of every line is known or one of the situation's own forms (so a word it teaches is never an unknown word). */
export function isSituationOpen(s: Situation, known: ReadonlySet<string>): boolean {
  const own = new Set(s.words.flatMap((w) => w.forms.map((f) => f.toLowerCase())));
  return s.lines.every((l) => sentenceTokens(l.es, 'es').every((token) => known.has(token) || own.has(token)));
}

/** The blanks of the Fill in step, in dialogue order. */
export function fillGaps(s: Situation): { line: number; word: string }[] {
  return s.lines.flatMap((l, line) => (l.gap ? [{ line, word: l.gap }] : []));
}

/** The lines of the Questions step: the other person's lines that have answers. */
export function questionLines(s: Situation): number[] {
  return s.lines.flatMap((l, i) => (l.speaker === 'other' && l.answers?.length ? [i] : []));
}

// Words of the other lines for the trap tiles: long enough to be a word, not a proper noun.
function otherWords(s: Situation, sentences: string[], exclude: ReadonlySet<string>): string[] {
  const proper = new Set(s.words.filter((w) => w.es !== w.es.toLowerCase()).map((w) => w.es.toLowerCase()));
  const tokens = sentences.flatMap((sentence) => sentenceTokens(sentence, 'es'));
  return [...new Set(tokens)].filter((w) => w.length > 3 && !exclude.has(w) && !proper.has(w));
}

/** The word bank of the Fill in step: the gap words and the situation's own distractors, shuffled (the same seed, the same order). */
export function fillBank(s: Situation, seed: number): string[] {
  return shuffleArray([...fillGaps(s).map((g) => g.word.toLowerCase()), ...s.distractors.map((w) => w.toLowerCase())], seed);
}

/** The 2 trap tiles of a Build line: words of the other lines that are not in this one. */
export function buildTraps(s: Situation, lineIndex: number, seed: number): string[] {
  const own = new Set(tileWords(s.lines[lineIndex].es).map((w) => w.toLowerCase()));
  const others = s.lines.filter((_, i) => i !== lineIndex).map((l) => l.es);
  return shuffleArray(otherWords(s, others, own), seed + lineIndex).slice(0, 2);
}

export type SituationPart = 'fill' | 'build' | 'say' | 'questions';
export type SituationStep = 'words' | 'patterns' | SituationPart | 'summary';
export type SituationScores = Record<SituationPart, number>;

/** After this many wrong tries on a spoken line or a question the answer is given up (Next appears, it counts as wrong). */
export const MAX_WRONG = 2;

export interface SituationState {
  /** The situation. */
  id: string;
  /** Seeds the word bank and the trap tiles, so they stay the same when the screen is left and resumed. */
  seed: number;
  /** The words of the Words step (headwords), fixed at the start: what the learner knows may change while the situation is going on. */
  words: string[];
  step: SituationStep;
  /** The card, gap, line or question on screen inside the step (in Fill in: the gaps filled so far). */
  index: number;
  /** Wrong tries on the current gap, line or question. */
  wrong: number;
  /** The current gap row / line / question is finished (or the whole Fill in step): Next moves on. */
  done: boolean;
  /** Right at the first try, per part. */
  scores: SituationScores;
}

/** How many gaps, builds, lines and questions the parts have (the totals of the summary). */
export function situationTotals(s: Situation): SituationScores {
  return { fill: fillGaps(s).length, build: s.build.length, say: s.lines.length, questions: questionLines(s).length };
}

/** The items of a step (0 = the step is skipped). */
export function stepSize(state: Pick<SituationState, 'words'>, s: Situation, step: SituationStep): number {
  if (step === 'words') return state.words.length;
  if (step === 'patterns') return s.patterns.length;
  if (step === 'summary') return 0;
  return situationTotals(s)[step];
}

const STEP_ORDER: readonly SituationStep[] = ['words', 'patterns', 'fill', 'build', 'say', 'questions'];

/** The steps this run goes through, in order: those with something in them (no unknown word = no Words step), then the summary. */
export function situationSteps(state: Pick<SituationState, 'words'>, s: Situation): SituationStep[] {
  return [...STEP_ORDER.filter((step) => stepSize(state, s, step) > 0), 'summary'];
}

/** A fresh run of the situation; `known` = knownTokens('es', ...) of the learner. */
export function startSituation(s: Situation, known: ReadonlySet<string>, seed: number): SituationState {
  const words = unknownWords(s, known).map((w) => w.es);
  return {
    id: s.id,
    seed,
    words,
    step: situationSteps({ words }, s)[0],
    index: 0,
    wrong: 0,
    done: false,
    scores: { fill: 0, build: 0, say: 0, questions: 0 },
  };
}

function nextStep(state: SituationState, s: Situation): SituationState {
  const steps = situationSteps(state, s);
  return { ...state, step: steps[steps.indexOf(state.step) + 1] ?? 'summary', index: 0, wrong: 0, done: false };
}

/** Next: the next Words / Structures card, or (once an item or the whole Fill in step is finished) the next item or step. */
export function nextSituation(state: SituationState, s: Situation): SituationState {
  const size = stepSize(state, s, state.step);
  const card = state.step === 'words' || state.step === 'patterns';
  if (state.step === 'summary' || (!card && !state.done)) return state;
  return state.index + 1 < size ? { ...state, index: state.index + 1, wrong: 0, done: false } : nextStep(state, s);
}

/**
 * An answer in Fill in (a word tapped), Build (the card's result), Say it or Questions (what was said). Right at the first try
 * is a point. Fill in: right = the next gap (the step is done after the last), wrong = counted, the gap stays. Build: one try,
 * on to the next line. Say it and Questions: right = done; wrong = another try, and the item is given up after MAX_WRONG.
 */
export function answerSituation(state: SituationState, s: Situation, right: boolean): SituationState {
  const step = state.step;
  if (state.done || step === 'words' || step === 'patterns' || step === 'summary') return state;
  const scores = right && state.wrong === 0 ? { ...state.scores, [step]: state.scores[step] + 1 } : state.scores;
  const size = stepSize(state, s, step);
  if (step === 'build') {
    const moved = { ...state, scores, index: state.index + 1, wrong: 0 };
    return moved.index >= size ? nextStep(moved, s) : moved;
  }
  if (step === 'fill') {
    if (!right) return { ...state, wrong: state.wrong + 1 };
    return { ...state, scores, index: state.index + 1, wrong: 0, done: state.index + 1 >= size };
  }
  if (right) return { ...state, scores, done: true };
  const wrong = state.wrong + 1;
  return { ...state, wrong, done: wrong >= MAX_WRONG };
}

/** What goes into the resume store. */
export function savedSituation(state: SituationState): unknown {
  return { v: 1, ...state };
}

const isCount = (x: unknown, max = Infinity): x is number => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= max;

/** A saved run back, or null when it is broken, is of another situation, or does not fit the situation any more. */
export function parseSituation(raw: unknown, open: readonly Situation[]): SituationState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const s = open.find((x) => x.id === r.id);
  if (!s || r.v !== 1 || !Number.isInteger(r.seed) || typeof r.done !== 'boolean') return null;
  const heads = new Set(s.words.map((w) => w.es));
  if (!Array.isArray(r.words) || !r.words.every((w) => typeof w === 'string' && heads.has(w))) return null;
  const words = r.words as string[];
  const steps = situationSteps({ words }, s);
  const step = steps.find((x) => x === r.step);
  if (!step || step === 'summary') return null;
  const size = stepSize({ words }, s, step);
  const totals = situationTotals(s);
  const sc = r.scores as Partial<Record<SituationPart, unknown>> | null;
  if (typeof sc !== 'object' || sc === null || !(Object.keys(totals) as SituationPart[]).every((p) => isCount(sc[p], totals[p]))) return null;
  if (!isCount(r.index, size) || !isCount(r.wrong)) return null;
  // Fill in is "done" exactly when every gap is filled (index = size); the other steps are never past their last item,
  // and only Say it and Questions can have a finished item.
  const atEnd = r.index === size;
  if (step === 'fill' ? r.done !== atEnd : atEnd || (r.done && step !== 'say' && step !== 'questions')) return null;
  return { id: s.id, seed: r.seed as number, words, step, index: r.index as number, wrong: r.wrong as number, done: r.done, scores: sc as SituationScores };
}
