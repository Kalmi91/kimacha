// The Practice tab's reading round (spec HAROM-JATEK.md 5, Kálmán 2026-10-12): five short sentences as one
// paragraph, each with one due word, then one question per sentence. Pure logic, no I/O: the screen supplies
// the cards and the lookups.
//
// Words: the due learned words, the longest overdue first; when there are too few, the freshly learned ones
// (lib/practice/gapFill.ts practiceCandidates). Sentence = the word's own example sentence, and only one whose
// every word the learner knows, by the same "never an unknown word in a sentence" gate as the Sentences tab
// (lib/knownSentence.ts). A word without such a sentence is left out and the next word comes.
//
// Questions: "what does X mean in the text" (the right meaning + two meanings of other known words, the same
// part of speech where possible) and true/false (an English statement: the translation of one of the text's
// sentences = true, the translation of another known sentence that is not in the text = false).
//
// Stories (FB526, lib/practice/stories.ts): the text is first a ready-made five-sentence story the learner fully knows
// (the one with the most due words); its false statements come from the story's own `false_<source language>`, in order,
// each once (then a true one). Without such a story the text is built as above. The story's bridges (FB551, linking sentences
// with no word and no question) sit between its sentences in `ReadingSet.segments`.

import type { PcicItem, PcicTarget } from '@/data/pcic';
import { isSentenceKnownIn, knownTokens, type ResolvedTense } from '@/lib/knownSentence';
import { learnedEntries, learnedEntryOf, learnerLevel, sentenceLevel, sentencePair } from '@/lib/sentenceCards';
import type { DeLevel } from '@/lib/deForms';
import { activeSourceFor } from '@/lib/languagePair';
import { wordIn } from '@/lib/pcicItemText';
import type { Sm2Card } from '@/lib/sm2';
import { gapTaskFor, practiceCandidates, type GapSourceInfo, type GapTask } from './gapFill';
import { bridgesIn, falseIn, pickStory, type Story } from './stories';

/** The text holds this many sentences (and the round this many questions: one per sentence). */
export const READING_WORDS = 5;
/** Fewer sentences than this make no reading: the screen shows the empty state. */
export const READING_MIN_WORDS = 3;
/** Looking for sentences stops after this many usable words (in due order): the check runs on every candidate otherwise. */
export const READING_MAX_USABLE = 60;
/** Grammar and function-word buckets (data/words-open/topics-a1.json): their words share no subject, so they only come when no real topic has READING_MIN_WORDS usable words. */
export const BUCKET_TOPICS: ReadonlySet<string> = new Set([
  'numbers', 'common_adjectives', 'personal_info', 'basic_verbs', 'present_simple', 'survival_needs', 'prepositions',
]);
/** A meaning question offers the right meaning plus this many others. */
const MEANING_DISTRACTORS = 2;

/** One sentence of the text: the due word as written in it (highlighted) and the whole sentence. */
export interface ReadingWord extends GapTask {
  sentence: string;
}

// What is saved in the round (lib/practice/practiceRound.ts): ids only, the texts come from the corpus.
export type ReadingQuestion =
  /** `options` = card ids in display order, `itemId` is the word asked (the right option). */
  | { kind: 'meaning'; itemId: string; options: string[] }
  /** The statement is the source-language sentence of card `sourceId`; true when that card is one of the text's words. */
  | { kind: 'truefalse'; sourceId: string }
  /** A false statement of the round's story: `index` into its false statements in the learner's language (`story.false_en` ...). */
  | { kind: 'storyfalse'; index: number };

export type ResolvedQuestion =
  /** `word` as written in the text; `options` are meanings. */
  | { kind: 'meaning'; word: string; options: string[]; correct: number }
  /** `correct` = 0 when the statement is true (True is the first option), 1 when it is false. */
  | { kind: 'truefalse'; statement: string; truth: boolean; correct: number };

/** One piece of the text in reading order: the sentence of word `index` of `words`, or a bridge (FB551: a linking sentence of a story, no word, no question). */
export type ReadingSegment = { kind: 'word'; index: number } | { kind: 'bridge'; text: string };

export interface ReadingSet {
  words: ReadingWord[];
  /** The text in reading order: every word's sentence, with the story's bridges between them. */
  segments: ReadingSegment[];
  questions: ReadingQuestion[];
  resolved: ResolvedQuestion[];
  /** The story the text is (lib/practice/stories.ts), absent for a text of example sentences. */
  storyId?: string;
}

export interface ReadingDeps {
  target: PcicTarget;
  /** Every card of the deck. */
  cards: Sm2Card[];
  /** The tenses unlocked by the grammar lessons (only matters with Spanish as the target language). */
  tenses?: ReadonlySet<ResolvedTense>;
  findItem: (id: string) => PcicItem | undefined;
  /** The deck level of an item (German only: the learner's grammar level decides which tenses a sentence may use). */
  levelOf?: (id: string) => string | undefined;
  today: string;
  info?: (itemId: string) => GapSourceInfo | undefined;
  /** Card ids of the round this one replaces: they go to the end of the candidates (kept, not dropped), so a new round differs. */
  avoid?: ReadonlySet<string>;
  /** The story of the round this one replaces: it goes last among the stories, so a new round differs. */
  avoidStory?: string;
  /** For tests: a deterministic [0, 1) source. */
  random?: () => number;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The meaning shown for a word: the source-language side of the card. */
export function meaningOf(item: PcicItem, target: PcicTarget): string {
  return (wordIn(item, activeSourceFor(target)) ?? '').trim();
}

/** The reading entry of one word, or null when it has no usable example sentence. */
export function readingWordFor(
  item: PcicItem,
  target: PcicTarget,
  info?: (itemId: string) => GapSourceInfo | undefined,
): ReadingWord | null {
  const task = gapTaskFor(item, target, info);
  return task ? { ...task, sentence: `${task.before}${task.answer}${task.after}` } : null;
}

function shuffled<T>(list: readonly T[], random: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** German: the level a sentence of `itemId` is held to (the learner's, never above its card's own); other targets have no such level. */
export function readingLevelFor(deps: Pick<ReadingDeps, 'target' | 'cards' | 'levelOf'>): (itemId: string) => DeLevel | undefined {
  if (deps.target !== 'de') return () => undefined;
  const learner = learnerLevel(deps.cards, deps.levelOf);
  return (itemId) => sentenceLevel(learner, itemId, deps.levelOf);
}

/** The words of the text: see the header. `known` = the gate's token set of the learner's learned words. */
export function pickReadingWords(deps: ReadingDeps, known: ReadonlySet<string>): ReadingWord[] {
  const seen = new Set<string>();
  const out: ReadingWord[] = [];
  const levelFor = readingLevelFor(deps);
  // The cards do not change between two rounds (a reading gives no progress), so without this the same words
  // would come again: the previous round's words go last, and only fill up when there are too few other ones.
  const candidates = practiceCandidates(deps.cards, deps.today);
  const avoid = deps.avoid;
  const ordered = avoid && avoid.size > 0 ? [...candidates.filter((c) => !avoid.has(c.itemId)), ...candidates.filter((c) => avoid.has(c.itemId))] : candidates;
  // The usable words (a sentence the learner fully knows, the same sentence once) in candidate order, each with its topic.
  const usable: { word: ReadingWord; topic: string; avoided: boolean }[] = [];
  for (const card of ordered) {
    const item = deps.findItem(card.itemId);
    const word = item ? readingWordFor(item, deps.target, deps.info) : null;
    if (!word || !isSentenceKnownIn(word.sentence, deps.target, known, levelFor(card.itemId))) continue;
    // the same sentence under two words counts once
    const key = word.sentence.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    usable.push({ word, topic: item?.topic ?? '', avoided: !!avoid?.has(card.itemId) });
    if (usable.length >= READING_MAX_USABLE) break;
  }
  // One topic (E102, FB551): the topic with the most due words gives the text, so its sentences belong together;
  // the next topics (same ranking) fill the text up to READING_WORDS. Words of the previous
  // round do not count for the ranking. Cards with no topic form one group, i.e. the plain candidate order.
  const groups = new Map<string, { first: number; fresh: number; words: ReadingWord[] }>();
  usable.forEach((u, i) => {
    const g = groups.get(u.topic) ?? { first: i, fresh: 0, words: [] };
    if (!u.avoided) g.fresh++;
    g.words.push(u.word);
    groups.set(u.topic, g);
  });
  // Real topics with enough words first, then the small real topics, the buckets last; each by fresh count, then due order.
  const tier = ([topic, g]: [string, { words: ReadingWord[] }]) => (BUCKET_TOPICS.has(topic) ? 2 : g.words.length >= READING_MIN_WORDS ? 0 : 1);
  const ranked = [...groups.entries()]
    .sort((a, b) => tier(a) - tier(b) || b[1].fresh - a[1].fresh || a[1].first - b[1].first)
    .map(([, g]) => g);
  for (const g of ranked) {
    for (const w of g.words) {
      if (out.length >= READING_WORDS) break;
      out.push(w);
    }
    if (out.length >= READING_WORDS) break;
  }
  return out;
}

// The meaning options of one word: other known words' meanings, never the same text as the right one or as
// each other; the other words of the text are the last choice, a different part of speech the second to last.
function meaningOptions(word: ReadingWord, pool: PcicItem[], words: ReadingWord[], deps: ReadingDeps, random: () => number): string[] | null {
  const own = deps.findItem(word.itemId);
  if (!own) return null;
  const inText = new Set(words.map((w) => w.itemId));
  const taken = [word.meaning];
  const picks: string[] = [];
  const ranked = shuffled(pool, random)
    .filter((item) => item.id !== word.itemId)
    .map((item) => ({ item, rank: (inText.has(item.id) ? 2 : 0) + (own.pos && item.pos === own.pos ? 0 : 1) }))
    .sort((a, b) => a.rank - b.rank);
  for (const { item } of ranked) {
    const meaning = meaningOf(item, deps.target);
    if (!meaning || taken.some((m) => same(m, meaning))) continue;
    taken.push(meaning);
    picks.push(item.id);
    if (picks.length >= MEANING_DISTRACTORS) break;
  }
  if (picks.length < MEANING_DISTRACTORS) return null;
  return shuffled([word.itemId, ...picks], random);
}

/**
 * One question per word: meaning and true/false alternate (meaning, true/false, meaning, ...), the words in a
 * random order, and the true/false ones are half true, half false. A meaning question without enough other
 * known words, or a false statement without another known sentence, falls back to a true statement. With a story the
 * false statements are the story's own `false_<source language>`, in order, each once (then a true statement).
 */
export function buildQuestions(words: ReadingWord[], deps: ReadingDeps, known: ReadonlySet<string>, story?: Story): ReadingQuestion[] {
  const random = deps.random ?? Math.random;
  const pool = learnedEntryItems(deps);
  const inText = new Set(words.map((w) => w.itemId));
  const sentencesInText = new Set(words.map((w) => w.sentence.trim().toLowerCase()));
  const translationsInText = words.map((w) => w.translation);
  const levelFor = readingLevelFor(deps);

  // other known sentences that are not in the text (each statement once), in random order
  const falseSeen = new Set<string>();
  const falsePool = story ? [] : shuffled(pool, random).filter((item) => {
    if (inText.has(item.id)) return false;
    const pair = sentencePair(item, deps.target);
    if (!pair || sentencesInText.has(pair.target.trim().toLowerCase())) return false;
    if (translationsInText.some((t) => same(t, pair.source)) || falseSeen.has(pair.source.trim().toLowerCase())) return false;
    if (!isSentenceKnownIn(pair.target, deps.target, known, levelFor(item.id))) return false;
    falseSeen.add(pair.source.trim().toLowerCase());
    return true;
  });

  const kinds = words.map((_, i) => (i % 2 === 0 ? 'meaning' : 'truefalse'));
  const slots = kinds.filter((k) => k === 'truefalse').length;
  // at least one true and one false statement when there are two or more
  const truths = shuffled(Array.from({ length: slots }, (_, i) => i % 2 === 0), random);
  let nextTruth = 0;
  let nextStoryFalse = 0;
  const storyFalse = story ? falseIn(story, activeSourceFor(deps.target)) : [];

  return shuffled(words, random).map((word, i): ReadingQuestion => {
    if (kinds[i] === 'meaning') {
      const options = meaningOptions(word, pool, words, deps, random);
      if (options) return { kind: 'meaning', itemId: word.itemId, options };
    } else if (!truths[nextTruth++]) {
      if (story) {
        if (nextStoryFalse < storyFalse.length) return { kind: 'storyfalse', index: nextStoryFalse++ };
      } else {
        const fake = falsePool.shift();
        if (fake) return { kind: 'truefalse', sourceId: fake.id };
      }
    }
    return { kind: 'truefalse', sourceId: word.itemId };
  });
}

// The items of the learner's learned words (the pool of distractors and false statements).
function learnedEntryItems(deps: ReadingDeps): PcicItem[] {
  const out: PcicItem[] = [];
  for (const card of deps.cards) {
    if (!learnedEntryOf(card, deps.target, deps.findItem)) continue;
    const item = deps.findItem(card.itemId);
    if (item) out.push(item);
  }
  return out;
}

/** The text of a round: the sentence of every word in order, each followed by the bridges of the story placed after it. */
export function readingSegments(words: ReadingWord[], target: PcicTarget, story?: Story): ReadingSegment[] {
  const bridges = story ? bridgesIn(story, target) : [];
  return words.flatMap((_, index): ReadingSegment[] => [
    { kind: 'word', index },
    ...bridges.filter((b) => b.after === index).map((b): ReadingSegment => ({ kind: 'bridge', text: b.text })),
  ]);
}

/** The texts of the questions, or null when a card of the round is gone from the corpus (a saved round then starts over). */
export function resolveSet(
  words: ReadingWord[],
  questions: ReadingQuestion[],
  findItem: (id: string) => PcicItem | undefined,
  target: PcicTarget,
  story?: Story,
): ReadingSet | null {
  const resolved: ResolvedQuestion[] = [];
  for (const q of questions) {
    if (q.kind === 'meaning') {
      const word = words.find((w) => w.itemId === q.itemId);
      const items = q.options.map((id) => findItem(id));
      const correct = q.options.indexOf(q.itemId);
      if (!word || correct === -1 || items.some((it) => !it)) return null;
      resolved.push({ kind: 'meaning', word: word.answer, options: items.map((it) => meaningOf(it!, target)), correct });
    } else if (q.kind === 'storyfalse') {
      const statement = story ? falseIn(story, activeSourceFor(target))[q.index] : undefined;
      if (!statement) return null;
      resolved.push({ kind: 'truefalse', statement, truth: false, correct: 1 });
    } else {
      // a statement of the text is the translation of that word's sentence (the same as the card's own sentence pair)
      const inText = words.find((w) => w.itemId === q.sourceId);
      if (inText) {
        resolved.push({ kind: 'truefalse', statement: inText.translation, truth: true, correct: 0 });
        continue;
      }
      const item = findItem(q.sourceId);
      const pair = item ? sentencePair(item, target) : null;
      if (!pair) return null;
      resolved.push({ kind: 'truefalse', statement: pair.source, truth: false, correct: 1 });
    }
  }
  const segments = readingSegments(words, target, story);
  return story ? { words, segments, questions, resolved, storyId: story.id } : { words, segments, questions, resolved };
}

/** The whole round, or null when fewer than READING_MIN_WORDS sentences can be made (the empty state). */
export function buildReadingSet(deps: ReadingDeps): ReadingSet | null {
  const known = knownTokens(deps.target, {
    learned: learnedEntries(deps.cards, deps.target, deps.findItem),
    tenses: deps.tenses,
    level: deps.target === 'de' ? learnerLevel(deps.cards, deps.levelOf) : undefined,
  });
  const picked = pickStory(deps, known);
  if (picked) {
    const set = resolveSet(picked.words, buildQuestions(picked.words, deps, known, picked.story), deps.findItem, deps.target, picked.story);
    if (set) return set;
  }
  const words = pickReadingWords(deps, known);
  if (words.length < READING_MIN_WORDS) return null;
  return resolveSet(words, buildQuestions(words, deps, known), deps.findItem, deps.target);
}
