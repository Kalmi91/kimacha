// The sentences of the last rounds of the Sentences tab (FB587): kept per language pair through the resume store, so they
// survive a restart and a new day. They are saved when a round is CREATED (a learner who starts and leaves must also get new
// sentences next time), and the queue puts them after every other sentence of the same priority (lib/sentenceTab.ts).

import type { DB } from '@/lib/database';
import type { LanguagePair } from '@/lib/languagePair';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';

/** How many of the last rounds are remembered. */
export const RECENT_ROUNDS = 3;

const keyOf = (pair: LanguagePair): string => `sentences-recent:${pair}`;

/** The stored rounds (newest last); anything that is not a list of lists of strings is dropped. */
function validRounds(raw: unknown): string[][] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r): r is string[] => Array.isArray(r) && r.every((k) => typeof k === 'string')).slice(-RECENT_ROUNDS);
}

/** The sentence keys of the last rounds of this pair; a corrupt stored value = none. */
export async function loadRecentSentences(db: DB, pair: LanguagePair): Promise<Set<string>> {
  return new Set(validRounds(await loadResumeValue(db, keyOf(pair))).flat());
}

/** Adds one round (its sentence keys) to the remembered ones, keeping the last RECENT_ROUNDS. */
export async function rememberRound(db: DB, pair: LanguagePair, keys: readonly string[]): Promise<void> {
  const rounds = validRounds(await loadResumeValue(db, keyOf(pair)));
  await saveResumeValue(db, keyOf(pair), [...rounds, [...keys]].slice(-RECENT_ROUNDS));
}
