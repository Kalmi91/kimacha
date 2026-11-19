// The 8 grammar task types of the tests (SPEC-grammar-tests.md section 2) and the per-level data file that says which
// level uses which of them (data/grammar/task-types.json). The core topics are not stored: they come from the syllabus
// tier (getGrammarTier), so there is one marking only.

import type { Level } from '@/data/words';
import { getGrammarTopic, grammarKindCounts, type GrammarKind, type GrammarTopicData } from '@/lib/games/content';
import { getGrammarTier, syllabusForLevel, type GrammarTier } from './syllabus';

export type TaskTypeId = 'choice' | 'form' | 'transform' | 'why' | 'opencloze' | 'fix' | 'bank' | 'order';

/** The 8 types in the spec order. */
export const TASK_TYPE_IDS: readonly TaskTypeId[] = ['choice', 'form', 'transform', 'why', 'opencloze', 'fix', 'bank', 'order'];

interface TaskTypesFile {
  minPerType: number;
  /** { topicId: [type, ...] }: the type is not required for that topic. */
  exempt?: Record<string, TaskTypeId[]>;
  coreTiers: GrammarTier[];
  types: Record<TaskTypeId, GrammarKind[]>;
  levels: Partial<Record<Level, { enabled: boolean; types: TaskTypeId[] }>>;
}

const FILE: TaskTypesFile = require('@/data/grammar/task-types.json');

export const MIN_ITEMS_PER_TYPE: number = FILE.minPerType;

export function taskConfigForLevel(level: Level): { enabled: boolean; types: TaskTypeId[] } {
  return FILE.levels[level] ?? { enabled: false, types: [] };
}

/** The exempt entries that name a topic not in the syllabus or an unknown type (must be empty). */
export function exemptErrors(exempt: Record<string, string[]> = FILE.exempt ?? {}, topicIds?: string[]): string[] {
  const known = new Set(
    topicIds ?? (Object.keys(FILE.levels) as Level[]).flatMap((l) => [...syllabusForLevel(l), ...syllabusForLevel(l, 'en')].map((t) => t.id))
  );
  const errors: string[] = [];
  for (const [topic, types] of Object.entries(exempt)) {
    if (!known.has(topic)) errors.push(`unknown topic ${topic}`);
    for (const type of types) if (!(TASK_TYPE_IDS as readonly string[]).includes(type)) errors.push(`unknown type ${type} for ${topic}`);
  }
  return errors;
}

/** The levels whose task types the content gate checks. */
export function enabledTaskLevels(): Level[] {
  return (Object.keys(FILE.levels) as Level[]).filter((l) => FILE.levels[l]?.enabled);
}

/** The core topics of the level: the syllabus topics whose tier is one of the data file's `coreTiers`. */
export function coreTopicsForLevel(level: Level, lang = 'es'): string[] {
  return syllabusForLevel(level, lang)
    .map((t) => t.id)
    .filter((id) => FILE.coreTiers.includes(getGrammarTier(id)));
}

/** How many items a lesson has per task type (the typed noun form counts under `form`). */
export function taskTypeCounts(lesson: Pick<GrammarTopicData, 'items'>): Record<TaskTypeId, number> {
  const kinds = grammarKindCounts(lesson as GrammarTopicData);
  const out = {} as Record<TaskTypeId, number>;
  for (const id of TASK_TYPE_IDS) out[id] = FILE.types[id].reduce((n, k) => n + kinds[k], 0);
  return out;
}

export interface TaskTypeGap {
  topic: string;
  type: TaskTypeId;
  have: number;
  need: number;
}

/** Every (core topic, type) of the level that has fewer than `minPerType` items. A core topic without a written lesson counts 0. */
export function taskTypeGaps(level: Level, lang = 'es'): TaskTypeGap[] {
  const gaps: TaskTypeGap[] = [];
  const types = taskConfigForLevel(level).types;
  for (const topic of coreTopicsForLevel(level, lang)) {
    const lesson = getGrammarTopic(lang, topic);
    const counts = lesson ? taskTypeCounts(lesson) : null;
    for (const type of types) {
      if ((FILE.exempt?.[topic] ?? []).includes(type)) continue;
      const have = counts ? counts[type] : 0;
      if (have < FILE.minPerType) gaps.push({ topic, type, have, need: FILE.minPerType });
    }
  }
  return gaps;
}
