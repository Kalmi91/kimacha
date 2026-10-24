// The Practice tab's reading stories (FB526, Kálmán 2026-10-23): a ready-made story of five connected sentences (one person,
// one situation, data/practice/stories*.json) instead of five unrelated example sentences. A story is offered only when the
// learner knows all of it: every sentence passes the same "never an unknown word in a sentence" gate as the Sentences tab
// (lib/knownSentence.ts) and the card of each sentence's word is learned. Of those, the story with the most due words wins
// (a tie: the data order), the story of the previous round goes last. Each target language has its own file (es stories.json,
// en stories-en.json, hu stories-hu.json): the sentence text is the target-language field, the translation and the true/false
// statements are the field of the learner's native language (the active source, lib/languagePair.ts). Without a usable story
// lib/practice/reading.ts builds the text from the due words' own example sentences. Pure logic, no I/O.

import type { PcicItem, PcicLevel, PcicTarget } from '@/data/pcic';
import storiesData from '@/data/practice/stories.json';
import storiesEnData from '@/data/practice/stories-en.json';
import storiesHuData from '@/data/practice/stories-hu.json';
import { isSentenceKnownIn } from '@/lib/knownSentence';
import { activeSourceFor, type Lang } from '@/lib/languagePair';
import { learnedEntryOf } from '@/lib/sentenceCards';
import { gapByWord, practiceCandidates } from './gapFill';
import { meaningOf, type ReadingDeps, type ReadingWord } from './reading';

/** One sentence of a story: its text per language, and the card it practises (`word`: `o<order>`, `e<id>` or `h<id>`) as written in the target-language text (`form`). */
export interface StorySentence {
  es?: string;
  en?: string;
  hu?: string;
  word: string;
  form: string;
}

export interface Story {
  id: string;
  level: PcicLevel;
  sentences: StorySentence[];
  /** Statements that are false for this story, in the language of the learner (the false answers of the true/false questions). */
  false_en?: string[];
  false_es?: string[];
  false_hu?: string[];
}

export const STORIES: Story[] = storiesData as Story[];

const STORIES_BY_TARGET: Record<PcicTarget, readonly Story[]> = { es: STORIES, en: storiesEnData as Story[], hu: storiesHuData as Story[] };

/** The stories of a target language (none when it has none). */
export function storiesFor(target: PcicTarget): readonly Story[] {
  return STORIES_BY_TARGET[target] ?? [];
}

/** The false statements of a story in the learner's language. */
export function falseIn(story: Story, lang: Lang): string[] {
  return story[`false_${lang}` as `false_${Lang}`] ?? [];
}

/** The reading words of a story, in order, or null when a card is gone, a `form` is not a whole word of its sentence, or a text is missing. */
export function storyWords(story: Story, findItem: (id: string) => PcicItem | undefined, target: PcicTarget = 'es'): ReadingWord[] | null {
  const source = activeSourceFor(target);
  const out: ReadingWord[] = [];
  for (const s of story.sentences) {
    const item = findItem(s.word);
    const text = s[target];
    const translation = s[source];
    const gap = item && text && translation ? gapByWord(text, s.form) : null;
    if (!item || !text || !translation || !gap) return null;
    out.push({
      itemId: item.id,
      before: gap.before,
      answer: gap.answer,
      after: gap.after,
      translation,
      meaning: meaningOf(item, target),
      sentence: text,
    });
  }
  return out;
}

/** The story of the round and its words, or null when there is none the learner fully knows (or the target has no stories). */
export function pickStory(deps: ReadingDeps, known: ReadonlySet<string>, stories: readonly Story[] = storiesFor(deps.target)): { story: Story; words: ReadingWord[] } | null {
  const target = deps.target;
  const cardOf = new Map(deps.cards.map((c) => [c.itemId, c]));
  const due = new Set(practiceCandidates(deps.cards, deps.today).map((c) => c.itemId));
  const usable: { story: Story; words: ReadingWord[]; score: number; index: number }[] = [];
  stories.forEach((story, index) => {
    if (!story.sentences.every((s) => isSentenceKnownIn(s[target] ?? '', target, known))) return;
    if (!story.sentences.every((s) => cardOf.has(s.word) && learnedEntryOf(cardOf.get(s.word)!, target, deps.findItem))) return;
    const words = storyWords(story, deps.findItem, target);
    if (words) usable.push({ story, words, score: words.filter((w) => due.has(w.itemId)).length, index });
  });
  const last = (u: { story: Story }) => (u.story.id === deps.avoidStory ? 1 : 0);
  usable.sort((a, b) => last(a) - last(b) || b.score - a.score || a.index - b.index);
  return usable[0] ? { story: usable[0].story, words: usable[0].words } : null;
}
