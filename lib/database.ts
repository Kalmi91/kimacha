import * as SQLite from 'expo-sqlite';
import { BACKUP_SCHEMA_VERSION, BACKUP_TABLES, getAppVersion, type BackupPayload } from './backup';
import { FORCED_PAIR, needsPairCorrection } from './languages';
import { localDateString, summarizeUsage, DEFAULT_WEEKLY_GOAL_MINUTES, DEFAULT_DAILY_NEW_LIMIT, type UsageStats } from './usageStats';
import type { Sm2Card } from './sm2';
import { addDays } from './sm2';
import { PCIC_LEVELS, pcicItemsForLevel, type PcicLevel } from '@/data/pcic';
import type { MistakeBatchRow } from './mistakes/deck';
import { runMigrations, applyWordMerges, applyPcicLevelMoves, applyPcicDedup } from './db/migrations';
import { DEFAULT_AGAIN_DELAY_SEC } from './pcicSession';
import { DEFAULT_GRAMMAR_PALETTE, isGrammarPaletteId, type GrammarPaletteId } from '@/constants/GrammarPalettes';
import { isSkinSelection, parseSkinMix, type SkinMix, type SkinSelection } from '@/constants/Skins';
import { readExamResults, writeExamResult } from './exam/result';
import type { ExamResult, ExamResults } from './exam/types';
import type { DB } from './dbTypes';

export type { DB };

// on an existing installation the progress currently runs with "b1-..." ids,
// so a missing column (old DB) falls back to B1, not A1.
const DEFAULT_PCIC_LEVEL: PcicLevel = 'B1';

class SQLiteDB implements DB {
  private db: SQLite.SQLiteDatabase | null = null;
  // Active language pair (e.g. "es-hu"). All learning progress (cards + level) is
  // scoped to this pair, so each language you study keeps its own progress.
  private activePair = 'es-hu';

  private async open() {
    if (this.db) return this.db;
    this.db = await SQLite.openDatabaseAsync('kimacha.db');
    this.activePair = await runMigrations(this.db);
    return this.db;
  }

  async getStreak() {
    const db = await this.open();
    return await db.getFirstAsync<any>('SELECT * FROM streak WHERE id = 1');
  }

  // brought back (the Learn tab took it away in an earlier step),
  // called by the PCIC grading, only the first call of the day counts (last_date keeps track).
  async updateStreak() {
    const db = await this.open();
    const today = localDateString();
    const streak = await this.getStreak();
    if (streak.last_date === today) return;
    const yesterday = addDays(today, -1);
    const newCount = streak.last_date === yesterday ? streak.current_count + 1 : 1;
    const longest = Math.max(newCount, streak.longest_count);
    await db.runAsync('UPDATE streak SET current_count = ?, last_date = ?, longest_count = ? WHERE id = 1', [newCount, today, longest]);
  }

  async getOnboarding() {
    const db = await this.open();
    const row = await db.getFirstAsync<any>('SELECT source, target FROM onboarding WHERE id = 1');
    return row ?? null;
  }

  async setOnboarding(source: string, target: string) {
    const db = await this.open();
    await db.runAsync('INSERT OR REPLACE INTO onboarding (id, source, target) VALUES (1, ?, ?)', [source, target]);
    this.activePair = `${source}-${target}`;
  }

  async getLevel() {
    const db = await this.open();
    await db.runAsync("INSERT OR IGNORE INTO user_level (pair, level) VALUES (?, 'A0')", [this.activePair]);
    return await db.getFirstAsync<any>('SELECT * FROM user_level WHERE pair = ?', [this.activePair]);
  }

  // which of the status-bar blues the user picked, as an index into
  // STATUS_BAR_TINTS. App-wide, so it lives in user_meta, not per language pair.
  async getStatusBarTint(): Promise<number> {
    const db = await this.open();
    const row = await db.getFirstAsync<any>('SELECT status_bar_tint FROM user_meta WHERE id = 1');
    return typeof row?.status_bar_tint === 'number' ? row.status_bar_tint : 0;
  }

  async setStatusBarTint(index: number): Promise<void> {
    const db = await this.open();
    await db.runAsync('UPDATE user_meta SET status_bar_tint = ? WHERE id = 1', [index]);
  }

  // the app-wide color palette (constants/GrammarPalettes.ts). Like the
  // status-bar tint it is not per language pair, so it lives in user_meta.
  async getGrammarPalette(): Promise<GrammarPaletteId> {
    const db = await this.open();
    const row = await db.getFirstAsync<any>('SELECT grammar_palette FROM user_meta WHERE id = 1');
    return isGrammarPaletteId(row?.grammar_palette) ? row.grammar_palette : DEFAULT_GRAMMAR_PALETTE;
  }

  async setGrammarPalette(id: GrammarPaletteId): Promise<void> {
    const db = await this.open();
    await db.runAsync('UPDATE user_meta SET grammar_palette = ? WHERE id = 1', [id]);
  }

  // the chosen theme. NULL = the user has not chosen yet: the caller
  // (lib/ThemeContext.tsx) decides from the saved palette (classic → classic, anything else → brutal).
  async getSkin(): Promise<SkinSelection | null> {
    const db = await this.open();
    const row = await db.getFirstAsync<any>('SELECT skin FROM user_meta WHERE id = 1');
    return isSkinSelection(row?.skin) ? row.skin : null;
  }

  async setSkin(id: SkinSelection | null): Promise<void> {
    const db = await this.open();
    await db.runAsync('UPDATE user_meta SET skin = ? WHERE id = 1', [id]);
  }

  // The four sources of My mix as JSON; an invalid / missing value = null.
  async getSkinMix(): Promise<SkinMix | null> {
    const db = await this.open();
    const row = await db.getFirstAsync<any>('SELECT skin_mix FROM user_meta WHERE id = 1');
    return parseSkinMix(row?.skin_mix);
  }

  async setSkinMix(mix: SkinMix): Promise<void> {
    const db = await this.open();
    await db.runAsync('UPDATE user_meta SET skin_mix = ? WHERE id = 1', [JSON.stringify(mix)]);
  }

  // the selected PCIC level.
  // Instead of a user_meta singleton
  // column it moved into the per-pair row of learn_settings (like the
  // other learning settings), so that on a direction switch both pairs keep their
  // OWN level. Migration of the old (en-es) value: runMigrations.
  async getPcicLevel(): Promise<PcicLevel> {
    const db = await this.open();
    const row = await db.getFirstAsync<any>('SELECT pcic_level FROM learn_settings WHERE pair = ?', [this.activePair]);
    // A level name chosen in an older build and since removed (e.g. "A1+") falls back to the default.
    if (row?.pcic_level && (PCIC_LEVELS as string[]).includes(row.pcic_level)) return row.pcic_level as PcicLevel;
    // for es→en only A1 has content (for now); every other pair falls back to
    // the old B1 default (because of the existing "b1-..." progress).
    return this.activePair.endsWith('-en') ? 'A1' : DEFAULT_PCIC_LEVEL;
  }

  // Whether the active pair ALREADY has an explicitly chosen level (the
  // fallback above does not count as one). The Settings direction-switch row uses this to decide
  // whether the level picker sheet should pop up once in the new direction.
  async hasPcicLevel(): Promise<boolean> {
    const db = await this.open();
    const row = await db.getFirstAsync<any>('SELECT pcic_level FROM learn_settings WHERE pair = ?', [this.activePair]);
    return !!row?.pcic_level;
  }

  async setPcicLevel(level: PcicLevel): Promise<void> {
    const db = await this.open();
    await db.runAsync(
      `INSERT INTO learn_settings (pair, pcic_level) VALUES (?, ?)
       ON CONFLICT(pair) DO UPDATE SET pcic_level = excluded.pcic_level`,
      [this.activePair, level]
    );
  }

  // "first open of the day" marker for the greeting. Claiming it is a
  // single write, so only the first caller of the day sees `true`.
  async claimDailyGreeting(): Promise<boolean> {
    const db = await this.open();
    const today = localDateString();
    const row = await db.getFirstAsync<any>('SELECT last_open_date FROM user_meta WHERE id = 1');
    if (row?.last_open_date === today) return false;
    await db.runAsync('UPDATE user_meta SET last_open_date = ? WHERE id = 1', [today]);
    return true;
  }

  // difficulty switch, per pair (accents matter in Spanish, less so in
  // English), default off so beginners keep the forgiving grader.
  async getStrictAccents(): Promise<boolean> {
    const db = await this.open();
    const row = await db.getFirstAsync<any>('SELECT strict_accents FROM learn_settings WHERE pair = ?', [this.activePair]);
    return row?.strict_accents === 1;
  }

  async setStrictAccents(v: boolean): Promise<void> {
    const db = await this.open();
    await db.runAsync(
      'INSERT INTO learn_settings (pair, strict_accents) VALUES (?, ?) ON CONFLICT(pair) DO UPDATE SET strict_accents = excluded.strict_accents',
      [this.activePair, v ? 1 : 0]
    );
  }

  // adjustable: after how many seconds a missed PCIC card
  // comes back no matter what (lib/pcicSession.ts).
  async getAgainDelaySec(): Promise<number> {
    const db = await this.open();
    const row = await db.getFirstAsync<any>('SELECT again_delay_sec FROM learn_settings WHERE pair = ?', [this.activePair]);
    return typeof row?.again_delay_sec === 'number' ? row.again_delay_sec : DEFAULT_AGAIN_DELAY_SEC;
  }

  async setAgainDelaySec(sec: number): Promise<void> {
    const db = await this.open();
    await db.runAsync(
      'INSERT INTO learn_settings (pair, again_delay_sec) VALUES (?, ?) ON CONFLICT(pair) DO UPDATE SET again_delay_sec = excluded.again_delay_sec',
      [this.activePair, sec]
    );
  }

  // User feedback: "I should not have to type the el la but pick it".
  // ON by default, because the user asked for it; the switch exists so they can go back
  // to typing if it does not work out ("I am curious what it will be like").
  async getArticlePicker(): Promise<boolean> {
    const db = await this.open();
    const row = await db.getFirstAsync<any>('SELECT article_picker FROM learn_settings WHERE pair = ?', [this.activePair]);
    return row?.article_picker !== 0;
  }

  async setArticlePicker(v: boolean): Promise<void> {
    const db = await this.open();
    await db.runAsync(
      'INSERT INTO learn_settings (pair, article_picker) VALUES (?, ?) ON CONFLICT(pair) DO UPDATE SET article_picker = excluded.article_picker',
      [this.activePair, v ? 1 : 0]
    );
  }

  // weekly study goal in minutes, compared against the rolling 7-day
  // usage total on the Stats tab. Stored per pair like the other learn settings
  // (the measured minutes themselves are app-wide, see usage_minutes).
  async getWeeklyGoalMinutes(): Promise<number> {
    const db = await this.open();
    const row = await db.getFirstAsync<any>('SELECT weekly_goal_minutes FROM learn_settings WHERE pair = ?', [this.activePair]);
    return typeof row?.weekly_goal_minutes === 'number' ? row.weekly_goal_minutes : DEFAULT_WEEKLY_GOAL_MINUTES;
  }

  async setWeeklyGoalMinutes(minutes: number): Promise<void> {
    const db = await this.open();
    await db.runAsync(
      'INSERT INTO learn_settings (pair, weekly_goal_minutes) VALUES (?, ?) ON CONFLICT(pair) DO UPDATE SET weekly_goal_minutes = excluded.weekly_goal_minutes',
      [this.activePair, minutes]
    );
  }

  // daily new-word budget. The standing limit lives in learn_settings,
  // the "+10 new words" taps (PCIC) add a bonus that expires with
  // the calendar day (getPcicNewBonus/setPcicNewBonus below).
  async getDailyNewLimit(): Promise<number> {
    const db = await this.open();
    const row = await db.getFirstAsync<any>('SELECT daily_new_limit FROM learn_settings WHERE pair = ?', [this.activePair]);
    return typeof row?.daily_new_limit === 'number' ? row.daily_new_limit : DEFAULT_DAILY_NEW_LIMIT;
  }

  async setDailyNewLimit(limit: number): Promise<void> {
    const db = await this.open();
    await db.runAsync(
      'INSERT INTO learn_settings (pair, daily_new_limit) VALUES (?, ?) ON CONFLICT(pair) DO UPDATE SET daily_new_limit = excluded.daily_new_limit',
      [this.activePair, limit]
    );
  }

  // the columns already existed (the retired Learn tab) but
  // had no reader/writer since that tab left; the PCIC "+10 new words" tap
  // reuses them instead of adding a new pair of columns. `new_bonus_date`
  // decides whether the stored bonus still counts (0 once the day rolls over).
  async getPcicNewBonus(today: string): Promise<number> {
    const db = await this.open();
    const row = await db.getFirstAsync<any>('SELECT new_bonus, new_bonus_date FROM learn_settings WHERE pair = ?', [this.activePair]);
    if (row?.new_bonus_date !== today) return 0;
    return typeof row?.new_bonus === 'number' ? row.new_bonus : 0;
  }

  async setPcicNewBonus(bonus: number, today: string): Promise<void> {
    const db = await this.open();
    await db.runAsync(
      'INSERT INTO learn_settings (pair, new_bonus, new_bonus_date) VALUES (?, ?, ?) ON CONFLICT(pair) DO UPDATE SET new_bonus = excluded.new_bonus, new_bonus_date = excluded.new_bonus_date',
      [this.activePair, bonus, today]
    );
  }

  async getFeedbackBtnSide(): Promise<'left' | 'right'> {
    const db = await this.open();
    const row = await db.getFirstAsync<any>('SELECT feedback_btn_side FROM learn_settings WHERE pair = ?', [this.activePair]);
    return row?.feedback_btn_side === 'left' ? 'left' : 'right';
  }

  async setFeedbackBtnSide(side: 'left' | 'right'): Promise<void> {
    const db = await this.open();
    await db.runAsync(
      'INSERT INTO learn_settings (pair, feedback_btn_side) VALUES (?, ?) ON CONFLICT(pair) DO UPDATE SET feedback_btn_side = excluded.feedback_btn_side',
      [this.activePair, side]
    );
  }

  // Usage-timer feature: one row per local calendar day, not scoped to a
  // language pair (it's app-wide active-use time, not learning progress).
  // Returns today's new total so the timer can spot a milestone crossing
  // (30/60 minutes) without re-reading the whole usage table every minute.
  async addUsageMinute(): Promise<number> {
    const db = await this.open();
    const date = localDateString();
    await db.runAsync(
      'INSERT INTO usage_minutes (date, minutes) VALUES (?, 1) ON CONFLICT(date) DO UPDATE SET minutes = minutes + 1',
      [date]
    );
    const row = await db.getFirstAsync<any>('SELECT minutes FROM usage_minutes WHERE date = ?', [date]);
    return row?.minutes ?? 0;
  }

  async getUsageStats(): Promise<UsageStats> {
    const db = await this.open();
    const rows = await db.getAllAsync<any>('SELECT date, minutes FROM usage_minutes');
    return summarizeUsage(rows.map((r: any) => ({ date: r.date, minutes: r.minutes })));
  }

  // what one local calendar day added up to, for the midnight celebration.
  // `words` is the number of PCIC words first introduced that local day
  // (introduced_at = date, the same rule as the daily new-word limit), so a
  // word drilled five times still reads as one word learned. Unlike the daily
  // budget it does not drop orphaned cards (ids no longer in the corpus).
  async getDayStats(date: string): Promise<{ minutes: number; words: number }> {
    const db = await this.open();
    const usage = await db.getFirstAsync<any>('SELECT minutes FROM usage_minutes WHERE date = ?', [date]);
    const learned = await db.getFirstAsync<any>('SELECT COUNT(*) AS n FROM pcic_cards WHERE introduced_at = ?', [date]);
    return { minutes: usage?.minutes ?? 0, words: learned?.n ?? 0 };
  }

  // Game tab tables, scoped to the active pair like every
  // other per-pair setting/state in this interface.
  async getGameProgress(gameId: string) {
    const db = await this.open();
    const rows = await db.getAllAsync<any>(
      'SELECT item_id, state, data_json FROM game_progress WHERE pair = ? AND game_id = ?',
      [this.activePair, gameId]
    );
    return rows.map((r: any) => {
      let data: unknown = undefined;
      if (r.data_json) {
        try {
          data = JSON.parse(r.data_json);
        } catch {
          data = undefined;
        }
      }
      return { itemId: r.item_id, state: r.state, data };
    });
  }

  async setGameProgress(gameId: string, itemId: string, state: string, data?: unknown) {
    const db = await this.open();
    await db.runAsync(
      `INSERT INTO game_progress (pair, game_id, item_id, state, data_json) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(pair, game_id, item_id) DO UPDATE SET state = excluded.state, data_json = excluded.data_json`,
      [this.activePair, gameId, itemId, state, data !== undefined ? JSON.stringify(data) : null]
    );
  }

  async resetGameProgress(gameId: string) {
    const db = await this.open();
    await db.runAsync('DELETE FROM game_progress WHERE pair = ? AND game_id = ?', [this.activePair, gameId]);
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
    const db = await this.open();
    const rows = await db.getAllAsync<any>('SELECT * FROM pcic_cards');
    return rows.map((r: any) => ({
      itemId: r.item_id,
      state: r.state,
      step: r.step,
      ease: r.ease,
      interval: r.interval,
      reps: r.reps,
      lapses: r.lapses,
      due: r.due,
      lastReview: r.last_review,
      introducedAt: r.introduced_at,
      known: !!r.known,
    }));
  }

  async upsertPcicCard(card: Sm2Card): Promise<void> {
    const db = await this.open();
    await db.runAsync(
      `INSERT INTO pcic_cards (item_id, state, step, ease, interval, reps, lapses, due, last_review, introduced_at, known)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(item_id) DO UPDATE SET
         state = excluded.state, step = excluded.step, ease = excluded.ease,
         interval = excluded.interval, reps = excluded.reps, lapses = excluded.lapses,
         due = excluded.due, last_review = excluded.last_review, introduced_at = excluded.introduced_at,
         known = excluded.known`,
      [card.itemId, card.state, card.step, card.ease, card.interval, card.reps, card.lapses, card.due, card.lastReview, card.introducedAt, card.known ? 1 : 0]
    );
  }

  // `levelPrefix` (e.g. "a1") no longer gives the LIKE pattern
  // (since the difficulty re-leveling, an id's prefix is not necessarily its real level,
  // see matchesLevel in lib/pcicLevels.ts), it is the name of the level to clear; the
  // real id list is fetched from the loaded corpus.
  async resetPcicCards(levelPrefix?: string): Promise<void> {
    const db = await this.open();
    if (levelPrefix) {
      const ids = pcicItemsForLevel(levelPrefix.toUpperCase() as PcicLevel).map((i) => i.id);
      if (ids.length === 0) return;
      const placeholders = ids.map(() => '?').join(',');
      await db.runAsync(`DELETE FROM pcic_cards WHERE item_id IN (${placeholders})`, ids);
    } else {
      await db.runAsync('DELETE FROM pcic_cards');
    }
  }

  // the batch's JSON goes into the `json` column as a whole
  // (the report reads from it), reloading a `batchId` replaces the content.
  async saveMistakeBatch(batchId: string, json: string, importedAt: string): Promise<void> {
    const db = await this.open();
    await db.runAsync(
      `INSERT INTO mistake_batches (batch_id, json, imported_at) VALUES (?, ?, ?)
       ON CONFLICT(batch_id) DO UPDATE SET json = excluded.json, imported_at = excluded.imported_at`,
      [batchId, json, importedAt]
    );
  }

  async getMistakeBatches(): Promise<MistakeBatchRow[]> {
    const db = await this.open();
    const rows = await db.getAllAsync<any>('SELECT * FROM mistake_batches ORDER BY imported_at DESC');
    return rows.map((r: any) => ({ batchId: r.batch_id, json: r.json, importedAt: r.imported_at }));
  }

  async getMistakeCards(): Promise<Sm2Card[]> {
    const db = await this.open();
    const rows = await db.getAllAsync<any>('SELECT * FROM mistake_cards');
    return rows.map((r: any) => ({
      itemId: r.item_id,
      state: r.state,
      step: r.step,
      ease: r.ease,
      interval: r.interval,
      reps: r.reps,
      lapses: r.lapses,
      due: r.due,
      lastReview: r.last_review,
      introducedAt: r.introduced_at,
      known: !!r.known,
    }));
  }

  async upsertMistakeCard(card: Sm2Card): Promise<void> {
    const db = await this.open();
    await db.runAsync(
      `INSERT INTO mistake_cards (item_id, state, step, ease, interval, reps, lapses, due, last_review, introduced_at, known)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(item_id) DO UPDATE SET
         state = excluded.state, step = excluded.step, ease = excluded.ease,
         interval = excluded.interval, reps = excluded.reps, lapses = excluded.lapses,
         due = excluded.due, last_review = excluded.last_review, introduced_at = excluded.introduced_at,
         known = excluded.known`,
      [card.itemId, card.state, card.step, card.ease, card.interval, card.reps, card.lapses, card.due, card.lastReview, card.introducedAt, card.known ? 1 : 0]
    );
  }

  // Q0: full learning-state backup, every table across all pairs.
  async exportAll(): Promise<BackupPayload> {
    const db = await this.open();
    const tables = {} as BackupPayload['tables'];
    for (const table of BACKUP_TABLES) {
      tables[table] = await db.getAllAsync(`SELECT * FROM ${table}`);
    }
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

  // Q0: restore, replaces the whole learning state. Runs in one transaction:
  // any failure (e.g. rows from an incompatible schema) rolls back and the
  // current DB stays untouched.
  async importAll(payload: BackupPayload): Promise<void> {
    const db = await this.open();
    await db.withTransactionAsync(async () => {
      for (const table of BACKUP_TABLES) {
        // A v1 file has no pcic_cards / mistake_* / usage_minutes: keep the local ones.
        const rows = payload.tables[table];
        if (!rows) continue;
        await db.runAsync(`DELETE FROM ${table}`);
        for (const row of rows) {
          const cols = Object.keys(row);
          await db.runAsync(
            `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
            cols.map(c => row[c])
          );
        }
      }
    });
    // The imported onboarding decides the active pair from here on, corrected
    // to the single supported pair if the backup carries an older one (same
    // rule as the app/_layout.tsx startup check).
    const ob = await db.getFirstAsync<any>('SELECT source, target FROM onboarding WHERE id = 1');
    if (ob && needsPairCorrection(ob)) {
      await this.setOnboarding(FORCED_PAIR.source, FORCED_PAIR.target);
    } else if (ob) {
      this.activePair = `${ob.source}-${ob.target}`;
    }
    // A backup taken before the duplicate cleanup still carries the deleted ids.
    await applyWordMerges(db);
    await applyPcicLevelMoves(db);
    await applyPcicDedup(db);
  }
}

let instance: DB;
export function getDb(): DB {
  if (!instance) instance = new SQLiteDB();
  return instance;
}
