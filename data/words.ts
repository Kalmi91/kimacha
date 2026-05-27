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

export const words: WordEntry[] = [...a0, ...a1, ...a2, ...b1, ...b2, ...c1, ...c2] as WordEntry[];

export function getWordsForLevel(level: Level): WordEntry[] {
  return words.filter(w => w.level === level);
}

export function getWordsForTopic(level: Level, topicId: string): WordEntry[] {
  return getWordsForLevel(level)
    .filter(w => w['topic'] === topicId)
    .sort((a, b) => (Number(a['topicOrder']) || 0) - (Number(b['topicOrder']) || 0));
}

export function getWordTopic(w: WordEntry): string | undefined {
  const t = w['topic'];
  return typeof t === 'string' ? t : undefined;
}
