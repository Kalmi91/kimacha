// The one DB interface both implementations satisfy: SQLite on device
// (lib/database.ts) and the in-memory store on web and in tests
// (lib/database.web.ts).

import type { PcicLevel } from '@/data/pcic';
import type { GrammarPaletteId } from '@/constants/GrammarPalettes';
import type { SkinMix, SkinSelection } from '@/constants/Skins';
import type { BackupPayload } from './backup';
import type { ExamResult, ExamResults } from './exam/types';
import type { MistakeBatchRow } from './mistakes/deck';
import type { Sm2Card } from './sm2';
import type { UsageStats } from './usageStats';

export interface DB {
  getStreak(): Promise<{ current_count: number; last_date: string | null; longest_count: number }>;
  getOnboarding(): Promise<{ source: string; target: string } | null>;
  setOnboarding(source: string, target: string): Promise<void>;
  getLevel(): Promise<{ level: string; correct_streak: number; mistakes_in_window: number; fail_streak: number }>;
  claimDailyGreeting(): Promise<boolean>;
  getStatusBarTint(): Promise<number>;
  setStatusBarTint(index: number): Promise<void>;
  getGrammarPalette(): Promise<GrammarPaletteId>;
  setGrammarPalette(id: GrammarPaletteId): Promise<void>;
  // the chosen theme and My mix (null = no choice yet; setSkin(null) resets).
  getSkin(): Promise<SkinSelection | null>;
  setSkin(id: SkinSelection | null): Promise<void>;
  getSkinMix(): Promise<SkinMix | null>;
  setSkinMix(mix: SkinMix): Promise<void>;
  // the daily streak write is back (the Learn tab took
  // it away, the PCIC grading is the only caller from now on, see app/(tabs)/index.tsx).
  updateStreak(): Promise<void>;
  getStrictAccents(): Promise<boolean>;
  setStrictAccents(v: boolean): Promise<void>;
  // a PCIC "missed" (again) card comes back after this many seconds
  // no matter what (lib/pcicSession.ts); the table-deck cooldown
  // (lib/grammar/tableDeck.ts) reads from the same value.
  getAgainDelaySec(): Promise<number>;
  setAgainDelaySec(sec: number): Promise<void>;
  // the article button row on the typed Spanish noun card, can be switched on and off.
  getArticlePicker(): Promise<boolean>;
  setArticlePicker(v: boolean): Promise<void>;
  getWeeklyGoalMinutes(): Promise<number>;
  setWeeklyGoalMinutes(minutes: number): Promise<void>;
  getFeedbackBtnSide(): Promise<'left' | 'right'>;
  setFeedbackBtnSide(side: 'left' | 'right'): Promise<void>;
  getDailyNewLimit(): Promise<number>;
  setDailyNewLimit(limit: number): Promise<void>;
  // the PCIC "+10 new words" bonus, expires with the calendar day (the `today`
  // param is given by the caller); 0 if there is no
  // persisted bonus for `today`.
  getPcicNewBonus(today: string): Promise<number>;
  setPcicNewBonus(bonus: number, today: string): Promise<void>;
  addUsageMinute(): Promise<number>;
  getUsageStats(): Promise<UsageStats>;
  getDayStats(date: string): Promise<{ minutes: number; words: number }>;
  // XP earned on one local calendar day (card grades, lib/dailyXp.ts), app-wide.
  // `delta` may be negative (undo); the day's total never drops below 0.
  getDailyXp(date: string): Promise<number>;
  addDailyXp(date: string, delta: number): Promise<number>;
  // Game tab tables, scoped to the active pair like every
  // other per-pair setting/state in this interface.
  getGameProgress(gameId: string): Promise<{ itemId: string; state: string; data: unknown }[]>;
  setGameProgress(gameId: string, itemId: string, state: string, data?: unknown): Promise<void>;
  // the complete progress of a game/course (e.g. grammar) for the active pair.
  resetGameProgress(gameId: string): Promise<void>;
  // the level exam result per level (passed or not, best score),
  // in the `level-exam` game_progress rows (lib/exam/result.ts); `save` saves merged with the previous one.
  getExamResults(): Promise<ExamResults>;
  saveExamResult(level: string, pct: number, passed: boolean, date: string): Promise<ExamResult>;
  // PCIC tab, SM-2, independent of the FSRS `cards`
  getPcicCards(): Promise<Sm2Card[]>;
  upsertPcicCard(card: Sm2Card): Promise<void>;
  // the selected PCIC level (A1-B2), app-wide, like the
  // status-bar tint. `levelPrefix` is optional: it clears only that level
  // (by the id list fetched from the loaded corpus, following lib/pcicLevels.ts
  // matchesLevel: since the difficulty re-leveling, the level is not
  // a bare id prefix), without it the whole table, as before.
  getPcicLevel(): Promise<PcicLevel>;
  // whether the active pair has an EXPLICITLY chosen level
  // (the getPcicLevel fallback does not count as one).
  hasPcicLevel(): Promise<boolean>;
  setPcicLevel(level: PcicLevel): Promise<void>;
  resetPcicCards(levelPrefix?: string): Promise<void>;
  // the "My mistakes" batches (Settings -> Load my mistakes)
  // and their SM-2 progress, kept separate from pcic_cards.
  saveMistakeBatch(batchId: string, json: string, importedAt: string): Promise<void>;
  getMistakeBatches(): Promise<MistakeBatchRow[]>;
  getMistakeCards(): Promise<Sm2Card[]>;
  upsertMistakeCard(card: Sm2Card): Promise<void>;
  exportAll(): Promise<BackupPayload>;
  importAll(payload: BackupPayload): Promise<void>;
}
