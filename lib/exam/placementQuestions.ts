// The placement test questions. They measure words AND grammar: the word comes from the level's
// words-open cards (the question is the target-language word, the answer the source-language meaning, one of
// four), the grammar from the gap-sentence items of the level's grammar lessons (lib/exam/grammarItems.ts),
// whether or not the lessons are DONE. A word question has no sentence (north star: never a sentence with an
// unknown word); the lesson's sentences are the lesson's own audited items. Pure module: the caller supplies the data.

import { PCIC_LEVELS, pcicItemsForLevel, type PcicItem, type PcicLevel, type PcicTarget } from '@/data/pcic';
import { hasLesson, syllabusForLevel } from '@/lib/grammar/syllabus';
import { hashString, shuffleArray, shuffleOptions } from '@/lib/shuffle';
import { gapSourcesForLevel, type GapSource } from './grammarItems';

/** The order of one step (5 questions): word, grammar, word, grammar, word. */
export const PLACEMENT_PATTERN = ['word', 'gap', 'word', 'gap', 'word'] as const;
type PlacementKind = (typeof PLACEMENT_PATTERN)[number];

/** Word question: the answer options (4) are source-language meanings. */
export interface PlacementWordQuestion {
  kind: 'word';
  level: PcicLevel;
  itemId: string;
  word: string;
  options: string[];
  correctIndex: number;
}

/** Grammar question: a gap sentence, from a lesson item. */
export interface PlacementGapQuestion {
  kind: 'gap';
  level: PcicLevel;
  topicId: string;
  itemId: string;
  sentence: string;
  options: string[];
  correctIndex: number;
}

export type PlacementQuestion = PlacementWordQuestion | PlacementGapQuestion;

/** The question pool of one level. */
export interface PlacementPool {
  items: PcicItem[];
  gaps: GapSource[];
}

const WORD_OPTIONS = 4;

export function placementQuestionKey(q: PlacementQuestion): string {
  return q.kind === 'word' ? `w:${q.itemId}` : `g:${q.topicId}:${q.itemId}`;
}

/** The measurable levels: those with word data in the active direction (the caller calls `setPcicTarget` first). */
export function placementLevels(): PcicLevel[] {
  return PCIC_LEVELS.filter((level) => pcicItemsForLevel(level).length > 0);
}

/** The pool of one level for the active direction: the level's words + the gap items of EVERY written grammar lesson. */
export function placementPoolFor(level: PcicLevel, target: PcicTarget): PlacementPool {
  const topicIds = syllabusForLevel(level, target)
    .map((topic) => topic.id)
    .filter((id) => hasLesson(target, id));
  return { items: pcicItemsForLevel(level), gaps: gapSourcesForLevel(level, target, topicIds) };
}

const norm = (text: string) => text.trim().toLowerCase();

interface WordSides {
  /** The word asked (target language). */
  word: string;
  /** The right answer (source-language meaning). */
  meaning: string;
}

function sidesOf(item: PcicItem, target: PcicTarget): WordSides | undefined {
  const word = (target === 'es' ? item.es : item.en)?.split(' / ')[0]?.trim();
  const meaning = (target === 'es' ? item.en : item.es)?.trim();
  return word && meaning ? { word, meaning } : undefined;
}

function wordQuestion(level: PcicLevel, item: PcicItem, items: PcicItem[], target: PcicTarget, seed: number): PlacementWordQuestion | undefined {
  const own = sidesOf(item, target);
  if (!own) return undefined;
  // Traps: a different meaning, same part of speech first (more plausible), but the text must not be the same as the asked word or the
  // right answer (a same-spelling word / synonym candidate = two right answers).
  const taken = new Set([norm(own.meaning)]);
  // The meaning of another word with the same spelling would also be a right answer: it is no trap either.
  for (const other of items) {
    const sides = sidesOf(other, target);
    if (sides && norm(sides.word) === norm(own.word)) taken.add(norm(sides.meaning));
  }
  const candidates = shuffleArray(
    items.filter((other) => other.id !== item.id),
    hashString(`wd:${seed}:${item.id}`),
  );
  const samePos = candidates.filter((other) => item.pos && other.pos === item.pos);
  const rest = candidates.filter((other) => !(item.pos && other.pos === item.pos));
  const distractors: string[] = [];
  for (const other of [...samePos, ...rest]) {
    if (distractors.length >= WORD_OPTIONS - 1) break;
    const sides = sidesOf(other, target);
    if (!sides || norm(sides.word) === norm(own.word) || taken.has(norm(sides.meaning))) continue;
    taken.add(norm(sides.meaning));
    distractors.push(sides.meaning);
  }
  if (distractors.length < WORD_OPTIONS - 1) return undefined;
  const { options, correctIndex } = shuffleOptions([own.meaning, ...distractors], 0, hashString(`wo:${seed}:${item.id}`));
  return { kind: 'word', level, itemId: item.id, word: own.word, options, correctIndex };
}

function gapQuestion(level: PcicLevel, gap: GapSource, seed: number): PlacementGapQuestion {
  const { options, correctIndex } = shuffleOptions(gap.options, gap.correct, hashString(`gp:${seed}:${gap.topicId}:${gap.itemId}`));
  return { kind: 'gap', level, topicId: gap.topicId, itemId: gap.itemId, sentence: gap.sentence, options, correctIndex };
}

interface BuildPlacementInput {
  level: PcicLevel;
  /** The position of the question within the step (0..4): PLACEMENT_PATTERN decides the kind. */
  position: number;
  target: PcicTarget;
  pool: PlacementPool;
  /** Questions already asked (placementQuestionKey), so that the same one does not come twice. */
  used: ReadonlySet<string>;
  seed: number;
}

/**
 * The next question. If the pool of the requested kind has run out (e.g. no lesson is written
 * for the level), it takes one of the other kind; if both have run out, `undefined`.
 */
export function buildPlacementQuestion(input: BuildPlacementInput): PlacementQuestion | undefined {
  const { level, position, target, pool, used, seed } = input;
  const wanted: PlacementKind = PLACEMENT_PATTERN[position % PLACEMENT_PATTERN.length];
  const salt = `${seed}:${level}:${used.size}`;

  const nextWord = (): PlacementWordQuestion | undefined => {
    for (const item of shuffleArray(pool.items, hashString(`pw:${salt}`))) {
      if (used.has(`w:${item.id}`)) continue;
      const q = wordQuestion(level, item, pool.items, target, seed);
      if (q) return q;
    }
    return undefined;
  };
  const nextGap = (): PlacementGapQuestion | undefined => {
    const gap = shuffleArray(pool.gaps, hashString(`pg:${salt}`)).find((g) => !used.has(`g:${g.topicId}:${g.itemId}`));
    return gap ? gapQuestion(level, gap, seed) : undefined;
  };

  return wanted === 'word' ? (nextWord() ?? nextGap()) : (nextGap() ?? nextWord());
}
