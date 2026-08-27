// GAMES.md 4.10 (F5, ccat). "Ahol a ccat és az odd-one-out ugyanazt csinálja,
// OSZD MEG a motort, ne másold", this module is the CCAT-lite item-type
// library: two item types (kakukktojás, mondat-kiegészítés) are thin
// wrappers around the ALREADY-EXISTING oddOneOut.ts / grammarChoice.ts
// engines, not reimplementations. K17: no spatial/shape items, so every
// item type here is vocabulary- or logic-based, matching GAMES.md 0.
//
// Each builder is a pure function (pool/content in, item or null out), the
// screen (app/games/ccat.tsx) owns sequencing/mixing across item types and
// all localization, the same split as oddOneOut.ts/wordRain.ts/bubblePop.ts.

import { shuffleArray, mulberry32, hashString } from '../shuffle';
import { pickDistractors } from './distract';
import type { PoolEntry } from './vocabPool';
import { buildOddOneOutRound, type OddCategorySet, type OddRound, type OddWordMeta } from './oddOneOut';
import { buildGrammarRound, type GrammarRoundItem } from './grammarChoice';
import {
  getGrammarTopics,
  getCcatAntonyms,
  getCcatSynonyms,
  getCcatWordProblems,
  type GrammarTopicData,
  type CcatWordPairItem,
  type CcatWordProblemItem,
} from './content';
import type { WordGender } from '@/data/words';

export type CcatItemKind =
  | 'analogy'
  | 'antonym'
  | 'synonym'
  | 'oddOneOut'
  | 'sentenceFill'
  | 'anagram'
  | 'numberSeries'
  | 'wordProblem'
  | 'instruction';

export const CCAT_KINDS: CcatItemKind[] = [
  'analogy', 'antonym', 'synonym', 'oddOneOut', 'sentenceFill', 'anagram', 'numberSeries', 'wordProblem', 'instruction',
];

export interface CcatAnalogyItem {
  kind: 'analogy';
  a: string;
  b: string;
  c: string;
  options: string[];
  correctIndex: number; // the "d" that completes a:b :: c:d
}

export interface CcatPairItem {
  kind: 'antonym' | 'synonym';
  word: string;
  options: string[];
  correctIndex: number;
}

export interface CcatOddOneOutItem {
  kind: 'oddOneOut';
  round: OddRound;
}

export interface CcatSentenceFillItem {
  kind: 'sentenceFill';
  topic: GrammarTopicData;
  round: GrammarRoundItem;
}

export interface CcatAnagramItem {
  kind: 'anagram';
  wordId: number;
  scrambled: string;
  options: string[];
  correctIndex: number;
}

export interface CcatNumberSeriesItem {
  kind: 'numberSeries';
  sequence: string[]; // 3 shown terms
  options: string[];
  correctIndex: number;
}

export interface CcatWordProblemItemRound {
  kind: 'wordProblem';
  item: CcatWordProblemItem;
  options: string[];
  correctIndex: number;
}

export interface CcatInstructionItem {
  kind: 'instruction';
  topicId: string;
  gender: WordGender;
  options: { wordId: number; learned: string }[];
  correctIndex: number;
}

export type CcatItem =
  | CcatAnalogyItem
  | CcatPairItem
  | CcatOddOneOutItem
  | CcatSentenceFillItem
  | CcatAnagramItem
  | CcatNumberSeriesItem
  | CcatWordProblemItemRound
  | CcatInstructionItem;

// ---------------------------------------------------------------------------
// antonym / synonym / analogy (authored pairs, data/games/ccat/<lang>/)
// ---------------------------------------------------------------------------

function buildPairItem(kind: 'antonym' | 'synonym', lang: string, seed: number): CcatPairItem | null {
  const list = kind === 'antonym' ? getCcatAntonyms(lang) : getCcatSynonyms(lang);
  if (list.length === 0) return null;
  const item = shuffleArray(list, seed)[0];
  const options = shuffleArray([item.correct, ...item.distractors], seed + 1);
  return { kind, word: item.word, options, correctIndex: options.indexOf(item.correct) };
}

export function buildAntonymItem(lang: string, seed: number): CcatPairItem | null {
  return buildPairItem('antonym', lang, seed);
}

export function buildSynonymItem(lang: string, seed: number): CcatPairItem | null {
  return buildPairItem('synonym', lang, seed);
}

/**
 * Two pairs of the SAME relation (both antonym pairs, or both synonym pairs)
 * make a valid a:b :: c:d analogy, so this derives from the antonym/synonym
 * authored files instead of a third authored dataset (GAMES.md 4.10 table:
 * "Analógia | ... | authored párok + pool").
 */
export function buildAnalogyItem(lang: string, seed: number): CcatAnalogyItem | null {
  const rng = mulberry32(seed);
  const useAntonyms = rng() < 0.5;
  const list: CcatWordPairItem[] = useAntonyms ? getCcatAntonyms(lang) : getCcatSynonyms(lang);
  if (list.length < 2) return null;
  const [first, second] = shuffleArray(list, seed + 1);

  // Distractors come from the FIRST pair's own curated filler words (never
  // a/b/c themselves, which would look like a duplicated-option glitch), then
  // deduped against the correct answer AND against a/b/c (a filler word can
  // coincidentally be some OTHER pair's own "word"/"correct", e.g. "ganar" is
  // a filler in "largo-corto" but is "c" when the other pair is "ganar-perder").
  const exclude = new Set([first.word, first.correct, second.word]);
  const raw = [second.correct, ...first.distractors];
  const options: string[] = [];
  for (const w of raw) {
    if (exclude.has(w) && w !== second.correct) continue;
    if (!options.includes(w)) options.push(w);
    if (options.length === 4) break;
  }
  if (options.length < 3) return null;

  const shuffled = shuffleArray(options, seed + 2);
  return { kind: 'analogy', a: first.word, b: first.correct, c: second.word, options: shuffled, correctIndex: shuffled.indexOf(second.correct) };
}

// ---------------------------------------------------------------------------
// kakukktojás, reuses oddOneOut.ts directly, no second implementation.
// ---------------------------------------------------------------------------

const ODD_CATEGORY_SETS: OddCategorySet[] = ['topic', 'pos', 'gender'];

export function buildCcatOddOneOut(pool: OddWordMeta[], seed: number): CcatOddOneOutItem | null {
  for (let attempt = 0; attempt < 6; attempt++) {
    const set = ODD_CATEGORY_SETS[hashString(`ccat-odd:${seed}:${attempt}`) % ODD_CATEGORY_SETS.length];
    const round = buildOddOneOutRound(pool, set, seed + attempt);
    if (round) return { kind: 'oddOneOut', round };
  }
  return null;
}

// ---------------------------------------------------------------------------
// mondat-kiegészítés, reuses grammarChoice.ts's existing topics directly.
// ---------------------------------------------------------------------------

export function buildSentenceFillItem(lang: string, seed: number): CcatSentenceFillItem | null {
  const topics = getGrammarTopics(lang);
  if (topics.length === 0) return null;
  const topic = shuffleArray(topics, seed)[0];
  const round = buildGrammarRound(topic, seed + 1);
  if (round.length === 0) return null;
  return { kind: 'sentenceFill', topic, round: round[0] };
}

// ---------------------------------------------------------------------------
// betűkeverék (anagram), generated straight from the pool.
// ---------------------------------------------------------------------------

function scrambleWord(word: string, seed: number): string {
  const rng = mulberry32(seed);
  const letters = word.split('');
  for (let attempt = 0; attempt < 8; attempt++) {
    const shuffled = letters.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const result = shuffled.join('');
    if (result !== word) return result;
  }
  return letters.slice().reverse().join('');
}

export function buildAnagramItem(pool: PoolEntry[], learnedLang: string, seed: number): CcatAnagramItem | null {
  const candidates = pool.filter((p) => p.learned && !p.learned.includes(' ') && p.learned.length >= 4);
  if (candidates.length < 4) return null;
  const target = shuffleArray(candidates, seed)[0];
  const scrambled = scrambleWord(target.learned.toLowerCase(), seed + 1);
  const distractors = pickDistractors(target.learned, pool, { lang: learnedLang, count: 3, seed: seed + 2 });
  if (distractors.length < 3) return null;
  const options = shuffleArray([target.learned, ...distractors], seed + 3);
  return { kind: 'anagram', wordId: target.wordId, scrambled, options, correctIndex: options.indexOf(target.learned) };
}

// ---------------------------------------------------------------------------
// számsor szóval, ES-only, built strictly from number words that actually
// have a card in the corpus (no invented number-word spellings, GAMES.md 0.).
// ---------------------------------------------------------------------------

const NUMBER_WORDS_ES: [number, string][] = [
  [2, 'dos'], [3, 'tres'], [5, 'cinco'], [6, 'seis'], [7, 'siete'], [8, 'ocho'], [9, 'nueve'], [10, 'diez'],
  [11, 'once'], [12, 'doce'], [13, 'trece'], [14, 'catorce'], [15, 'quince'], [16, 'dieciséis'], [17, 'diecisiete'], [18, 'dieciocho'],
  [20, 'veinte'], [30, 'treinta'], [40, 'cuarenta'], [50, 'cincuenta'], [60, 'sesenta'], [70, 'setenta'],
];

function numberSeriesRuns(available: Set<number>): number[][] {
  const runs: number[][] = [];
  const values = [...available].sort((a, b) => a - b);
  const valueSet = new Set(values);
  for (const step of [1, 10]) {
    for (const start of values) {
      const run = [start, start + step, start + step * 2, start + step * 3];
      if (run.every((v) => valueSet.has(v))) runs.push(run);
    }
  }
  return runs;
}

export function buildNumberSeriesItem(pool: PoolEntry[], learnedLang: string, seed: number): CcatNumberSeriesItem | null {
  if (learnedLang !== 'es') return null; // K18/4.10: number words are language-specific, ES only for now
  const known = new Map<number, string>();
  for (const p of pool) {
    const match = NUMBER_WORDS_ES.find(([, word]) => word === p.learned.toLowerCase());
    if (match) known.set(match[0], match[1]);
  }
  const runs = numberSeriesRuns(new Set(known.keys()));
  if (runs.length === 0) return null;
  const run = shuffleArray(runs, seed)[0];
  const sequence = run.slice(0, 3).map((v) => known.get(v)!);
  const correct = known.get(run[3])!;

  const otherNumbers = [...known.values()].filter((w) => !run.slice(0, 3).map((v) => known.get(v)).includes(w) && w !== correct);
  if (otherNumbers.length < 3) return null;
  const distractors = shuffleArray(otherNumbers, seed + 1).slice(0, 3);
  const options = shuffleArray([correct, ...distractors], seed + 2);
  return { kind: 'numberSeries', sequence, options, correctIndex: options.indexOf(correct) };
}

// ---------------------------------------------------------------------------
// szöveges feladat (word problem), authored templates, numbers baked in.
// ---------------------------------------------------------------------------

export function buildWordProblemItem(lang: string, seed: number): CcatWordProblemItemRound | null {
  const list = getCcatWordProblems(lang);
  if (list.length === 0) return null;
  const item = shuffleArray(list, seed)[0];
  const options = shuffleArray([item.answer, ...item.distractors], seed + 1).map(String);
  return { kind: 'wordProblem', item, options, correctIndex: options.indexOf(String(item.answer)) };
}

// ---------------------------------------------------------------------------
// utasítás-követés, a topic+gender conjunction from pool metadata (K6),
// "koppints arra, ami étel ÉS nőnemű" (GAMES.md 4.10).
// ---------------------------------------------------------------------------

const INSTRUCTION_GENDERS: WordGender[] = ['m', 'f'];

export function buildInstructionItem(pool: OddWordMeta[], seed: number, optionCount = 5): CcatInstructionItem | null {
  const nouns = pool.filter((p) => p.pos === 'noun' && p.topicId && p.gender && INSTRUCTION_GENDERS.includes(p.gender));
  if (nouns.length < optionCount) return null;

  const combos: { topicId: string; gender: WordGender }[] = [];
  const seen = new Set<string>();
  for (const n of nouns) {
    const key = `${n.topicId}:${n.gender}`;
    if (seen.has(key)) continue;
    seen.add(key);
    combos.push({ topicId: n.topicId!, gender: n.gender! });
  }

  // EXACTLY one match: with 2+ words satisfying "topic AND gender", the round
  // would have more than one right answer while only one option is marked
  // correct, i.e. a broken puzzle, not a harder one.
  const validCombos = combos.filter(({ topicId, gender }) => {
    const matching = nouns.filter((n) => n.topicId === topicId && n.gender === gender);
    const nonMatching = nouns.length - matching.length;
    return matching.length === 1 && nonMatching >= optionCount - 1;
  });
  if (validCombos.length === 0) return null;

  const { topicId, gender } = shuffleArray(validCombos, seed)[0];
  const matching = nouns.filter((n) => n.topicId === topicId && n.gender === gender);
  const nonMatching = nouns.filter((n) => !(n.topicId === topicId && n.gender === gender));
  const correct = matching[0];
  const wrong = shuffleArray(nonMatching, seed + 2).slice(0, optionCount - 1);
  const options = shuffleArray([correct, ...wrong], seed + 3);

  return {
    kind: 'instruction',
    topicId,
    gender,
    options: options.map((o) => ({ wordId: o.wordId, learned: o.learned })),
    correctIndex: options.findIndex((o) => o.wordId === correct.wordId),
  };
}
