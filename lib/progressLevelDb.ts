// The DB reader of lib/progressLevel.ts: one read of the SRS cards and the grammar rows, then the
// pure computation. It works on the DB interface, so the native (database.ts) and the web
// (database.web.ts) implementation share it.
//
// "Learned word" = the definition of the Stats tab's "Words known" card (countLearned,
// lib/pcicStats.ts): a card past the learning steps (state 'review') or marked known by hand. The
// words of a level are the data/words-open cards (pcicItemsForLevel, the o<order> id space).
// "Done topic" = the done flag of the Course tab (doneGrammarTopicProgress, lib/grammar/syllabus.ts):
// a finished row for every task kind of the lesson; the optional lesson test is not part of it.

import { pcicItemsForLevel, type PcicTarget } from '@/data/pcic';
import { doneGrammarTopicProgress, GRAMMAR_PROGRESS_KEY, syllabusForLevel } from '@/lib/grammar/syllabus';
import type { DB } from '@/lib/dbTypes';
import { cardsForLevel } from '@/lib/pcicLevels';
import { countLearned } from '@/lib/pcicStats';
import { computeProgressLevel, PROGRESS_LEVELS, type LevelCounts, type ProgressLevel } from '@/lib/progressLevel';

type ProgressStore = Pick<DB, 'getPcicCards' | 'getGameProgress'>;

/**
 * The learner's level. Only the Spanish course (target 'es') has levels: the English
 * direction (es→en) has no words-open vocabulary, and its grammar does not count; null there.
 */
export async function readProgressLevel(store: ProgressStore, target: PcicTarget): Promise<ProgressLevel | null> {
  if (target !== 'es') return null;
  const [cards, rows] = await Promise.all([store.getPcicCards(), store.getGameProgress(GRAMMAR_PROGRESS_KEY)]);
  const doneTopics = doneGrammarTopicProgress('es', rows);
  const counts: LevelCounts[] = PROGRESS_LEVELS.map((level) => {
    const topics = syllabusForLevel(level, 'es');
    return {
      level,
      wordsKnown: countLearned(cardsForLevel(cards, level)),
      wordsTotal: pcicItemsForLevel(level).length,
      grammarDone: topics.filter((topic) => doneTopics.has(topic.id)).length,
      grammarTotal: topics.length,
    };
  });
  return computeProgressLevel(counts);
}
