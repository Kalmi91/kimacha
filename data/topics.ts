export interface TopicDef {
  id: string;
  order: number;
  subLevel: string;
  type: 'grammar' | 'vocab';
  icon: string;
  name_hu: string;
  name_en: string;
  name_es: string;
  name_de: string;
}

export interface SubLevelDef {
  id: string;
  order: number;
  name_hu: string;
  name_en: string;
  name_es: string;
  name_de: string;
}

import a1 from './topics/a1.json';
import a1SubLevels from './sublevels/a1.json';

const topicsByLevel: Record<string, TopicDef[]> = { A1: a1 as TopicDef[] };
const subLevelsByLevel: Record<string, SubLevelDef[]> = { A1: a1SubLevels as SubLevelDef[] };

export function getTopicsForLevel(level: string): TopicDef[] {
  return topicsByLevel[level] ?? [];
}

export function hasTopics(level: string): boolean {
  return (topicsByLevel[level]?.length ?? 0) > 0;
}

export function getTopicName(topic: TopicDef, lang: string): string {
  const key = `name_${lang}` as keyof TopicDef;
  return (topic[key] as string) ?? topic.name_en;
}

export function getSubLevelsForLevel(level: string): SubLevelDef[] {
  return subLevelsByLevel[level] ?? [];
}

export function getTopicsForSubLevel(level: string, subLevelId: string): TopicDef[] {
  return getTopicsForLevel(level)
    .filter((t) => t.subLevel === subLevelId)
    .sort((a, b) => a.order - b.order);
}

export function getSubLevelName(sub: SubLevelDef, lang: string): string {
  const key = `name_${lang}` as keyof SubLevelDef;
  return (sub[key] as string) ?? sub.name_en;
}

export function getSubLevelForTopic(level: string, topicId: string): SubLevelDef | null {
  const topic = getTopicsForLevel(level).find((t) => t.id === topicId);
  if (!topic) return null;
  return getSubLevelsForLevel(level).find((s) => s.id === topic.subLevel) ?? null;
}
