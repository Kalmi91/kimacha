import * as SQLite from 'expo-sqlite';
import { BACKUP_SCHEMA_VERSION, BACKUP_TABLES, getAppVersion, type BackupPayload } from './backup';
import { FORCED_PAIR, needsPairCorrection } from './languages';
import { localDateString, summarizeUsage, DEFAULT_WEEKLY_GOAL_MINUTES, DEFAULT_DAILY_NEW_LIMIT, type UsageStats } from './usageStats';
import type { Sm2Card } from './sm2';
import { addDays } from './sm2';
import type { PcicLevel } from '@/data/pcic';
import { runMigrations, applyWordMerges } from './db/migrations';

// PLAN-play 10. lépés: egy meglévő telepítésen a haladás ma "b1-..." id-kkel
// forog, ezért az oszlop hiánya (régi DB) B1-re esik vissza, nem A1-re.
const DEFAULT_PCIC_LEVEL: PcicLevel = 'B1';

export interface DB {
  getStreak(): Promise<{ current_count: number; last_date: string | null; longest_count: number }>;
  getOnboarding(): Promise<{ source: string; target: string } | null>;
  setOnboarding(source: string, target: string): Promise<void>;
  getLevel(): Promise<{ level: string; correct_streak: number; mistakes_in_window: number; fail_streak: number }>;
  claimDailyGreeting(): Promise<boolean>;
  getStatusBarTint(): Promise<number>;
  setStatusBarTint(index: number): Promise<void>;
  // PLAN-play 12. lépés: napi streak-írás visszakerült (a Tanulás fül vitte
  // el, a PCIC-értékelés az egyetlen hívó innentől, lásd app/(tabs)/index.tsx).
  updateStreak(): Promise<void>;
  addToSpellingList(wordId: number): Promise<void>;
  getSpellingList(): Promise<{ wordId: number; step: number; due: string }[]>;
  getSpellingDueCount(): Promise<number>;
  // FB186: a lista TELJES mérete, hogy a Beállítások sora meg tudja mondani,
  // a szám esedékes gyakorlás-e vagy összesen ennyi szó van a listán.
  getSpellingListCount(): Promise<number>;
  updateSpellingStep(wordId: number, step: number, due: string): Promise<void>;
  // PLAN-play 12. lépés (s3): PCIC-tétel a helyesírás-listán, a fenti
  // word_id-alapú listától külön (a PCIC id string, pl. "b1-0184"). Nem
  // pair-hez kötött, mint a pcic_cards tábla.
  addToPcicSpellingList(itemId: string): Promise<void>;
  getPcicSpellingList(): Promise<{ itemId: string; step: number; due: string }[]>;
  getPcicSpellingDueCount(): Promise<number>;
  getPcicSpellingListCount(): Promise<number>;
  updatePcicSpellingStep(itemId: string, step: number, due: string): Promise<void>;
  getStrictAccents(): Promise<boolean>;
  setStrictAccents(v: boolean): Promise<void>;
  // FB188: a névelő-gombsor a gépelős spanyol főnév-kártyán, ki-be kapcsolható.
  getArticlePicker(): Promise<boolean>;
  setArticlePicker(v: boolean): Promise<void>;
  getWeeklyGoalMinutes(): Promise<number>;
  setWeeklyGoalMinutes(minutes: number): Promise<void>;
  getFeedbackBtnSide(): Promise<'left' | 'right'>;
  setFeedbackBtnSide(side: 'left' | 'right'): Promise<void>;
  getDailyNewLimit(): Promise<number>;
  setDailyNewLimit(limit: number): Promise<void>;
  addUsageMinute(): Promise<number>;
  getUsageStats(): Promise<UsageStats>;
  getDayStats(date: string): Promise<{ minutes: number; words: number }>;
  // GAMES.md 3.5 (F0): Game fül tables, scoped to the active pair like every
  // other per-pair setting/state in this interface.
  getGameProgress(gameId: string): Promise<{ itemId: string; state: string; data: unknown }[]>;
  setGameProgress(gameId: string, itemId: string, state: string, data?: unknown): Promise<void>;
  // PLAN-pcic 4. lépés: PCIC fül, SM-2, független a FSRS `cards`-tól
  getPcicCards(): Promise<Sm2Card[]>;
  upsertPcicCard(card: Sm2Card): Promise<void>;
  getPcicStats(today: string): Promise<{ total: number; newIntroducedToday: number; dueToday: number; learned: number }>;
  // PLAN-play 10. lépés: a kiválasztott PCIC szint (A1-B2), app-szintű, mint a
  // status-bar tint. `levelPrefix` opcionális: csak azt a szintet üríti ki
  // (item-id előtag szerint), üresen az egész táblát, mint eddig.
  getPcicLevel(): Promise<PcicLevel>;
  setPcicLevel(level: PcicLevel): Promise<void>;
  resetPcicCards(levelPrefix?: string): Promise<void>;
  exportAll(): Promise<BackupPayload>;
  importAll(payload: BackupPayload): Promise<void>;
}

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

  // PLAN-play 12. lépés: visszahozva (a Tanulás fül vitte el a lépés 3-ban),
  // a PCIC-értékelés hívja, napi első hívás számít csak (a last_date őrzi).
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

  // FB83: which of the status-bar blues the user picked, as an index into
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

  // PLAN-play 10. lépés: a kiválasztott PCIC szint, app-szintű mint a fenti tint.
  async getPcicLevel(): Promise<PcicLevel> {
    const db = await this.open();
    const row = await db.getFirstAsync<any>('SELECT pcic_level FROM user_meta WHERE id = 1');
    return (row?.pcic_level as PcicLevel) ?? DEFAULT_PCIC_LEVEL;
  }

  async setPcicLevel(level: PcicLevel): Promise<void> {
    const db = await this.open();
    await db.runAsync('UPDATE user_meta SET pcic_level = ? WHERE id = 1', [level]);
  }

  // FB76: "first open of the day" marker for the greeting. Claiming it is a
  // single write, so only the first caller of the day sees `true`.
  async claimDailyGreeting(): Promise<boolean> {
    const db = await this.open();
    const today = localDateString();
    const row = await db.getFirstAsync<any>('SELECT last_open_date FROM user_meta WHERE id = 1');
    if (row?.last_open_date === today) return false;
    await db.runAsync('UPDATE user_meta SET last_open_date = ? WHERE id = 1', [today]);
    return true;
  }

  // FB39: spelling-practice list, scoped to the active pair like cards.
  async addToSpellingList(wordId: number) {
    const db = await this.open();
    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT OR IGNORE INTO spelling_list (pair, word_id, step, due) VALUES (?, ?, 0, ?)',
      [this.activePair, wordId, now]
    );
  }

  async getSpellingList() {
    const db = await this.open();
    const rows = await db.getAllAsync<any>('SELECT word_id, step, due FROM spelling_list WHERE pair = ?', [this.activePair]);
    return rows.map((r: any) => ({ wordId: r.word_id, step: r.step, due: r.due }));
  }

  async getSpellingDueCount() {
    const db = await this.open();
    const row = await db.getFirstAsync<any>(
      'SELECT COUNT(*) as cnt FROM spelling_list WHERE pair = ? AND due <= ?',
      [this.activePair, new Date().toISOString()]
    );
    return row?.cnt ?? 0;
  }

  async getSpellingListCount() {
    const db = await this.open();
    const row = await db.getFirstAsync<any>(
      'SELECT COUNT(*) as cnt FROM spelling_list WHERE pair = ?',
      [this.activePair]
    );
    return row?.cnt ?? 0;
  }

  async updateSpellingStep(wordId: number, step: number, due: string) {
    const db = await this.open();
    await db.runAsync(
      'UPDATE spelling_list SET step = ?, due = ? WHERE pair = ? AND word_id = ?',
      [step, due, this.activePair, wordId]
    );
  }

  // PLAN-play 12. lépés (s3): ugyanaz, mint a fenti négy metódus, de a
  // PCIC-tétel string id-jére (pl. "b1-0184"), nem pair-hez kötve, mint a
  // pcic_cards tábla.
  async addToPcicSpellingList(itemId: string) {
    const db = await this.open();
    const now = new Date().toISOString();
    await db.runAsync('INSERT OR IGNORE INTO pcic_spelling_list (item_id, step, due) VALUES (?, 0, ?)', [itemId, now]);
  }

  async getPcicSpellingList() {
    const db = await this.open();
    const rows = await db.getAllAsync<any>('SELECT item_id, step, due FROM pcic_spelling_list');
    return rows.map((r: any) => ({ itemId: r.item_id, step: r.step, due: r.due }));
  }

  async getPcicSpellingDueCount() {
    const db = await this.open();
    const row = await db.getFirstAsync<any>(
      'SELECT COUNT(*) as cnt FROM pcic_spelling_list WHERE due <= ?',
      [new Date().toISOString()]
    );
    return row?.cnt ?? 0;
  }

  async getPcicSpellingListCount() {
    const db = await this.open();
    const row = await db.getFirstAsync<any>('SELECT COUNT(*) as cnt FROM pcic_spelling_list');
    return row?.cnt ?? 0;
  }

  async updatePcicSpellingStep(itemId: string, step: number, due: string) {
    const db = await this.open();
    await db.runAsync('UPDATE pcic_spelling_list SET step = ?, due = ? WHERE item_id = ?', [step, due, itemId]);
  }

  // FB132: difficulty switch, per pair (accents matter in Spanish, less so in
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

  // FB188, Kálmán 2026-09-08: „ne begépelni kelljen a el la t hanem kiválasztani".
  // Alapból BE, mert ő kérte; a kapcsoló azért van, hogy vissza tudjon állni
  // gépelésre, ha mégsem válik be ("kíváncsi vagyok hogy milyen").
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

  // FB65: weekly study goal in minutes, compared against the rolling 7-day
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

  // FB77: daily new-word budget. The standing limit lives in learn_settings,
  // the "+5 new words" taps add a bonus that expires with the calendar day.
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
  // FB63: returns today's new total so the timer can spot a milestone crossing
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

  // FB108: what one local calendar day added up to, for the midnight celebration.
  // `words` counts DISTINCT word cards touched that day, not raw attempts, so a
  // word drilled five times still reads as one word learned.
  async getDayStats(date: string): Promise<{ minutes: number; words: number }> {
    const db = await this.open();
    const usage = await db.getFirstAsync<any>('SELECT minutes FROM usage_minutes WHERE date = ?', [date]);
    const rows = await db.getAllAsync<any>(
      "SELECT DISTINCT word_id, timestamp FROM card_attempts WHERE type = 'word'"
    );
    const words = new Set(
      rows.filter((r: any) => localDateString(new Date(r.timestamp)) === date).map((r: any) => r.word_id)
    );
    return { minutes: usage?.minutes ?? 0, words: words.size };
  }

  // GAMES.md 3.5 (F0): Game fül tables, scoped to the active pair like every
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

  // PLAN-pcic 4. lépés: PCIC fül, SM-2, független a FSRS `cards`-tól. Nem
  // pair-hez kötött (a fül csak es→en tételekkel dolgozik).
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

  async getPcicStats(today: string): Promise<{ total: number; newIntroducedToday: number; dueToday: number; learned: number }> {
    const db = await this.open();
    const total = await db.getFirstAsync<any>('SELECT COUNT(*) as c FROM pcic_cards');
    const newIntroducedToday = await db.getFirstAsync<any>(
      'SELECT COUNT(*) as c FROM pcic_cards WHERE introduced_at = ?',
      [today]
    );
    const dueToday = await db.getFirstAsync<any>(
      "SELECT COUNT(*) as c FROM pcic_cards WHERE (state = 'review' OR state = 'learning') AND due <= ?",
      [today]
    );
    const learned = await db.getFirstAsync<any>(
      "SELECT COUNT(*) as c FROM pcic_cards WHERE state = 'review' AND interval >= 21"
    );
    return {
      total: total?.c ?? 0,
      newIntroducedToday: newIntroducedToday?.c ?? 0,
      dueToday: dueToday?.c ?? 0,
      learned: learned?.c ?? 0,
    };
  }

  async resetPcicCards(levelPrefix?: string): Promise<void> {
    const db = await this.open();
    if (levelPrefix) {
      await db.runAsync('DELETE FROM pcic_cards WHERE item_id LIKE ?', [`${levelPrefix}-%`]);
    } else {
      await db.runAsync('DELETE FROM pcic_cards');
    }
  }

  // Q0: full learning-state backup, every table across all pairs.
  async exportAll(): Promise<BackupPayload> {
    const db = await this.open();
    const tables = {} as BackupPayload['tables'];
    for (const table of BACKUP_TABLES) {
      tables[table] = await db.getAllAsync(`SELECT * FROM ${table}`);
    }
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
        await db.runAsync(`DELETE FROM ${table}`);
        for (const row of payload.tables[table] ?? []) {
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
  }
}

let instance: DB;
export function getDb(): DB {
  if (!instance) instance = new SQLiteDB();
  return instance;
}
