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
import { shuffleArray, hashString, mulberry32 } from '../shuffle';

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
  // FB162 follow-up (Kálmán, 2026-08-28): "kerüljön be de ne azokat priorizálja
  // ... pont az lenne a lényege a játékoknak hogy amivel aktuálisan szenvedsz
  // azokat hozza fel és azokat gyakorold".
  known?: boolean; // TRUE = buried with "I know this"
  struggle?: number; // how much practice this word still wants, see struggleWeight
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

// How badly a word wants to come up in a game. A miss (lapse) counts double,
// an unfinished ladder counts once, a word buried with "I know this" stays in the
// pool but at the back, and a top-up word the learner has not met yet is filler.
export function struggleWeight(card: { lapses?: number; buried?: 0 | 1 }, phase: WordPhase, isNew: boolean): number {
  if (isNew) return 0.5;
  if (card.buried) return 0.25;
  return 1 + (card.lapses ?? 0) * 2 + (2 - phase);
}

// Weighted random permutation (Efraimidis-Spirakis): key = random^(1/weight),
// highest key first. A heavy word usually lands near the front, but every word
// keeps a real chance, so a game never drills the same five cards forever.
export function weightedShuffle<T>(items: T[], weightOf: (item: T) => number, seed: number): T[] {
  const rng = mulberry32(seed);
  return items
    .map((item) => ({ item, key: Math.pow(rng(), 1 / Math.max(0.0001, weightOf(item))) }))
    .sort((a, b) => b.key - a.key)
    .map((entry) => entry.item);
}

// One word for the next round, weight-proportional: the words you keep missing
// come up most often, the "I know this" ones only now and then.
export function pickStruggler(pool: PoolEntry[], random: () => number = Math.random): PoolEntry | null {
  if (!pool.length) return null;
  const total = pool.reduce((sum, e) => sum + Math.max(0.0001, e.struggle ?? 1), 0);
  let ticket = random() * total;
  for (const entry of pool) {
    ticket -= Math.max(0.0001, entry.struggle ?? 1);
    if (ticket <= 0) return entry;
  }
  return pool[pool.length - 1];
}

function toPoolEntry(
  word: WordEntry,
  learnedLang: string,
  nativeLang: string,
  phase: WordPhase,
  isNew: boolean,
  card: { lapses?: number; buried?: 0 | 1 } = {}
): PoolEntry {
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
    known: !!card.buried,
    struggle: struggleWeight(card, phase, isNew),
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
    entries.push(toPoolEntry(word, learnedLang, nativeLang, phase, false, card));
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

  // FB162 follow-up: struggle-first order, so a game that takes the head of the
  // pool drills what the learner is actually missing; the buried "I know this"
  // words are in the list (they unlock the games and fill a round), just last.
  const seed = hashString(`${pair}:${level}:${topicId ?? ''}:${strictness}`);
  return weightedShuffle(entries, (e) => e.struggle ?? 1, seed);
}
