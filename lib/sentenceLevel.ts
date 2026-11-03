// The level picker of the Sentences tab (FB556): which PCIC level the sentences are taken from. 'all' = every level, what the
// tab did before the picker (a learner who never touches it sees no change); a level = only the example sentences of that
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

/** The saved choice, valid only while that level still has sentences for the pair; anything else = every level. */
export function resolveSentenceLevel(saved: unknown, available: readonly PcicLevel[]): SentenceLevel {
  return typeof saved === 'string' && (available as readonly string[]).includes(saved) ? (saved as PcicLevel) : ALL_LEVELS;
}

/** The items the sentence queue is built from: the chosen level's, or every level's. */
export function itemsForSentenceLevel(level: SentenceLevel, levels: readonly PcicLevel[], itemsFor: (level: PcicLevel) => readonly PcicItem[]): PcicItem[] {
  return level === ALL_LEVELS ? levels.flatMap((l) => itemsFor(l)) : [...itemsFor(level)];
}

export async function loadSentenceLevel(db: DB, pair: LanguagePair): Promise<unknown> {
  return loadResumeValue(db, keyOf(pair));
}

/** 'all' removes the saved value (the default). */
export async function saveSentenceLevel(db: DB, pair: LanguagePair, level: SentenceLevel): Promise<void> {
  await saveResumeValue(db, keyOf(pair), level === ALL_LEVELS ? null : level);
}
