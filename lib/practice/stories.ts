// The Practice tab's reading stories (FB526, Kálmán 2026-10-23): a ready-made story of five connected sentences (one person,
// one situation, data/practice/stories.json) instead of five unrelated example sentences. A story is offered only when the
// learner knows all of it: every sentence passes the same "never an unknown word in a sentence" gate as the Sentences tab
// (lib/knownSentence.ts) and the card of each sentence's word is learned. Of those, the story with the most due words wins
// (a tie: the data order), the story of the previous round goes last. Spanish target only; without a usable story
// lib/practice/reading.ts builds the text from the due words' own example sentences. Pure logic, no I/O.

import type { PcicItem, PcicLevel } from '@/data/pcic';
import storiesData from '@/data/practice/stories.json';
import { isSentenceKnownIn } from '@/lib/knownSentence';
import { learnedEntryOf } from '@/lib/sentenceCards';
import { gapByWord, practiceCandidates } from './gapFill';
import { meaningOf, type ReadingDeps, type ReadingWord } from './reading';

/** One sentence of a story: the card it practises (`word`, an `o<order>` id) as written in the sentence (`form`). */
export interface StorySentence {
  es: string;
  en: string;
  word: string;
  form: string;
}

export interface Story {
  id: string;
  level: PcicLevel;
  sentences: StorySentence[];
  /** English statements that are false for this story (the false answers of the true/false questions). */
  false_en: string[];
}

export const STORIES: Story[] = storiesData as Story[];

/** The reading words of a story, in order, or null when a card is gone or a `form` is not a whole word of its sentence. */
export function storyWords(story: Story, findItem: (id: string) => PcicItem | undefined): ReadingWord[] | null {
  const out: ReadingWord[] = [];
  for (const s of story.sentences) {
    const item = findItem(s.word);
    const gap = item ? gapByWord(s.es, s.form) : null;
    if (!item || !gap) return null;
    out.push({
      itemId: item.id,
      before: gap.before,
      answer: gap.answer,
      after: gap.after,
      translation: s.en,
      meaning: meaningOf(item, 'es'),
      sentence: s.es,
    });
  }
  return out;
}

/** The story of the round and its words, or null when there is none the learner fully knows (or the target is not Spanish). */
export function pickStory(deps: ReadingDeps, known: ReadonlySet<string>, stories: readonly Story[] = STORIES): { story: Story; words: ReadingWord[] } | null {
  if (deps.target !== 'es') return null;
  const cardOf = new Map(deps.cards.map((c) => [c.itemId, c]));
  const due = new Set(practiceCandidates(deps.cards, deps.today).map((c) => c.itemId));
  const usable: { story: Story; words: ReadingWord[]; score: number; index: number }[] = [];
  stories.forEach((story, index) => {
    if (!story.sentences.every((s) => isSentenceKnownIn(s.es, 'es', known))) return;
    if (!story.sentences.every((s) => cardOf.has(s.word) && learnedEntryOf(cardOf.get(s.word)!, 'es', deps.findItem))) return;
    const words = storyWords(story, deps.findItem);
    if (words) usable.push({ story, words, score: words.filter((w) => due.has(w.itemId)).length, index });
  });
  const last = (u: { story: Story }) => (u.story.id === deps.avoidStory ? 1 : 0);
  usable.sort((a, b) => last(a) - last(b) || b.score - a.score || a.index - b.index);
  return usable[0] ? { story: usable[0].story, words: usable[0].words } : null;
}
