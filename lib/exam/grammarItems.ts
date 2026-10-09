// The exam's grammar items come from the gap-sentence items of the level's FINISHED lessons.
// The lesson itself teaches its words (glossary + the corpus audit), so we do not filter a lesson item
// through the learned-word gate, as we do with the word example sentence (lib/exam/builder.ts): the
// learner practised on exactly these sentences, and the gate rests on the lessons' vocabulary
// (data/words), not on the 150 cards of words-open.

import {
  isDictationItem,
  isFormItem,
  isMarkItem,
  isMatchItem,
  isOrderItem,
  isSpotItem,
  isTransformItem,
  isWhyItem,
  type GrammarGapItem,
  type GrammarItem,
} from '@/lib/games/content';
import { lessonFor } from '@/lib/grammar/syllabus';
import { filterVosotros } from '@/lib/grammar/vosotros';
import type { PcicLevel } from '@/data/pcic';
import { doneLessonsOfLevel } from './unlock';

export interface GapSource {
  topicId: string;
  itemId: string;
  sentence: string;
  options: string[];
  correct: number;
}

function isGapChoice(item: GrammarItem): item is GrammarGapItem {
  return (
    !isMarkItem(item) &&
    !isMatchItem(item) &&
    !isFormItem(item) &&
    !isWhyItem(item) &&
    !isTransformItem(item) &&
    !isSpotItem(item) &&
    !isOrderItem(item) &&
    !isDictationItem(item)
  );
}

/** Gap items of the level's finished lessons (without the vosotros items, as in the lesson round). */
export function gapSourcesForLevel(level: PcicLevel, lang: string, doneTopicIds: Iterable<string>): GapSource[] {
  const out: GapSource[] = [];
  for (const topicId of doneLessonsOfLevel(level, lang, doneTopicIds)) {
    const lesson = lessonFor(lang, topicId);
    if (!lesson) continue;
    for (const item of filterVosotros(lesson.items as GrammarItem[])) {
      if (!isGapChoice(item) || !item.sentence?.includes('___') || item.options.length < 2) continue;
      out.push({ topicId, itemId: item.id, sentence: item.sentence, options: item.options, correct: item.correct });
    }
  }
  return out;
}
