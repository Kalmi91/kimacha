import type { Level } from '@/data/words';
import { getGrammarTier } from '@/lib/grammar/syllabus';
import type { LevelTestCtx } from '@/lib/grammar/levelTest';
import type { TopicEvidence } from '@/lib/grammar/randomRound';
import { questionsOf, type RoundData } from '@/lib/grammar/randomRoundView';

// The non-visual part of the level test screen (app/grammar/level-test.tsx): the engine context over the level's
// written lessons. The questions are the random round's (lazily built, match cards left out); a topic without any
// usable question is not part of the test.
export function levelTestCtx(d: RoundData, seed: number, level: Level, evidence: Map<string, TopicEvidence>): LevelTestCtx {
  return {
    topics: d.topics
      .filter((tp) => tp.level === level && questionsOf(d, seed, tp.id).length > 0)
      .map((tp) => ({ id: tp.id, level: tp.level, tier: getGrammarTier(tp.id) })),
    evidence,
    questionIds: (topicId) => questionsOf(d, seed, topicId).map((q) => ({ id: q.id, kind: q.kind })),
  };
}
