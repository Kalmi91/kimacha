export type Level = 'A0' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export const LEVELS: Level[] = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export interface WordEntry {
  id: number;
  level: Level;
  es: string;
  hu: string;
  en: string;
  de: string;
  sentence_es: string;
  sentence_hu: string;
  sentence_en: string;
  sentence_de: string;
  [key: string]: string | number;
}

import a0 from './words/a0.json';
import a1 from './words/a1.json';
import a2 from './words/a2.json';
import b1 from './words/b1.json';
import b2 from './words/b2.json';
import c1 from './words/c1.json';
import c2 from './words/c2.json';

import en_a0 from './words/en/a0.json';
import en_a1 from './words/en/a1.json';
import en_a2 from './words/en/a2.json';
import hu_a0 from './words/hu/a0.json';
import hu_a1 from './words/hu/a1.json';

export const words: WordEntry[] = [...a0, ...a1, ...a2, ...b1, ...b2, ...c1, ...c2] as WordEntry[];

// Dedicated English-target word sets, keyed by level. Only levels with authored
// English content appear here; every other (level, lang) falls back to the shared
// Spanish-headword set above. So `lang` defaults to 'es' and existing callers are
// unchanged, only an explicit lang==='en' with English content diverges.
const enWordsByLevel: Partial<Record<Level, WordEntry[]>> = {
  A0: en_a0 as WordEntry[],
  A1: en_a1 as WordEntry[],
  A2: en_a2 as WordEntry[],
};
const huWordsByLevel: Partial<Record<Level, WordEntry[]>> = {
  A0: hu_a0 as WordEntry[],
  A1: hu_a1 as WordEntry[],
};

export function getWordsForLevel(level: Level, lang: string = 'es'): WordEntry[] {
  if (lang === 'en' && enWordsByLevel[level]) return enWordsByLevel[level]!;
  if (lang === 'hu' && huWordsByLevel[level]) return huWordsByLevel[level]!;
  return words.filter(w => w.level === level);
}

// Card rows in the DB only carry a word id, and the id spaces of the branches are
// disjoint by construction (shared Spanish set <= 3007, English track from 5001,
// Hungarian track from 6001). Look the id up in the branch that is being learned
// first, then in the shared set. Resolving against the shared set alone dropped
// every card of a non-Spanish course, which left the learner on the Done screen
// with an empty queue (FB129 second cause).
const branchIndex: Partial<Record<string, Map<number, WordEntry>>> = {};

function indexFor(lang: string): Map<number, WordEntry> | undefined {
  const byLevel = lang === 'en' ? enWordsByLevel : lang === 'hu' ? huWordsByLevel : null;
  if (!byLevel) return undefined;
  if (!branchIndex[lang]) {
    const map = new Map<number, WordEntry>();
    for (const list of Object.values(byLevel)) {
      for (const w of list ?? []) map.set(w.id, w);
    }
    branchIndex[lang] = map;
  }
  return branchIndex[lang];
}

export function findWordById(id: number, lang: string = 'es'): WordEntry | undefined {
  return indexFor(lang)?.get(id) ?? words.find(w => w.id === id);
}

export function getWordsForTopic(level: Level, topicId: string, lang: string = 'es'): WordEntry[] {
  return getWordsForLevel(level, lang)
    .filter(w => w['topic'] === topicId)
    .sort((a, b) => (Number(a['topicOrder']) || 0) - (Number(b['topicOrder']) || 0));
}

export function getWordTopic(w: WordEntry): string | undefined {
  const t = w['topic'];
  return typeof t === 'string' ? t : undefined;
}
