import type { Level } from '@/data/words';
import { isBankItem, isClozeItem, isFixItem, isNounItem } from '@/lib/games/content';
import type { BankItem, ClozeItem, FixItem, NounItem } from '@/lib/grammar/lessonTypes';
import type { LessonTestQuestion } from '@/lib/grammar/lessonTest';
import { questionsOf, type RoundData } from '@/lib/grammar/randomRoundView';
import { lessonFor } from '@/lib/grammar/syllabus';
import { taskTypeOfKind, type PoolQ, type SmallPool, type SmallTopicInfo } from '@/lib/grammar/smallTest';
import { coreTopicsForLevel, taskConfigForLevel } from '@/lib/grammar/taskTypes';

// The non-visual part of the Small test screen (app/grammar/small-test.tsx): the question pool over the level's written
// lessons. The questions the level test shows (choice, form, transform, why, order) come from the random round's builder;
// the four typed task kinds of the grammar tests (open cloze, error correction, word bank, noun form) are lesson items the
// drill components draw themselves. Only the level's task types (data/grammar/task-types.json) are in the pool.

export type NewKindItem = ClozeItem | FixItem | BankItem | NounItem;

export interface SmallQuestion {
  q?: LessonTestQuestion;
  item?: NewKindItem;
}

export interface SmallView {
  pool: SmallPool;
  find: (topicId: string, qid: string) => SmallQuestion | null;
  topics: SmallTopicInfo[];
  /** The core topics of the level that have a written lesson. */
  coreIds: string[];
}

export function smallTestView(d: RoundData, seed: number, level: Level): SmallView {
  const allowed = new Set(taskConfigForLevel(level).types);
  const built = new Map<string, { pool: PoolQ[]; byId: Map<string, SmallQuestion> }>();
  const of = (topicId: string) => {
    let b = built.get(topicId);
    if (!b) {
      const byId = new Map<string, SmallQuestion>();
      const pool: PoolQ[] = [];
      for (const q of questionsOf(d, seed, topicId)) {
        const type = taskTypeOfKind(q.kind);
        if (type && allowed.has(type) && !byId.has(q.id)) {
          byId.set(q.id, { q });
          pool.push({ id: q.id, type });
        }
      }
      const lesson = lessonFor(d.learnedLang, topicId);
      for (const it of lesson?.items ?? []) {
        if (!(isClozeItem(it) || isFixItem(it) || isBankItem(it) || isNounItem(it))) continue;
        const type = taskTypeOfKind(it.kind);
        if (type && allowed.has(type) && !byId.has(it.id)) {
          byId.set(it.id, { item: it });
          pool.push({ id: it.id, type });
        }
      }
      b = { pool, byId };
      built.set(topicId, b);
    }
    return b;
  };
  const inLevel = d.topics.filter((tp) => tp.level === level);
  const coreSet = new Set(coreTopicsForLevel(level, d.learnedLang));
  const topics = inLevel.map((tp) => ({ id: tp.id, core: coreSet.has(tp.id) }));
  return {
    pool: (topicId) => of(topicId).pool,
    find: (topicId, qid) => of(topicId).byId.get(qid) ?? null,
    topics,
    coreIds: topics.filter((tp) => tp.core && of(tp.id).pool.length > 0).map((tp) => tp.id),
  };
}
