// PLAN-vizsga A. szakasz 2. lépés: a vizsga nyelvtani tételei a szint KÉSZ
// leckéinek lyukas-mondat (gap) tételeiből jönnek (4. követelmény). A lecke maga
// tanítja a szavait (glossary + a korpusz-audit), ezért a lecke-tételt nem szűrjük
// a tanult szavak kapuján, mint a szó-példamondatot (lib/exam/builder.ts): a
// tanuló pont ezeken a mondatokon gyakorolt, és a kapu a leckék szókincsén
// (data/words) áll, nem a words-open 150 kártyáján.

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

/** A szint kész leckéinek gap tételei (a vosotros-tételek nélkül, mint a lecke-körben). */
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
