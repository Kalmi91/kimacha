import * as SQLite from 'expo-sqlite';
import { BACKUP_SCHEMA_VERSION, BACKUP_TABLES, getAppVersion, type BackupPayload } from './backup';
import { pickSurvivor } from './cardMerge';
import { WORD_MERGES } from './wordMerges';
import { localDateString, summarizeUsage, DEFAULT_WEEKLY_GOAL_MINUTES, DEFAULT_DAILY_NEW_LIMIT, type UsageStats } from './usageStats';
import type { Sm2Card } from './sm2';

export interface DB {
  getStreak(): Promise<{ current_count: number; last_date: string | null; longest_count: number }>;
  getOnboarding(): Promise<{ source: string; target: string } | null>;
  setOnboarding(source: string, target: string): Promise<void>;
  getLevel(): Promise<{ level: string; correct_streak: number; mistakes_in_window: number; fail_streak: number }>;
  claimDailyGreeting(): Promise<boolean>;
  getStatusBarTint(): Promise<number>;
  setStatusBarTint(index: number): Promise<void>;
  getTodayStats(): Promise<{ totalReviews: number; correctCount: number; avgResponseMs: number; flashcardCount: number; typingCount: number; wordCount: number; sentenceCount: number }>;
  getMasteredCount(): Promise<number>;
  getReviewedWordCount(level: string): Promise<number>;
  getScheduledWordDueDates(): Promise<string[]>;
  addToSpellingList(wordId: number): Promise<void>;
  getSpellingList(): Promise<{ wordId: number; step: number; due: string }[]>;
  getSpellingDueCount(): Promise<number>;
  // FB186: a lista TELJES mérete, hogy a Beállítások sora meg tudja mondani,
  // a szám esedékes gyakorlás-e vagy összesen ennyi szó van a listán.
  getSpellingListCount(): Promise<number>;
  updateSpellingStep(wordId: number, step: number, due: string): Promise<void>;
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
  resetPcicCards(): Promise<void>;
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
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word_id INTEGER NOT NULL,
        type TEXT NOT NULL DEFAULT 'word',
        pair TEXT NOT NULL DEFAULT 'es-hu',
        due TEXT NOT NULL,
        stability REAL NOT NULL DEFAULT 0,
        difficulty REAL NOT NULL DEFAULT 0,
        elapsed_days INTEGER NOT NULL DEFAULT 0,
        scheduled_days INTEGER NOT NULL DEFAULT 0,
        learning_steps INTEGER NOT NULL DEFAULT 0,
        reps INTEGER NOT NULL DEFAULT 0,
        lapses INTEGER NOT NULL DEFAULT 0,
        state INTEGER NOT NULL DEFAULT 0,
        last_review TEXT,
        buried INTEGER NOT NULL DEFAULT 0,
        -- FB210: mikor járta végig a szó a létrát (a gépelős lapot is), hogy a
        -- napi új-szó keret a MEGTANULT szavakat számolhassa, ne az elkezdetteket.
        learned_at TEXT,
        -- UTEMEZO 11. szakasz: hány lapot (0-3) válaszolt helyesen a szó, és
        -- hogy éppen kézben van-e (lásd lib/lap.ts fejléce).
        lap INTEGER NOT NULL DEFAULT 0,
        in_hand INTEGER NOT NULL DEFAULT 0,
        -- UTEMEZO 2.2: mikor jött fel először a szó 1. lapja (ekkor fogy a
        -- napi keret fekete száma, nem a megtanuláskor).
        started_at TEXT,
        UNIQUE(word_id, type, pair)
      );
      CREATE TABLE IF NOT EXISTS streak (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        current_count INTEGER NOT NULL DEFAULT 0,
        last_date TEXT,
        longest_count INTEGER NOT NULL DEFAULT 0
      );
      INSERT OR IGNORE INTO streak (id, current_count, longest_count) VALUES (1, 0, 0);
      CREATE TABLE IF NOT EXISTS card_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        pair TEXT,
        correct INTEGER NOT NULL,
        response_time_ms INTEGER NOT NULL,
        timestamp TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS onboarding (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        source TEXT NOT NULL,
        target TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS user_level (
        pair TEXT PRIMARY KEY,
        level TEXT NOT NULL DEFAULT 'A0',
        correct_streak INTEGER NOT NULL DEFAULT 0,
        mistakes_in_window INTEGER NOT NULL DEFAULT 0,
        fail_streak INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS user_meta (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        user_id TEXT NOT NULL,
        first_use_date TEXT NOT NULL,
        last_sync_date TEXT,
        last_open_date TEXT,
        status_bar_tint INTEGER
      );
      CREATE TABLE IF NOT EXISTS learn_settings (
        pair TEXT PRIMARY KEY,
        words_only INTEGER,
        random_topics INTEGER,
        strict_accents INTEGER,
        article_picker INTEGER,
        requeue_level TEXT,
        feedback_btn_side TEXT,
        weekly_goal_minutes INTEGER,
        daily_new_limit INTEGER,
        new_bonus INTEGER,
        new_bonus_date TEXT,
        hand_cap INTEGER,
        gap_laps INTEGER,
        repair_gap INTEGER
      );
      CREATE TABLE IF NOT EXISTS spelling_list (
        pair TEXT NOT NULL,
        word_id INTEGER NOT NULL,
        step INTEGER NOT NULL DEFAULT 0,
        due TEXT NOT NULL,
        PRIMARY KEY (pair, word_id)
      );
      CREATE TABLE IF NOT EXISTS usage_minutes (
        date TEXT PRIMARY KEY,
        minutes INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS game_progress (
        pair TEXT NOT NULL,
        game_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        state TEXT NOT NULL,
        data_json TEXT,
        PRIMARY KEY (pair, game_id, item_id)
      );
      CREATE TABLE IF NOT EXISTS pcic_cards (
        item_id TEXT PRIMARY KEY,
        state TEXT NOT NULL DEFAULT 'new',
        step INTEGER NOT NULL DEFAULT 0,
        ease REAL NOT NULL DEFAULT 2.5,
        interval INTEGER NOT NULL DEFAULT 0,
        reps INTEGER NOT NULL DEFAULT 0,
        lapses INTEGER NOT NULL DEFAULT 0,
        due TEXT NOT NULL DEFAULT '',
        last_review TEXT,
        introduced_at TEXT,
        known INTEGER NOT NULL DEFAULT 0
      );
    `);
    // Migration: add random_topics column (DBs created before the random-topic toggle).
    try {
      await this.db.execAsync('ALTER TABLE learn_settings ADD COLUMN random_topics INTEGER');
    } catch {}
    // Migration: add strict_accents column (DBs created before the difficulty switches, FB132).
    try {
      await this.db.execAsync('ALTER TABLE learn_settings ADD COLUMN strict_accents INTEGER');
    } catch {}
    // Migration: add requeue_level column (DBs created before the difficulty dial, FB198).
    try {
      await this.db.execAsync('ALTER TABLE learn_settings ADD COLUMN requeue_level TEXT');
    } catch {}
    // Migration: add article_picker column (DBs created before the article chips, FB188).
    try {
      await this.db.execAsync('ALTER TABLE learn_settings ADD COLUMN article_picker INTEGER');
    } catch {}
    // Migration: add feedback_btn_side column (DBs created before the draggable feedback button, FB41).
    try {
      await this.db.execAsync('ALTER TABLE learn_settings ADD COLUMN feedback_btn_side TEXT');
    } catch {}
    // Migration: add weekly_goal_minutes column (DBs created before the weekly study goal, FB65).
    try {
      await this.db.execAsync('ALTER TABLE learn_settings ADD COLUMN weekly_goal_minutes INTEGER');
    } catch {}
    // Migration: last_open_date column (DBs created before the daily greeting, FB76).
    try {
      await this.db.execAsync('ALTER TABLE user_meta ADD COLUMN last_open_date TEXT');
    } catch {}
    // Migration: status-bar tint index (DBs created before the blue strip, FB83).
    try {
      await this.db.execAsync('ALTER TABLE user_meta ADD COLUMN status_bar_tint INTEGER');
    } catch {}
    // Migration: daily new-word budget columns (FB77). daily_new_limit is the
    // standing setting; new_bonus/new_bonus_date carry the "+5 new words" taps,
    // which only count while new_bonus_date is still today.
    try {
      await this.db.execAsync('ALTER TABLE learn_settings ADD COLUMN daily_new_limit INTEGER');
    } catch {}
    try {
      await this.db.execAsync('ALTER TABLE learn_settings ADD COLUMN new_bonus INTEGER');
    } catch {}
    try {
      await this.db.execAsync('ALTER TABLE learn_settings ADD COLUMN new_bonus_date TEXT');
    } catch {}
    // UTEMEZO 8: hand_cap (P) and gap_laps (R) columns (DBs created before the
    // difficulty window, which replaces the FB198 requeue_level dial).
    try {
      await this.db.execAsync('ALTER TABLE learn_settings ADD COLUMN hand_cap INTEGER');
    } catch {}
    try {
      await this.db.execAsync('ALTER TABLE learn_settings ADD COLUMN gap_laps INTEGER');
    } catch {}
    // UTEMEZO 4.7: repair_gap (R_javítás), a rontott lap külön, rövid rése.
    try {
      await this.db.execAsync('ALTER TABLE learn_settings ADD COLUMN repair_gap INTEGER');
    } catch {}
    // Migration: pcic_cards.known column (DBs created before "Ezt nem tanulom", SZ3).
    try {
      await this.db.execAsync('ALTER TABLE pcic_cards ADD COLUMN known INTEGER');
    } catch {}
    const meta = await this.db.getFirstAsync<any>('SELECT id FROM user_meta WHERE id = 1');
    if (!meta) {
      const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
      await this.db.runAsync('INSERT INTO user_meta (id, user_id, first_use_date) VALUES (1, ?, ?)', [uuid, new Date().toISOString()]);
    }

    // Resolve the active pair from onboarding before running migrations.
    const ob = await this.db.getFirstAsync<any>('SELECT source, target FROM onboarding WHERE id = 1');
    if (ob) this.activePair = `${ob.source}-${ob.target}`;

    // Migration: add buried column (DBs created before the bury feature).
    const buriedCol = await this.db.getFirstAsync<any>("SELECT * FROM pragma_table_info('cards') WHERE name = 'buried'");
    if (!buriedCol) {
      await this.db.execAsync('ALTER TABLE cards ADD COLUMN buried INTEGER NOT NULL DEFAULT 0');
    }
    // Migration: add learned_at (FB210, the daily new-word budget counts learned
    // words). Cards that already finished the ladder are stamped with a date in
    // the PAST, not today: they were learned on some earlier day, and dating them
    // today would eat a whole day's budget at once on the first launch.
    const learnedAtCol = await this.db.getFirstAsync<any>("SELECT * FROM pragma_table_info('cards') WHERE name = 'learned_at'");
    if (!learnedAtCol) {
      await this.db.execAsync('ALTER TABLE cards ADD COLUMN learned_at TEXT');
      await this.db.runAsync(
        // FB226, Kálmán 2026-09-10: a COALESCE a MAI ismétlés dátumát írta be, így a
        // frissítés utáni első indításkor a mai keret azonnal elfogyott ("azt írja hogy 0").
        // A régi lapok MINDIG a múltba kerülnek, ahogy a fenti komment ígéri.
        // A 3 itt szám szerint történelmi migráció (UTEMEZO 11. szakasz): a
        // LEARNED_PASSES konstans megszűnt, ez a hely az utolsó, ahol a régi
        // reps−lapses származtatás előfordul.
        `UPDATE cards SET learned_at = ?
           WHERE type = 'word' AND reps - lapses >= 3 AND learned_at IS NULL`,
        [new Date(0).toISOString()]
      );
    }
    // Migration: per-pair cards. Rebuild with UNIQUE(word_id,type,pair); existing
    // rows are tagged with the pair that was active when they were created.
    const cardsPairCol = await this.db.getFirstAsync<any>("SELECT * FROM pragma_table_info('cards') WHERE name = 'pair'");
    if (!cardsPairCol) {
      await this.db.execAsync(`
        CREATE TABLE cards_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          word_id INTEGER NOT NULL,
          type TEXT NOT NULL DEFAULT 'word',
          pair TEXT NOT NULL DEFAULT 'es-hu',
          due TEXT NOT NULL,
          stability REAL NOT NULL DEFAULT 0,
          difficulty REAL NOT NULL DEFAULT 0,
          elapsed_days INTEGER NOT NULL DEFAULT 0,
          scheduled_days INTEGER NOT NULL DEFAULT 0,
          learning_steps INTEGER NOT NULL DEFAULT 0,
          reps INTEGER NOT NULL DEFAULT 0,
          lapses INTEGER NOT NULL DEFAULT 0,
          state INTEGER NOT NULL DEFAULT 0,
          last_review TEXT,
          buried INTEGER NOT NULL DEFAULT 0,
          UNIQUE(word_id, type, pair)
        );
        INSERT INTO cards_new (word_id, type, pair, due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state, last_review, buried)
          SELECT word_id, type, '${this.activePair}', due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state, last_review, buried FROM cards;
        DROP TABLE cards;
        ALTER TABLE cards_new RENAME TO cards;
      `);
    }
    // Migration: UTEMEZO 11. szakasz. Szándékosan a pair-rebuild UTÁN áll: a
    // rebuild a régi (lap nélküli) táblát másolja, ez a blokk adja hozzá az
    // oszlopokat és tölti vissza őket. A lap-állás eddig a reps−lapses
    // különbségből volt származtatva (lib/wordPhase.ts), ez itt az utolsó hely,
    // ahol ez a származtatás előfordul: egyszeri visszatöltés a spec előtt
    // létrejött sorokhoz, utána a `lap`/`in_hand` mező a forrás igazság.
    const lapCol = await this.db.getFirstAsync<any>("SELECT * FROM pragma_table_info('cards') WHERE name = 'lap'");
    if (!lapCol) {
      await this.db.execAsync(`
        ALTER TABLE cards ADD COLUMN lap INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE cards ADD COLUMN in_hand INTEGER NOT NULL DEFAULT 0;
        UPDATE cards SET lap = MIN(3, MAX(0, reps - lapses)) WHERE type = 'word';
        UPDATE cards SET in_hand = 1 WHERE type = 'word' AND buried = 0 AND reps > 0 AND lap < 3;
      `);
    }
    // Migration: UTEMEZO 12/4 (Kálmán, 2026-09-17), egy "ismert"-definíció. A fa
    // csempéje és a téma-lezárás eddig FSRS Review-t (state >= 2) nézte, a
    // Stats-kártya a fenti lap-oszlopot (lap >= 3 OR buried); ezért lehetett a
    // szint 928/931, miközben egy téma 0/10. Innentől mindkettő a lap-oszlopot
    // nézi (lib/topicMastery.ts), de a fenti reps-lapses visszatöltés nem
    // találja meg azt a szót, ami az FSRS szerint már Review, mert a gépelős (3.)
    // lap előtt is Review-ba léphetett (FB111). Idempotens (a WHERE a második
    // futástól üres), a `applyWordMerges` mintája szerint minden induláskor fut.
    // A feltétel tiszta JS tükre + tesztje: lib/lap.ts needsReviewLapBackfill.
    await this.db.runAsync(
      "UPDATE cards SET lap = 3 WHERE type = 'word' AND state >= 2 AND lap < 3"
    );
    // Migration: UTEMEZO 2.2, started_at oszlop (DBs created before the daily
    // keret az 1. lap feljovetelekor fogy, nem a megtanuláskor).
    const startedAtCol = await this.db.getFirstAsync<any>("SELECT * FROM pragma_table_info('cards') WHERE name = 'started_at'");
    if (!startedAtCol) {
      await this.db.execAsync('ALTER TABLE cards ADD COLUMN started_at TEXT');
    }
    // Migration: per-pair user_level (old singleton id=1 → keyed by pair).
    const levelPairCol = await this.db.getFirstAsync<any>("SELECT * FROM pragma_table_info('user_level') WHERE name = 'pair'");
    if (!levelPairCol) {
      await this.db.execAsync(`
        CREATE TABLE user_level_new (
          pair TEXT PRIMARY KEY,
          level TEXT NOT NULL DEFAULT 'A0',
          correct_streak INTEGER NOT NULL DEFAULT 0,
          mistakes_in_window INTEGER NOT NULL DEFAULT 0,
          fail_streak INTEGER NOT NULL DEFAULT 0
        );
        INSERT INTO user_level_new (pair, level, correct_streak, mistakes_in_window, fail_streak)
          SELECT '${this.activePair}', level, correct_streak, mistakes_in_window, fail_streak FROM user_level WHERE id = 1;
        DROP TABLE user_level;
        ALTER TABLE user_level_new RENAME TO user_level;
      `);
    }
    // Migration: per-pair attempt history (FB129). Without it the daily new-word
    // counter was shared by every language pair, so a day spent on one course
    // left the other with a zero budget and an empty queue.
    const attemptsPairCol = await this.db.getFirstAsync<any>("SELECT * FROM pragma_table_info('card_attempts') WHERE name = 'pair'");
    if (!attemptsPairCol) {
      await this.db.execAsync('ALTER TABLE card_attempts ADD COLUMN pair TEXT');
      // Existing rows predate the column: a word that only ever had a card in one
      // pair is tagged with it, anything ambiguous falls back to the active pair.
      await this.db.runAsync(
        `UPDATE card_attempts SET pair = COALESCE(
           (SELECT MIN(c.pair) FROM cards c WHERE c.word_id = card_attempts.word_id AND c.type = card_attempts.type),
           ?
         ) WHERE pair IS NULL`,
        [this.activePair]
      );
    }
    await this.applyWordMerges(this.db);
    return this.db;
  }

  // Migration: the duplicate cleanup (2026-08-07) removed the higher-level twin
  // of words that were authored twice, so the progress on a deleted id moves to
  // the surviving one. Idempotent: after the first run no merged id is left, and
  // the probe below costs one indexed SELECT per app start. Spanish-target pairs
  // only, the en/hu word tracks number their words on their own.
  private async applyWordMerges(db: SQLite.SQLiteDatabase) {
    const oldIds = Object.keys(WORD_MERGES).map(Number);
    if (oldIds.length === 0) return;
    const placeholders = oldIds.map(() => '?').join(',');
    const stale = await db.getAllAsync<any>(
      `SELECT * FROM cards WHERE word_id IN (${placeholders}) AND pair LIKE '%-es'`,
      oldIds
    );
    if (stale.length === 0) return;

    for (const row of stale) {
      const newId = WORD_MERGES[row.word_id];
      const twin = await db.getFirstAsync<any>(
        'SELECT * FROM cards WHERE word_id = ? AND type = ? AND pair = ?',
        [newId, row.type, row.pair]
      );
      if (!twin) {
        await db.runAsync('UPDATE cards SET word_id = ? WHERE id = ?', [newId, row.id]);
        continue;
      }
      // Both sides have history: the stronger one survives, the other is dropped.
      const survivor = pickSurvivor(row, twin);
      if (survivor === row) {
        await db.runAsync('DELETE FROM cards WHERE id = ?', [twin.id]);
        await db.runAsync('UPDATE cards SET word_id = ? WHERE id = ?', [newId, row.id]);
      } else {
        await db.runAsync('DELETE FROM cards WHERE id = ?', [row.id]);
      }
    }

    // The spelling list is keyed by (pair, word_id), so a collision there means
    // the word is already queued under its surviving id, drop the stale row.
    for (const oldId of oldIds) {
      const newId = WORD_MERGES[oldId];
      await db.runAsync(
        `UPDATE OR REPLACE spelling_list SET word_id = ? WHERE word_id = ? AND pair LIKE '%-es'`,
        [newId, oldId]
      );
    }
    // Attempt history has no uniqueness constraint, it can just follow the word.
    await db.runAsync(
      `UPDATE card_attempts SET word_id = CASE word_id ${oldIds
        .map((id) => `WHEN ${id} THEN ${WORD_MERGES[id]}`)
        .join(' ')} ELSE word_id END WHERE word_id IN (${placeholders})`,
      oldIds
    );
  }

  async getStreak() {
    const db = await this.open();
    return await db.getFirstAsync<any>('SELECT * FROM streak WHERE id = 1');
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

  async getTodayStats() {
    const db = await this.open();
    const today = new Date().toISOString().split('T')[0];
    const rows = await db.getAllAsync<any>(
      "SELECT * FROM card_attempts WHERE timestamp >= ?", [`${today}T00:00:00`]
    );
    const total = rows.length;
    const correct = rows.filter((r: any) => r.correct === 1).length;
    const avgMs = total > 0 ? Math.round(rows.reduce((s: number, r: any) => s + r.response_time_ms, 0) / total) : 0;
    return {
      totalReviews: total,
      correctCount: correct,
      avgResponseMs: avgMs,
      flashcardCount: 0,
      typingCount: 0,
      wordCount: rows.filter((r: any) => r.type === 'word').length,
      sentenceCount: rows.filter((r: any) => r.type === 'sentence').length,
    };
  }

  async getMasteredCount() {
    const db = await this.open();
    const row = await db.getFirstAsync<any>(
      "SELECT COUNT(*) as cnt FROM cards WHERE state >= 2 AND stability > 10 AND pair = ?",
      [this.activePair]
    );
    return row?.cnt ?? 0;
  }

  async getReviewedWordCount(level: string) {
    const db = await this.open();
    const { getWordsForLevel } = require('@/data/words');
    const levelWords = getWordsForLevel(level, this.activePair.split('-')[1]);
    const wordIds = levelWords.map((w: any) => w.id);
    if (wordIds.length === 0) return 0;
    const placeholders = wordIds.map(() => '?').join(',');
    const row = await db.getFirstAsync<any>(
      // UTEMEZO 1. szakasz: megtanult = a 3. lap egyszer helyes volt, nem pedig
      // „egyszer már láttam" (reps > 0).
      `SELECT COUNT(*) as cnt FROM cards WHERE word_id IN (${placeholders}) AND type = 'word' AND pair = ?
         AND (lap >= 3 OR buried = 1)`,
      [...wordIds, this.activePair]
    );
    return row?.cnt ?? 0;
  }

  // FB100: due dates of the word cards already in rotation (a never-studied card
  // has no schedule yet, and a buried one never comes back), for the Stats tab's
  // "how many words are put away for how long" report.
  async getScheduledWordDueDates() {
    const db = await this.open();
    const rows = await db.getAllAsync<any>(
      "SELECT due FROM cards WHERE type = 'word' AND reps > 0 AND buried = 0 AND pair = ?",
      [this.activePair]
    );
    return rows.map((r: any) => String(r.due));
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

  async resetPcicCards(): Promise<void> {
    const db = await this.open();
    await db.runAsync('DELETE FROM pcic_cards');
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
        for (const row of payload.tables[table]) {
          const cols = Object.keys(row);
          await db.runAsync(
            `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
            cols.map(c => row[c])
          );
        }
      }
    });
    // The imported onboarding decides the active pair from here on.
    const ob = await db.getFirstAsync<any>('SELECT source, target FROM onboarding WHERE id = 1');
    if (ob) this.activePair = `${ob.source}-${ob.target}`;
    // A backup taken before the duplicate cleanup still carries the deleted ids.
    await this.applyWordMerges(db);
  }
}

let instance: DB;
export function getDb(): DB {
  if (!instance) instance = new SQLiteDB();
  return instance;
}
