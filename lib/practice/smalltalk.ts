// The Small talk mode of the Practice tab: fixed phrase packs (data/practice/smalltalk.json), a topic is a list of questions with the
// answers one can give. Three parts, one after the other: Build (every question and every answer once, in data order, as word tiles),
// "The app asks" (the app asks, the learner answers with any valid answer: tiles, voice or typed) and "You ask" (roles swap: the
// learner asks the question in Spanish, the app answers with a random valid answer), then the summary. Pure logic, no I/O: the screen
// is components/practice/SmallTalkGame.tsx, what is said is checked by lib/practice/situationMatch.ts. No SRS writes: the scores are
// for the summary only. Spanish only for now; the phrases are not gated by the learner's known words.

import type { PcicTarget } from '@/data/pcic';
import smalltalkData from '@/data/practice/smalltalk.json';
import { tileWords } from '@/lib/sentenceCards';
import { shuffleArray } from '@/lib/shuffle';
import { matchSpoken, type SpokenMatch } from '@/lib/practice/situationMatch';

export const SMALLTALK_MODE = 'smalltalk';

export type SmallTalkTone = 'pos' | 'neg' | 'odd';

export interface SmallTalkText {
  es: string;
  en: string;
}

export interface SmallTalkAnswer extends SmallTalkText {
  tone: SmallTalkTone;
}

export interface SmallTalkPair {
  q: SmallTalkText;
  answers: SmallTalkAnswer[];
}

export interface SmallTalkTopic {
  id: string;
  /** The language of the phrases. */
  target: 'es';
  title: Record<'en' | 'es' | 'hu' | 'de', string>;
  pairs: SmallTalkPair[];
}

const TOPICS: SmallTalkTopic[] = smalltalkData as SmallTalkTopic[];

/** The topics of a target language (only Spanish has them). */
export function smalltalkTopics(target: PcicTarget): readonly SmallTalkTopic[] {
  return TOPICS.filter((t) => t.target === target);
}

/** An item of the Build part: a question (`answer` null) or one of its answers. */
export interface BuildItem {
  pair: number;
  answer: number | null;
}

/** Every question followed by its answers, in data order. */
export function buildItems(topic: SmallTalkTopic): BuildItem[] {
  return topic.pairs.flatMap((p, pair) => [{ pair, answer: null }, ...p.answers.map((_, answer) => ({ pair, answer }))]);
}

/** The Spanish and English text of a Build item. */
export function buildItemText(topic: SmallTalkTopic, item: BuildItem): SmallTalkText {
  const p = topic.pairs[item.pair];
  return item.answer === null ? p.q : p.answers[item.answer];
}

// Words of other sentences of the topic for trap tiles: long enough to be a word, not in the sentence itself.
function trapPool(sentences: string[], own: ReadonlySet<string>): string[] {
  const unique = new Map(sentences.flatMap((s) => tileWords(s)).map((w) => [w.toLowerCase(), w] as const));
  return [...unique.values()].filter((w) => w.length > 3 && !own.has(w.toLowerCase()));
}

const wordsOf = (sentence: string): Set<string> => new Set(tileWords(sentence).map((w) => w.toLowerCase()));

/** The 2 trap tiles of a Build item: words of the other sentences of the topic that are not in this one. */
export function buildTraps(topic: SmallTalkTopic, itemIndex: number, seed: number): string[] {
  const items = buildItems(topic);
  const own = wordsOf(buildItemText(topic, items[itemIndex]).es);
  const others = items.filter((_, i) => i !== itemIndex).map((it) => buildItemText(topic, it).es);
  return shuffleArray(trapPool(others, own), seed + itemIndex).slice(0, 2);
}

/** The word bank of "The app asks": the words of all valid answers of the question (a word as often as one answer needs it), shuffled. */
export function answerBank(topic: SmallTalkTopic, pairIndex: number, seed: number): string[] {
  const need = new Map<string, { word: string; n: number }>();
  for (const a of topic.pairs[pairIndex].answers) {
    const count = new Map<string, { word: string; n: number }>();
    for (const w of tileWords(a.es)) {
      const key = w.toLowerCase();
      const c = count.get(key) ?? { word: w, n: 0 };
      count.set(key, { word: c.word, n: c.n + 1 });
    }
    for (const [key, c] of count) if (c.n > (need.get(key)?.n ?? 0)) need.set(key, c);
  }
  const bank = [...need.values()].flatMap((c) => Array<string>(c.n).fill(c.word));
  return shuffleArray(bank, seed + pairIndex);
}

/** The word bank of "You ask": the words of the question and 2 trap words of the other questions, shuffled. */
export function questionBank(topic: SmallTalkTopic, pairIndex: number, seed: number): string[] {
  const q = topic.pairs[pairIndex].q.es;
  const others = topic.pairs.filter((_, i) => i !== pairIndex).map((p) => p.q.es);
  const traps = shuffleArray(trapPool(others, wordsOf(q)), seed + pairIndex).slice(0, 2);
  return shuffleArray([...tileWords(q), ...traps], seed + pairIndex + 1000);
}

/** The app's answer in "You ask": one of the question's answers, the same for the same seed. */
export function swapAnswerIndex(topic: SmallTalkTopic, pairIndex: number, seed: number): number {
  const indexes = topic.pairs[pairIndex].answers.map((_, i) => i);
  return shuffleArray(indexes, seed + pairIndex * 101 + 7)[0];
}

export interface SmallTalkJudgement {
  right: boolean;
  /** The index of the answer that was matched (the closest one when wrong); null in "You ask". */
  answer: number | null;
  match: SpokenMatch;
}

/** "The app asks": what the learner said or built, judged against every valid answer of the question. */
export function judgeAnswer(topic: SmallTalkTopic, pairIndex: number, text: string): SmallTalkJudgement {
  const answers = topic.pairs[pairIndex].answers;
  const match = matchSpoken(text, answers.map((a) => a.es), { lang: 'es' });
  return { right: match.right, answer: Math.max(0, answers.findIndex((a) => a.es === match.best)), match };
}

/** "You ask": the question the learner asked, judged against the question only. */
export function judgeQuestion(topic: SmallTalkTopic, pairIndex: number, text: string): SmallTalkJudgement {
  const match = matchSpoken(text, [topic.pairs[pairIndex].q.es], { lang: 'es' });
  return { right: match.right, answer: null, match };
}

export type SmallTalkPart = 'build' | 'asks' | 'swap';
export type SmallTalkStep = SmallTalkPart | 'summary';
export type SmallTalkScores = Record<SmallTalkPart, number>;

const PARTS: readonly SmallTalkPart[] = ['build', 'asks', 'swap'];

export interface SmallTalkState {
  /** The topic. */
  id: string;
  /** Seeds the word banks, the trap tiles and the app's answers, so they stay the same when the screen is left and resumed. */
  seed: number;
  step: SmallTalkStep;
  /** The item on screen inside the part (Build: the build item, "The app asks" / "You ask": the question). */
  index: number;
  /** The current question is answered (Next moves on); always false in Build. */
  done: boolean;
  /** How the finished question went (null while it is open and in Build). */
  right: boolean | null;
  /** The answer matched in "The app asks" (the closest one when wrong), null otherwise. */
  pick: number | null;
  /** Right per part. */
  scores: SmallTalkScores;
}

/** How many items the parts have (the totals of the summary). */
export function smalltalkTotals(topic: SmallTalkTopic): SmallTalkScores {
  return { build: buildItems(topic).length, asks: topic.pairs.length, swap: topic.pairs.length };
}

/** A fresh run of the topic. */
export function startSmallTalk(topic: SmallTalkTopic, seed: number): SmallTalkState {
  return { id: topic.id, seed, step: 'build', index: 0, done: false, right: null, pick: null, scores: { build: 0, asks: 0, swap: 0 } };
}

function nextPart(state: SmallTalkState): SmallTalkState {
  const step: SmallTalkStep = state.step === 'build' ? 'asks' : state.step === 'asks' ? 'swap' : 'summary';
  return { ...state, step, index: 0, done: false, right: null, pick: null };
}

/**
 * An answer: Build (the card's result, one try, on to the next item), "The app asks" / "You ask" (one try; the question is done,
 * right or wrong, and Next moves on). `pick` is the matched answer of "The app asks". Right is a point.
 */
export function answerSmallTalk(state: SmallTalkState, topic: SmallTalkTopic, right: boolean, pick: number | null = null): SmallTalkState {
  const step = state.step;
  if (state.done || step === 'summary') return state;
  const scores = right ? { ...state.scores, [step]: state.scores[step] + 1 } : state.scores;
  if (step === 'build') {
    const moved = { ...state, scores, index: state.index + 1 };
    return moved.index >= smalltalkTotals(topic).build ? nextPart(moved) : moved;
  }
  return { ...state, scores, done: true, right, pick: step === 'asks' ? pick : null };
}

/** Next: after a finished question, the next question or part. */
export function nextSmallTalk(state: SmallTalkState, topic: SmallTalkTopic): SmallTalkState {
  if (state.step === 'summary' || state.step === 'build' || !state.done) return state;
  return state.index + 1 < smalltalkTotals(topic)[state.step] ? { ...state, index: state.index + 1, done: false, right: null, pick: null } : nextPart(state);
}

/** What goes into the resume store. */
export function savedSmallTalk(state: SmallTalkState): unknown {
  return { v: 1, ...state };
}

const isCount = (x: unknown, max = Infinity): x is number => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= max;

/** A saved run back, or null when it is broken, is of another topic, or does not fit the topic any more. */
export function parseSmallTalk(raw: unknown, topics: readonly SmallTalkTopic[]): SmallTalkState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const topic = topics.find((x) => x.id === r.id);
  if (!topic || r.v !== 1 || !Number.isInteger(r.seed) || typeof r.done !== 'boolean') return null;
  const step = PARTS.find((p) => p === r.step);
  if (!step) return null;
  const totals = smalltalkTotals(topic);
  if (!isCount(r.index, totals[step] - 1)) return null;
  const sc = r.scores as Partial<Record<SmallTalkPart, unknown>> | null;
  if (typeof sc !== 'object' || sc === null || !PARTS.every((p) => isCount(sc[p], totals[p]))) return null;
  if (step === 'build') {
    if (r.done || r.right !== null || r.pick !== null) return null;
  } else if (r.done) {
    if (typeof r.right !== 'boolean') return null;
    if (step === 'asks' ? !isCount(r.pick, topic.pairs[r.index as number].answers.length - 1) : r.pick !== null) return null;
  } else if (r.right !== null || r.pick !== null) return null;
  return { id: topic.id, seed: r.seed as number, step, index: r.index as number, done: r.done, right: r.right as boolean | null, pick: r.pick as number | null, scores: sc as SmallTalkScores };
}
