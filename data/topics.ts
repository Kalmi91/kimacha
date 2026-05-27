export interface TopicDef {
  id: string;
  order: number;
  type: 'grammar' | 'vocab';
  name_hu: string;
  name_en: string;
  name_es: string;
  name_de: string;
}

import a1 from './topics/a1.json';

const topicsByLevel: Record<string, TopicDef[]> = { A1: a1 as TopicDef[] };

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
