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

import a0 from './topics/a0.json';
import a0SubLevels from './sublevels/a0.json';
import a1 from './topics/a1.json';
import a1SubLevels from './sublevels/a1.json';
import a2 from './topics/a2.json';
import a2SubLevels from './sublevels/a2.json';
import en_a0 from './topics/en/a0.json';
import en_a0SubLevels from './sublevels/en/a0.json';
import en_a1 from './topics/en/a1.json';
import en_a1SubLevels from './sublevels/en/a1.json';
import en_a2 from './topics/en/a2.json';
import en_a2SubLevels from './sublevels/en/a2.json';
import hu_a1 from './topics/hu/a1.json';
import hu_a1SubLevels from './sublevels/hu/a1.json';

const topicsByLevel: Record<string, TopicDef[]> = { A0: a0 as TopicDef[], A1: a1 as TopicDef[], A2: a2 as TopicDef[] };
const subLevelsByLevel: Record<string, SubLevelDef[]> = { A0: a0SubLevels as SubLevelDef[], A1: a1SubLevels as SubLevelDef[], A2: a2SubLevels as SubLevelDef[] };

// English-target topic/sub-level taxonomy. Keyed the same way as the Spanish set;
// `lang` defaults to 'es' so existing callers keep the Spanish grammar topics, and
// only lang==='en' (with English content) returns the English taxonomy.
const enTopicsByLevel: Record<string, TopicDef[]> = { A0: en_a0 as TopicDef[], A1: en_a1 as TopicDef[], A2: en_a2 as TopicDef[] };
const enSubLevelsByLevel: Record<string, SubLevelDef[]> = { A0: en_a0SubLevels as SubLevelDef[], A1: en_a1SubLevels as SubLevelDef[], A2: en_a2SubLevels as SubLevelDef[] };

// Hungarian-target taxonomy (native EN → learn HU course). Same keying; only
// lang==='hu' (with authored Hungarian content) returns these.
const huTopicsByLevel: Record<string, TopicDef[]> = { A1: hu_a1 as TopicDef[] };
const huSubLevelsByLevel: Record<string, SubLevelDef[]> = { A1: hu_a1SubLevels as SubLevelDef[] };

export function getTopicsForLevel(level: string, lang: string = 'es'): TopicDef[] {
  if (lang === 'en') return enTopicsByLevel[level] ?? [];
  if (lang === 'hu') return huTopicsByLevel[level] ?? [];
  return topicsByLevel[level] ?? [];
}

export function hasTopics(level: string, lang: string = 'es'): boolean {
  return getTopicsForLevel(level, lang).length > 0;
}

export function getTopicName(topic: TopicDef, lang: string): string {
  const key = `name_${lang}` as keyof TopicDef;
  return (topic[key] as string) ?? topic.name_en;
}

export function getSubLevelsForLevel(level: string, lang: string = 'es'): SubLevelDef[] {
  if (lang === 'en') return enSubLevelsByLevel[level] ?? [];
  if (lang === 'hu') return huSubLevelsByLevel[level] ?? [];
  return subLevelsByLevel[level] ?? [];
}

export function getTopicsForSubLevel(level: string, subLevelId: string, lang: string = 'es'): TopicDef[] {
  return getTopicsForLevel(level, lang)
    .filter((t) => t.subLevel === subLevelId)
    .sort((a, b) => a.order - b.order);
}

export function getSubLevelName(sub: SubLevelDef, lang: string): string {
  const key = `name_${lang}` as keyof SubLevelDef;
  return (sub[key] as string) ?? sub.name_en;
}

export function getSubLevelForTopic(level: string, topicId: string, lang: string = 'es'): SubLevelDef | null {
  const topic = getTopicsForLevel(level, lang).find((t) => t.id === topicId);
  if (!topic) return null;
  return getSubLevelsForLevel(level, lang).find((s) => s.id === topic.subLevel) ?? null;
}
