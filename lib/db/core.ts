import { BACKUP_SCHEMA_VERSION, getAppVersion, type BackupPayload } from '../backup';
import { FORCED_PAIR, needsPairCorrection } from '../languages';
import { localDateString, summarizeUsage, DEFAULT_WEEKLY_GOAL_MINUTES, DEFAULT_DAILY_NEW_LIMIT, type UsageStats } from '../usageStats';
import { addDays, type Sm2Card } from '../sm2';
import { PCIC_LEVELS, pcicItemsForLevel, type PcicLevel } from '@/data/pcic';
import type { MistakeBatchRow } from '../mistakes/deck';
import { parseBetaFlagMap } from '../betaFlags';
import { DEFAULT_AGAIN_DELAY_SEC } from '../pcicSession';
import { DEFAULT_GRAMMAR_PALETTE, isGrammarPaletteId, type GrammarPaletteId } from '@/constants/GrammarPalettes';
import { isSkinSelection, parseSkinMix, type SkinMix, type SkinSelection } from '@/constants/Skins';
import { readExamResults, writeExamResult } from '../exam/result';
import type { ExamResult, ExamResults } from '../exam/types';
import type { DB } from '../dbTypes';
import type { DbStore, SettingColumn } from './store';

// on an existing installation the progress currently runs with "b1-..." ids,
// so a missing column (old DB) falls back to B1, not A1.
const DEFAULT_PCIC_LEVEL: PcicLevel = 'B1';

// game_progress.data_json <-> the value a game stored; a broken JSON reads as no data.
export const encodeGameData = (data: unknown): string | null => (data !== undefined ? JSON.stringify(data) : null);
export function decodeGameData(json: string | null | undefined): unknown {
  if (!json) return undefined;
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

// The one implementation of the DB interface, written once over a DbStore (lib/db/store.ts):
// the store does the platform part (SQL on device, Maps on web), this class holds the rules.
export class DbCore implements DB {
  // Active language pair (e.g. "es-hu"). All learning progress (cards + level) is
  // scoped to this pair, so each language you study keeps its own progress.
  protected activePair = 'es-hu';
  private pairLoaded = false;

  constructor(protected readonly store: DbStore) {}

  // Waits for the store and returns the active pair. The first completed open hands over the pair
  // the migration found; anything that sets activePair itself calls this first, so that
  // hand-over can never overwrite its value later.
  protected async ready(): Promise<string> {
    const migrated = await this.store.open();
    if (!this.pairLoaded) {
      this.pairLoaded = true;
      if (migrated) this.activePair = migrated;
    }
    return this.activePair;
  }

  private async getSetting(column: SettingColumn): Promise<any> {
    const row = await this.store.readSettings(await this.ready(), [column]);
    return row?.[column];
  }

  private async setSettings(values: Partial<Record<SettingColumn, unknown>>): Promise<void> {
    await this.store.writeSettings(await this.ready(), values);
  }

  async getStreak() {
    return this.store.readStreak();
  }

  // brought back (the Learn tab took it away in an earlier step),
  // called by the PCIC grading, only the first call of the day counts (last_date keeps track).
  async updateStreak() {
    const today = localDateString();
    const streak = await this.getStreak();
    if (streak.last_date === today) return;
    const yesterday = addDays(today, -1);
    const newCount = streak.last_date === yesterday ? streak.current_count + 1 : 1;
    const longest = Math.max(newCount, streak.longest_count);
    await this.store.writeStreak({ current_count: newCount, last_date: today, longest_count: longest });
  }

  async getOnboarding() {
    return this.store.readOnboarding();
  }

  async setOnboarding(source: string, target: string) {
    await this.ready();
    await this.store.writeOnboarding(source, target);
    this.activePair = `${source}-${target}`;
  }

  async getLevel() {
    return this.store.readLevel(await this.ready());
  }

  // "first open of the day" marker for the greeting. Claiming it is a
  // single write, so only the first caller of the day sees `true`.
  async claimDailyGreeting(): Promise<boolean> {
    const today = localDateString();
    if ((await this.store.readMeta('last_open_date')) === today) return false;
    await this.store.writeMeta('last_open_date', today);
    return true;
  }

  // which of the status-bar blues the user picked, as an index into
  // STATUS_BAR_TINTS. App-wide, so it lives in user_meta, not per language pair.
  async getStatusBarTint(): Promise<number> {
    const v = await this.store.readMeta('status_bar_tint');
    return typeof v === 'number' ? v : 0;
  }

  async setStatusBarTint(index: number): Promise<void> {
    await this.store.writeMeta('status_bar_tint', index);
  }

  // the app-wide color palette (constants/GrammarPalettes.ts). Like the
  // status-bar tint it is not per language pair, so it lives in user_meta.
  async getGrammarPalette(): Promise<GrammarPaletteId> {
    const v = await this.store.readMeta('grammar_palette');
    return isGrammarPaletteId(v) ? v : DEFAULT_GRAMMAR_PALETTE;
  }

  async setGrammarPalette(id: GrammarPaletteId): Promise<void> {
    await this.store.writeMeta('grammar_palette', id);
  }

  // the chosen theme. NULL = the user has not chosen yet: the caller
  // (lib/ThemeContext.tsx) decides from the saved palette (classic → classic, anything else → brutal).
  async getSkin(): Promise<SkinSelection | null> {
    const v = await this.store.readMeta('skin');
    return isSkinSelection(v) ? v : null;
  }

  async setSkin(id: SkinSelection | null): Promise<void> {
    await this.store.writeMeta('skin', id);
  }

  // The four sources of My mix as JSON; an invalid / missing value = null.
  async getSkinMix(): Promise<SkinMix | null> {
    return parseSkinMix(await this.store.readMeta('skin_mix'));
  }

  async setSkinMix(mix: SkinMix): Promise<void> {
    await this.store.writeMeta('skin_mix', JSON.stringify(mix));
  }

  // the selected PCIC level.
  // Instead of a user_meta singleton
  // column it moved into the per-pair row of learn_settings (like the
  // other learning settings), so that on a direction switch both pairs keep their
  // OWN level. Migration of the old (en-es) value: runMigrations.
  async getPcicLevel(): Promise<PcicLevel> {
    const pair = await this.ready();
    const row = await this.store.readSettings(pair, ['pcic_level']);
    // A level name chosen in an older build and since removed (e.g. "A1+") falls back to the default.
    if (row?.pcic_level && (PCIC_LEVELS as string[]).includes(row.pcic_level)) return row.pcic_level as PcicLevel;
    // for es→en only A1 has content (for now); every other pair falls back to
    // the old B1 default (because of the existing "b1-..." progress).
    return pair.endsWith('-en') ? 'A1' : DEFAULT_PCIC_LEVEL;
  }

  // Whether the active pair ALREADY has an explicitly chosen level (the
  // fallback above does not count as one). The Settings direction-switch row uses this to decide
  // whether the level picker sheet should pop up once in the new direction.
  async hasPcicLevel(): Promise<boolean> {
    return !!(await this.getSetting('pcic_level'));
  }

  async setPcicLevel(level: PcicLevel): Promise<void> {
    await this.setSettings({ pcic_level: level });
  }

  // difficulty switch, per pair (accents matter in Spanish, less so in
  // English), default off so beginners keep the forgiving grader.
  async getStrictAccents(): Promise<boolean> {
    return (await this.getSetting('strict_accents')) === 1;
  }

  async setStrictAccents(v: boolean): Promise<void> {
    await this.setSettings({ strict_accents: v ? 1 : 0 });
  }

  // adjustable: after how many seconds a missed PCIC card
  // comes back no matter what (lib/pcicSession.ts).
  async getAgainDelaySec(): Promise<number> {
    const v = await this.getSetting('again_delay_sec');
    return typeof v === 'number' ? v : DEFAULT_AGAIN_DELAY_SEC;
  }

  async setAgainDelaySec(sec: number): Promise<void> {
    await this.setSettings({ again_delay_sec: sec });
  }

  // User feedback: "I should not have to type the el la but pick it".
  // ON by default, because the user asked for it; the switch exists so they can go back
  // to typing if it does not work out ("I am curious what it will be like").
  async getArticlePicker(): Promise<boolean> {
    return (await this.getSetting('article_picker')) !== 0;
  }

  async setArticlePicker(v: boolean): Promise<void> {
    await this.setSettings({ article_picker: v ? 1 : 0 });
  }

  // weekly study goal in minutes, compared against the rolling 7-day
  // usage total on the Stats tab. Stored per pair like the other learn settings
  // (the measured minutes themselves are app-wide, see usage_minutes).
  async getWeeklyGoalMinutes(): Promise<number> {
    const v = await this.getSetting('weekly_goal_minutes');
    return typeof v === 'number' ? v : DEFAULT_WEEKLY_GOAL_MINUTES;
  }

  async setWeeklyGoalMinutes(minutes: number): Promise<void> {
    await this.setSettings({ weekly_goal_minutes: minutes });
  }

  // daily new-word budget. The standing limit lives in learn_settings,
  // the "+10 new words" taps (PCIC) add a bonus that expires with
  // the calendar day (getPcicNewBonus/setPcicNewBonus below).
  async getDailyNewLimit(): Promise<number> {
    const v = await this.getSetting('daily_new_limit');
    return typeof v === 'number' ? v : DEFAULT_DAILY_NEW_LIMIT;
  }

  async setDailyNewLimit(limit: number): Promise<void> {
    await this.setSettings({ daily_new_limit: limit });
  }

  // the columns already existed (the retired Learn tab) but
  // had no reader/writer since that tab left; the PCIC "+10 new words" tap
  // reuses them instead of adding a new pair of columns. `new_bonus_date`
  // decides whether the stored bonus still counts (0 once the day rolls over).
  async getPcicNewBonus(today: string): Promise<number> {
    const row = await this.store.readSettings(await this.ready(), ['new_bonus', 'new_bonus_date']);
    if (row?.new_bonus_date !== today) return 0;
    return typeof row?.new_bonus === 'number' ? row.new_bonus : 0;
  }

  async setPcicNewBonus(bonus: number, today: string): Promise<void> {
    await this.setSettings({ new_bonus: bonus, new_bonus_date: today });
  }

  async getFeedbackBtnSide(): Promise<'left' | 'right'> {
    return (await this.getSetting('feedback_btn_side')) === 'left' ? 'left' : 'right';
  }

  async setFeedbackBtnSide(side: 'left' | 'right'): Promise<void> {
    await this.setSettings({ feedback_btn_side: side });
  }

  // Usage-timer feature: one row per local calendar day, not scoped to a
  // language pair (it's app-wide active-use time, not learning progress).
  // Returns today's new total so the timer can spot a milestone crossing
  // (30/60 minutes) without re-reading the whole usage table every minute.
  async addUsageMinute(): Promise<number> {
    return this.store.addUsageMinute(localDateString());
  }

  async getUsageStats(): Promise<UsageStats> {
    return summarizeUsage(await this.store.readUsage());
  }

  // what one local calendar day added up to, for the midnight celebration.
  // `words` is the number of PCIC words first introduced that local day
  // (introduced_at = date, the same rule as the daily new-word limit), so a
  // word drilled five times still reads as one word learned. Unlike the daily
  // budget it does not drop orphaned cards (ids no longer in the corpus).
  async getDayStats(date: string): Promise<{ minutes: number; words: number }> {
    const minutes = await this.store.readUsageMinutes(date);
    const words = await this.store.countPcicIntroducedOn(date);
    return { minutes, words };
  }

  // Daily XP: one row per local calendar day, app-wide like usage_minutes. Not
  // part of the backup (see lib/backup.ts). Kept in integer tenths of an XP
  // (xp_tenths, 10 = 1 XP) so 0.2 XP steps add up exactly; rows an older build
  // wrote (whole XP in `xp`) read as xp * 10 until migrateDailyXpTenths converts them.
  async getDailyXpTenths(date: string): Promise<number> {
    return this.store.readDailyXpTenths(date);
  }

  async addDailyXpTenths(date: string, delta: number): Promise<number> {
    await this.store.addDailyXpTenths(date, delta);
    return this.getDailyXpTenths(date);
  }

  // Game tab tables, scoped to the active pair like every
  // other per-pair setting/state in this interface.
  async getGameProgress(gameId: string) {
    return this.store.readGameProgress(await this.ready(), gameId);
  }

  async setGameProgress(gameId: string, itemId: string, state: string, data?: unknown) {
    await this.store.writeGameProgress(await this.ready(), gameId, itemId, state, data);
  }

  async resetGameProgress(gameId: string) {
    await this.store.deleteGameProgress(await this.ready(), gameId);
  }

  // the level exam result, see lib/exam/result.ts.
  async getExamResults(): Promise<ExamResults> {
    return readExamResults(this);
  }

  async saveExamResult(level: string, pct: number, passed: boolean, date: string): Promise<ExamResult> {
    return writeExamResult(this, level, pct, passed, date);
  }

  // PCIC tab, SM-2, independent of the FSRS `cards`. Not
  // tied to a pair (the tab only works with es→en items).
  async getPcicCards(): Promise<Sm2Card[]> {
    return this.store.readPcicCards();
  }

  async getPcicCard(itemId: string): Promise<Sm2Card | null> {
    return this.store.readPcicCard(itemId);
  }

  async upsertPcicCard(card: Sm2Card): Promise<void> {
    await this.store.writePcicCard(card);
  }

  // beta switches (lib/beta.ts), app-wide like the status-bar tint, so in user_meta
  // as one JSON object; a missing / broken value reads as {} (every flag off).
  async getBetaFlags(): Promise<Record<string, boolean>> {
    return parseBetaFlagMap(await this.store.readMeta('beta_flags'));
  }

  async setBetaFlag(flag: string, on: boolean): Promise<void> {
    const next = { ...(await this.getBetaFlags()), [flag]: on };
    await this.store.writeMeta('beta_flags', JSON.stringify(next));
  }

  // The unfinished Practice-tab round as one JSON string (lib/practice/practiceRound.ts parses it),
  // app-wide like the beta flags, so in user_meta.practice_round; null = none.
  async getPracticeRound(): Promise<string | null> {
    const v = await this.store.readMeta('practice_round');
    return typeof v === 'string' ? v : null;
  }

  async setPracticeRound(json: string | null): Promise<void> {
    await this.store.writeMeta('practice_round', json);
  }

  // `levelPrefix` (e.g. "a1") no longer gives the LIKE pattern
  // (since the difficulty re-leveling, an id's prefix is not necessarily its real level,
  // see matchesLevel in lib/pcicLevels.ts), it is the name of the level to clear; the
  // real id list is fetched from the loaded corpus.
  async resetPcicCards(levelPrefix?: string): Promise<void> {
    if (!levelPrefix) return this.store.deletePcicCards();
    const ids = pcicItemsForLevel(levelPrefix.toUpperCase() as PcicLevel).map((i) => i.id);
    if (ids.length === 0) return;
    await this.store.deletePcicCards(ids);
  }

  // the batch's JSON goes into the `json` column as a whole
  // (the report reads from it), reloading a `batchId` replaces the content.
  async saveMistakeBatch(batchId: string, json: string, importedAt: string): Promise<void> {
    await this.store.writeMistakeBatch(batchId, json, importedAt);
  }

  async getMistakeBatches(): Promise<MistakeBatchRow[]> {
    return this.store.readMistakeBatches();
  }

  async getMistakeCards(): Promise<Sm2Card[]> {
    return this.store.readMistakeCards();
  }

  async upsertMistakeCard(card: Sm2Card): Promise<void> {
    await this.store.writeMistakeCard(card);
  }

  // Q0: full learning-state backup, every table across all pairs.
  async exportAll(): Promise<BackupPayload> {
    const tables = await this.store.exportTables();
    // user_id (NOT NULL, key stays) is a leftover identifier of older installs: never export it.
    tables.user_meta = tables.user_meta.map((r: any) => ({ ...r, user_id: '' }));
    // pcic_cards.known was added with a bare ALTER (no default): rows from before it keep NULL.
    tables.pcic_cards = tables.pcic_cards.map((r: any) => ({ ...r, known: r.known ? 1 : 0 }));
    return {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      appVersion: getAppVersion(),
      tables,
    };
  }

  // Q0: restore, replaces the whole learning state (the store decides how atomically).
  async importAll(payload: BackupPayload): Promise<void> {
    await this.ready();
    await this.store.importTables(payload.tables);
    // The imported onboarding decides the active pair from here on, corrected
    // to the single supported pair if the backup carries an older one (same
    // rule as the app/_layout.tsx startup check).
    const ob = await this.store.readOnboarding();
    if (ob && needsPairCorrection(ob)) {
      await this.setOnboarding(FORCED_PAIR.source, FORCED_PAIR.target);
    } else if (ob) {
      this.activePair = `${ob.source}-${ob.target}`;
    }
  }
}
