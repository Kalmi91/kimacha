// GAMES.md 3.1: "amit eddig megtanultam" query + top-up with unseen words.
//
// This is the enforcement point of the user's core criterion (GAMES.md 0.):
// a game may ONLY draw vocabulary from here. Every entry this function returns
// is either already known (isNew === false) or carries a resolvable gloss
// (isNew === true, filled straight from the corpus, never blank), guarded by
// lib/games/__tests__/vocabPool.test.ts.

import { getDb } from '../database';
import { findWordById, getWordsForLevel, getWordTopic, type Level, type WordEntry } from '@/data/words';
import { wordPhase, type WordPhase } from '../wordPhase';
import { shuffleArray, hashString } from '../shuffle';

export type PoolStrictness = 'seen' | 'practiced' | 'mastered';

export interface PoolEntry {
  wordId: number;
  learned: string; // in the learned language, e.g. 'perro'
  native: string; // in the source language, e.g. 'kutya'
  level: Level;
  topicId?: string;
  sentenceLearned?: string;
  sentenceNative?: string;
  phase: WordPhase; // lib/wordPhase.ts
  isNew: boolean; // TRUE = came from the top-up, mandatory gloss in the UI
}

export interface GetLearnedPoolOptions {
  pair: string;
  learnedLang: string;
  level: Level;
  // K3b DÖNTÉS (2026-08-26): fixed default 'practiced', not user-configurable.
  // The type stays for possible future per-game tuning.
  strictness?: PoolStrictness;
  minSize?: number; // the game's minimum vocabulary need
  topicId?: string | null; // narrow to one topic, if the game scopes to one
}

const STRICTNESS_MIN_PHASE: Record<PoolStrictness, WordPhase> = {
  seen: 0,
  practiced: 1,
  mastered: 2,
};

function fieldOf(word: WordEntry, lang: string): string {
  const v = word[lang];
  return typeof v === 'string' ? v : '';
}

function sentenceOf(word: WordEntry, lang: string): string | undefined {
  const v = word[`sentence_${lang}`];
  return typeof v === 'string' && v ? v : undefined;
}

function toPoolEntry(word: WordEntry, learnedLang: string, nativeLang: string, phase: WordPhase, isNew: boolean): PoolEntry {
  return {
    wordId: word.id,
    learned: fieldOf(word, learnedLang),
    native: fieldOf(word, nativeLang),
    level: word.level,
    topicId: getWordTopic(word),
    sentenceLearned: sentenceOf(word, learnedLang),
    sentenceNative: sentenceOf(word, nativeLang),
    phase,
    isNew,
  };
}

export async function getLearnedPool(opts: GetLearnedPoolOptions): Promise<PoolEntry[]> {
  const { pair, learnedLang, level, strictness = 'practiced', minSize, topicId } = opts;
  const nativeLang = pair.split('-')[0] ?? 'hu';
  const minPhase = STRICTNESS_MIN_PHASE[strictness];

  const db = getDb();
  const cards = await db.getAllWordCards(pair);

  const seen = new Set<number>();
  const entries: PoolEntry[] = [];
  for (const card of cards) {
    const phase = wordPhase(card);
    if (phase < minPhase) continue;
    const word = findWordById(card.word_id, learnedLang);
    if (!word) continue; // dangling id (merged/removed word), skip defensively
    if (topicId && getWordTopic(word) !== topicId) continue;
    if (seen.has(word.id)) continue;
    seen.add(word.id);
    entries.push(toPoolEntry(word, learnedLang, nativeLang, phase, false));
  }

  if (minSize && entries.length < minSize) {
    const candidates = getWordsForLevel(level, learnedLang).filter(
      (w) => !seen.has(w.id) && (!topicId || getWordTopic(w) === topicId)
    );
    for (const w of candidates) {
      if (entries.length >= minSize) break;
      entries.push(toPoolEntry(w, learnedLang, nativeLang, 0, true));
      seen.add(w.id);
    }
  }

  const seed = hashString(`${pair}:${level}:${topicId ?? ''}:${strictness}`);
  return shuffleArray(entries, seed);
}
