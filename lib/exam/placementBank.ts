// Authored placement gap questions for the targets whose grammar lessons are not written yet. The placement test takes its grammar
// questions from the gap items of the level's lessons (lib/exam/grammarItems.ts); a target without lessons (German) would
// only ask words, so its bank of reviewed gap sentences (data/exams/placement/<target>.json, 20 per level A1-C1, one right option each)
// is added to the pool. A target with lessons simply has no bank. Pure module.

import type { PcicLevel } from '@/data/pcic';
import de from '@/data/exams/placement/de.json';
import type { GapSource } from './grammarItems';

interface BankRow {
  id: string;
  /** One `___` blank. */
  sentence: string;
  options: string[];
  correct: number;
}
type Bank = Partial<Record<PcicLevel, BankRow[]>>;

const BANKS: Record<string, Bank> = { de: de as Bank };

/** The topic id of the bank's questions (the question key is `g:placement:<row id>`). */
export const PLACEMENT_BANK_TOPIC = 'placement';

/** The bank's gap sentences of one level for the target (empty for a target without a bank). */
export function placementBankGaps(level: PcicLevel, target: string): GapSource[] {
  return (BANKS[target]?.[level] ?? []).map((row) => ({ topicId: PLACEMENT_BANK_TOPIC, itemId: row.id, sentence: row.sentence, options: row.options, correct: row.correct }));
}
