// The level picker of the Sentences tab (FB556): which PCIC level the sentences are taken from. nothing chosen = the learner's
// own level (FB631); 'all' only when the learner picks it; a level = only the example sentences of that
// level's items (the "never an unknown word" gate of lib/sentenceTab.ts still applies). The choice is kept per language pair
// in the resume store, so the tab opens on it again after a restart.

import type { PcicItem, PcicLevel, PcicTarget } from '@/data/pcic';
import type { DB } from '@/lib/database';
import type { LanguagePair } from '@/lib/languagePair';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import { sentencePair } from '@/lib/sentenceCards';

export type SentenceLevel = 'all' | PcicLevel;

export const ALL_LEVELS = 'all' as const;

const keyOf = (pair: LanguagePair): string => `sentences-level:${pair}`;

/** The levels that have at least one example sentence for the pair, in level order. */
export function levelsWithSentences(levels: readonly PcicLevel[], itemsFor: (level: PcicLevel) => readonly PcicItem[], target: PcicTarget): PcicLevel[] {
  return levels.filter((level) => itemsFor(level).some((item) => sentencePair(item, target) !== null));
}

const ORDER: readonly PcicLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

/**
 * The saved choice, valid only while that level still has sentences for the pair. Nothing saved (FB631): the learner's own level,
 * or the nearest available one (a tie: the one below); only a pair with no level at all is every level.
 */
export function resolveSentenceLevel(saved: unknown, available: readonly PcicLevel[], learner?: PcicLevel): SentenceLevel {
  if (saved === ALL_LEVELS) return ALL_LEVELS;
  if (typeof saved === 'string' && (available as readonly string[]).includes(saved)) return saved as PcicLevel;
  if (!learner || available.length === 0) return ALL_LEVELS;
  const at = ORDER.indexOf(learner);
  const dist = (l: PcicLevel) => Math.abs(ORDER.indexOf(l) - at) * 2 + (ORDER.indexOf(l) > at ? 1 : 0);
  return [...available].sort((x, y) => dist(x) - dist(y))[0];
}

/** The items the sentence queue is built from: the chosen level's, or every level's. */
export function itemsForSentenceLevel(level: SentenceLevel, levels: readonly PcicLevel[], itemsFor: (level: PcicLevel) => readonly PcicItem[]): PcicItem[] {
  return level === ALL_LEVELS ? levels.flatMap((l) => itemsFor(l)) : [...itemsFor(level)];
}

export async function loadSentenceLevel(db: DB, pair: LanguagePair): Promise<unknown> {
  return loadResumeValue(db, keyOf(pair));
}

/** 'all' is kept as a choice too (the default is the learner's level, FB631). */
export async function saveSentenceLevel(db: DB, pair: LanguagePair, level: SentenceLevel): Promise<void> {
  await saveResumeValue(db, keyOf(pair), level);
}
