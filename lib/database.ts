import * as SQLite from 'expo-sqlite';
import { createEmptyCard, type Card } from 'ts-fsrs';
import { BACKUP_SCHEMA_VERSION, BACKUP_TABLES, getAppVersion, type BackupPayload } from './backup';
import { pickSurvivor } from './cardMerge';
import { rankSentencesByWordWeakness, sentenceSlotCount, type WordWeakness } from './sentenceMix';
import { WORD_MERGES } from './wordMerges';
import { localDateString, summarizeUsage, DEFAULT_WEEKLY_GOAL_MINUTES, DEFAULT_DAILY_NEW_LIMIT, type UsageStats } from './usageStats';

export interface DB {
  ensureCard(wordId: number, type: string): Promise<void>;
  updateCard(wordId: number, type: string, card: Card): Promise<void>;
  getDueCards(limit: number): Promise<any[]>;
  getStreak(): Promise<{ current_count: number; last_date: string | null; longest_count: number }>;
  updateStreak(): Promise<void>;
  getOnboarding(): Promise<{ source: string; target: string } | null>;
  setOnboarding(source: string, target: string): Promise<void>;
  getLevel(): Promise<{ level: string; correct_streak: number; mistakes_in_window: number; fail_streak: number }>;
  updateLevel(level: string, correctStreak: number, mistakesInWindow: number, failStreak: number): Promise<void>;
  getDueCardsForLevel(level: string, limit: number): Promise<any[]>;
  getDueCardsForWordIds(wordIds: number[], limit: number): Promise<any[]>;
  getWordReps(wordIds: number[]): Promise<Map<number, number>>;
  recordAttempt(wordId: number, type: string, correct: boolean, responseTimeMs: number): Promise<void>;
  getUserMeta(): Promise<{ userId: string; firstUseDate: string; lastSyncDate: string | null }>;
  updateLastSync(date: string): Promise<void>;
  claimDailyGreeting(): Promise<boolean>;
  getStatusBarTint(): Promise<number>;
  setStatusBarTint(index: number): Promise<void>;
  getTodayStats(): Promise<{ totalReviews: number; correctCount: number; avgResponseMs: number; flashcardCount: number; typingCount: number; wordCount: number; sentenceCount: number }>;
  getTop5Failed(): Promise<string[]>;
  getMasteredCount(): Promise<number>;
  getMasteredWordCount(level: string): Promise<number>;
  getReviewedWordCount(level: string): Promise<number>;
  buryCard(wordId: number, type: string): Promise<void>;
  snoozeCard(wordId: number, type: string, days: number): Promise<void>;
  addToSpellingList(wordId: number): Promise<void>;
  removeFromSpellingList(wordId: number): Promise<void>;
  getSpellingList(): Promise<{ wordId: number; step: number; due: string }[]>;
  getSpellingDueCount(): Promise<number>;
  updateSpellingStep(wordId: number, step: number, due: string): Promise<void>;
  isInSpellingList(wordId: number): Promise<boolean>;
  resetAllProgress(): Promise<void>;
  getSelectedTopic(): Promise<string | null>;
  setSelectedTopic(topicId: string | null): Promise<void>;
  getWordsOnly(): Promise<boolean>;
  setWordsOnly(v: boolean): Promise<void>;
  getRandomTopics(): Promise<boolean>;
  setRandomTopics(v: boolean): Promise<void>;
  getWeeklyGoalMinutes(): Promise<number>;
  setWeeklyGoalMinutes(minutes: number): Promise<void>;
  getFeedbackBtnSide(): Promise<'left' | 'right'>;
  setFeedbackBtnSide(side: 'left' | 'right'): Promise<void>;
  getDailyNewLimit(): Promise<number>;
  setDailyNewLimit(limit: number): Promise<void>;
  getNewLimitBonus(): Promise<number>;
  addNewLimitBonus(extra: number): Promise<void>;
  getNewWordsToday(): Promise<number>;
  addUsageMinute(): Promise<number>;
  getUsageStats(): Promise<UsageStats>;
  exportAll(): Promise<BackupPayload>;
  importAll(payload: BackupPayload): Promise<void>;
}

export function cardFromRow(row: any): Card {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps ?? 0,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  };
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
      CREATE TABLE IF NOT EXISTS selected_topic (
        pair TEXT PRIMARY KEY,
        topic_id TEXT
      );
      CREATE TABLE IF NOT EXISTS learn_settings (
        pair TEXT PRIMARY KEY,
        words_only INTEGER,
        random_topics INTEGER,
        feedback_btn_side TEXT,
        weekly_goal_minutes INTEGER,
        daily_new_limit INTEGER,
        new_bonus INTEGER,
        new_bonus_date TEXT
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
    `);
    // Migration: add random_topics column (DBs created before the random-topic toggle).
    try {
      await this.db.execAsync('ALTER TABLE learn_settings ADD COLUMN random_topics INTEGER');
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

  async ensureCard(wordId: number, type: string) {
    const db = await this.open();
    const existing = await db.getFirstAsync('SELECT id FROM cards WHERE word_id = ? AND type = ? AND pair = ?', [wordId, type, this.activePair]);
    if (existing) return;
    const empty = createEmptyCard();
    await db.runAsync(
      `INSERT INTO cards (word_id, type, pair, due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [wordId, type, this.activePair, empty.due.toISOString(), empty.stability, empty.difficulty, empty.elapsed_days, empty.scheduled_days, empty.learning_steps, empty.reps, empty.lapses, empty.state]
    );
  }

  async updateCard(wordId: number, type: string, card: Card) {
    const db = await this.open();
    await db.runAsync(
      `UPDATE cards SET due = ?, stability = ?, difficulty = ?, elapsed_days = ?, scheduled_days = ?,
       learning_steps = ?, reps = ?, lapses = ?, state = ?, last_review = ? WHERE word_id = ? AND type = ? AND pair = ?`,
      [card.due.toISOString(), card.stability, card.difficulty, card.elapsed_days, card.scheduled_days,
       card.learning_steps, card.reps, card.lapses, card.state, card.last_review ? card.last_review.toISOString() : null, wordId, type, this.activePair]
    );
  }

  async getDueCards(limit: number) {
    const db = await this.open();
    return await db.getAllAsync('SELECT * FROM cards WHERE due <= ? AND buried = 0 AND pair = ? ORDER BY due ASC LIMIT ?', [new Date().toISOString(), this.activePair, limit]);
  }

  async getStreak() {
    const db = await this.open();
    return await db.getFirstAsync<any>('SELECT * FROM streak WHERE id = 1');
  }

  async updateStreak() {
    const db = await this.open();
    const today = new Date().toISOString().split('T')[0];
    const streak = await this.getStreak();
    if (streak.last_date === today) return;
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
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

  async updateLevel(level: string, correctStreak: number, mistakesInWindow: number, failStreak: number) {
    const db = await this.open();
    await db.runAsync("INSERT OR IGNORE INTO user_level (pair, level) VALUES (?, 'A0')", [this.activePair]);
    await db.runAsync('UPDATE user_level SET level = ?, correct_streak = ?, mistakes_in_window = ?, fail_streak = ? WHERE pair = ?',
      [level, correctStreak, mistakesInWindow, failStreak, this.activePair]);
  }

  async getDueCardsForLevel(level: string, limit: number) {
    const { getWordsForLevel } = require('@/data/words');
    const levelWords = getWordsForLevel(level, this.activePair.split('-')[1]);
    const wordIds = levelWords.map((w: any) => w.id);
    return this.getDueCardsForWordIds(wordIds, limit);
  }

  async getDueCardsForWordIds(wordIds: number[], limit: number) {
    const db = await this.open();
    if (wordIds.length === 0) return [];
    const placeholders = wordIds.map(() => '?').join(',');
    const now = new Date().toISOString();
    const lookahead = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const newLimit = Math.max(1, Math.round(limit * 0.3));
    const reviewLimit = limit - newLimit;

    const newCards = await db.getAllAsync(
      `SELECT * FROM cards WHERE word_id IN (${placeholders}) AND type = 'word' AND reps = 0 AND buried = 0 AND pair = ? AND due <= ? ORDER BY due ASC LIMIT ?`,
      [...wordIds, this.activePair, now, newLimit]
    );

    const reviewWords = await db.getAllAsync(
      `SELECT * FROM cards WHERE word_id IN (${placeholders}) AND type = 'word' AND reps > 0 AND buried = 0 AND pair = ? AND due <= ? ORDER BY due ASC LIMIT ?`,
      [...wordIds, this.activePair, lookahead, reviewLimit]
    );

    const reviewedWordIds = await db.getAllAsync<any>(
      `SELECT DISTINCT word_id FROM cards WHERE word_id IN (${placeholders}) AND type = 'word' AND pair = ? AND (reps >= 2 OR buried = 1)`,
      [...wordIds, this.activePair]
    );
    const reviewedSet = new Set(reviewedWordIds.map((r: any) => r.word_id));

    // FB89: sentences only ever support the words in this session, so their count
    // follows the 4:1 cadence, and the slots go to the words with the most lapses.
    const sentenceSlots = sentenceSlotCount((newCards as any[]).length + (reviewWords as any[]).length);
    let sentenceCards: any[] = [];
    if (reviewedSet.size > 0 && sentenceSlots > 0) {
      const reviewedIds = [...reviewedSet];
      const sentencePlaceholders = reviewedIds.map(() => '?').join(',');
      const dueSentences = await db.getAllAsync<any>(
        `SELECT * FROM cards WHERE word_id IN (${sentencePlaceholders}) AND type = 'sentence' AND buried = 0 AND pair = ? AND due <= ? ORDER BY due ASC`,
        [...reviewedIds, this.activePair, lookahead]
      );
      const weaknessRows = await db.getAllAsync<any>(
        `SELECT word_id, lapses, difficulty FROM cards WHERE word_id IN (${sentencePlaceholders}) AND type = 'word' AND pair = ?`,
        [...reviewedIds, this.activePair]
      );
      const weakness = new Map<number, WordWeakness>(
        weaknessRows.map((r: any) => [r.word_id, { lapses: r.lapses, difficulty: r.difficulty }])
      );
      sentenceCards = rankSentencesByWordWeakness(dueSentences, weakness).slice(0, sentenceSlots);
    }

    return [...reviewWords, ...sentenceCards, ...newCards];
  }

  async getWordReps(wordIds: number[]): Promise<Map<number, number>> {
    const db = await this.open();
    if (wordIds.length === 0) return new Map();
    const placeholders = wordIds.map(() => '?').join(',');
    const rows = await db.getAllAsync<any>(
      `SELECT word_id, reps FROM cards WHERE word_id IN (${placeholders}) AND type = 'word' AND pair = ?`,
      [...wordIds, this.activePair]
    );
    const map = new Map<number, number>();
    for (const r of rows) map.set(r.word_id, r.reps);
    return map;
  }

  async recordAttempt(wordId: number, type: string, correct: boolean, responseTimeMs: number) {
    const db = await this.open();
    await db.runAsync(
      'INSERT INTO card_attempts (word_id, type, correct, response_time_ms, timestamp) VALUES (?, ?, ?, ?, ?)',
      [wordId, type, correct ? 1 : 0, responseTimeMs, new Date().toISOString()]
    );
  }

  async getUserMeta() {
    const db = await this.open();
    const row = await db.getFirstAsync<any>('SELECT * FROM user_meta WHERE id = 1');
    return { userId: row.user_id, firstUseDate: row.first_use_date, lastSyncDate: row.last_sync_date };
  }

  async updateLastSync(date: string) {
    const db = await this.open();
    await db.runAsync('UPDATE user_meta SET last_sync_date = ? WHERE id = 1', [date]);
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

  async getTop5Failed() {
    const db = await this.open();
    const rows = await db.getAllAsync<any>(
      "SELECT word_id, COUNT(*) as cnt FROM card_attempts WHERE correct = 0 GROUP BY word_id ORDER BY cnt DESC LIMIT 5"
    );
    const { words } = require('@/data/words');
    const onboarding = await this.getOnboarding();
    const lang = onboarding?.target ?? 'es';
    return rows.map((r: any) => {
      const w = words.find((w: any) => w.id === r.word_id);
      return w ? String(w[lang] ?? w.es) : String(r.word_id);
    });
  }

  async getMasteredCount() {
    const db = await this.open();
    const row = await db.getFirstAsync<any>(
      "SELECT COUNT(*) as cnt FROM cards WHERE state >= 2 AND stability > 10 AND pair = ?",
      [this.activePair]
    );
    return row?.cnt ?? 0;
  }

  async getMasteredWordCount(level: string) {
    const db = await this.open();
    const { getWordsForLevel } = require('@/data/words');
    const levelWords = getWordsForLevel(level, this.activePair.split('-')[1]);
    const wordIds = levelWords.map((w: any) => w.id);
    if (wordIds.length === 0) return 0;
    const placeholders = wordIds.map(() => '?').join(',');
    const row = await db.getFirstAsync<any>(
      `SELECT COUNT(*) as cnt FROM cards
         WHERE word_id IN (${placeholders}) AND type = 'word' AND pair = ?
           AND (state >= 2 OR buried = 1)`,
      [...wordIds, this.activePair]
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
      `SELECT COUNT(*) as cnt FROM cards WHERE word_id IN (${placeholders}) AND type = 'word' AND pair = ? AND (reps > 0 OR buried = 1)`,
      [...wordIds, this.activePair]
    );
    return row?.cnt ?? 0;
  }

  async buryCard(wordId: number, type: string) {
    const db = await this.open();
    await db.runAsync('UPDATE cards SET buried = 1 WHERE word_id = ? AND type = ? AND pair = ?', [wordId, type, this.activePair]);
  }

  // FB38: push the card's due date out by `days`, leaving reps/stability untouched
  // (unlike buryCard, this isn't final, the card resurfaces after the snooze).
  async snoozeCard(wordId: number, type: string, days: number) {
    const db = await this.open();
    const newDue = new Date(Date.now() + days * 86400000).toISOString();
    await db.runAsync('UPDATE cards SET due = ? WHERE word_id = ? AND type = ? AND pair = ?', [newDue, wordId, type, this.activePair]);
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

  async removeFromSpellingList(wordId: number) {
    const db = await this.open();
    await db.runAsync('DELETE FROM spelling_list WHERE pair = ? AND word_id = ?', [this.activePair, wordId]);
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

  async updateSpellingStep(wordId: number, step: number, due: string) {
    const db = await this.open();
    await db.runAsync(
      'UPDATE spelling_list SET step = ?, due = ? WHERE pair = ? AND word_id = ?',
      [step, due, this.activePair, wordId]
    );
  }

  async isInSpellingList(wordId: number) {
    const db = await this.open();
    const row = await db.getFirstAsync<any>('SELECT 1 FROM spelling_list WHERE pair = ? AND word_id = ?', [this.activePair, wordId]);
    return !!row;
  }

  async resetAllProgress() {
    // Reset only the active language pair, other languages keep their progress.
    const db = await this.open();
    await db.runAsync('DELETE FROM cards WHERE pair = ?', [this.activePair]);
    await db.runAsync("UPDATE user_level SET level = 'A0', correct_streak = 0, mistakes_in_window = 0, fail_streak = 0 WHERE pair = ?", [this.activePair]);
  }

  async getSelectedTopic(): Promise<string | null> {
    const db = await this.open();
    const row = await db.getFirstAsync<any>('SELECT topic_id FROM selected_topic WHERE pair = ?', [this.activePair]);
    return row?.topic_id ?? null;
  }

  async setSelectedTopic(topicId: string | null): Promise<void> {
    const db = await this.open();
    await db.runAsync('INSERT OR REPLACE INTO selected_topic (pair, topic_id) VALUES (?, ?)', [this.activePair, topicId]);
  }

  async getWordsOnly(): Promise<boolean> {
    const db = await this.open();
    const row = await db.getFirstAsync<any>('SELECT words_only FROM learn_settings WHERE pair = ?', [this.activePair]);
    return row?.words_only === 1;
  }

  async setWordsOnly(v: boolean): Promise<void> {
    const db = await this.open();
    await db.runAsync(
      'INSERT INTO learn_settings (pair, words_only) VALUES (?, ?) ON CONFLICT(pair) DO UPDATE SET words_only = excluded.words_only',
      [this.activePair, v ? 1 : 0]
    );
  }

  async getRandomTopics(): Promise<boolean> {
    const db = await this.open();
    const row = await db.getFirstAsync<any>('SELECT random_topics FROM learn_settings WHERE pair = ?', [this.activePair]);
    return row?.random_topics === 1;
  }

  async setRandomTopics(v: boolean): Promise<void> {
    const db = await this.open();
    await db.runAsync(
      'INSERT INTO learn_settings (pair, random_topics) VALUES (?, ?) ON CONFLICT(pair) DO UPDATE SET random_topics = excluded.random_topics',
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

  async getNewLimitBonus(): Promise<number> {
    const db = await this.open();
    const row = await db.getFirstAsync<any>('SELECT new_bonus, new_bonus_date FROM learn_settings WHERE pair = ?', [this.activePair]);
    if (row?.new_bonus_date !== localDateString()) return 0;
    return typeof row?.new_bonus === 'number' ? row.new_bonus : 0;
  }

  async addNewLimitBonus(extra: number): Promise<void> {
    const db = await this.open();
    const current = await this.getNewLimitBonus();
    await db.runAsync(
      'INSERT INTO learn_settings (pair, new_bonus, new_bonus_date) VALUES (?, ?, ?) ON CONFLICT(pair) DO UPDATE SET new_bonus = excluded.new_bonus, new_bonus_date = excluded.new_bonus_date',
      [this.activePair, current + extra, localDateString()]
    );
  }

  // A word counts as "started today" when its FIRST ever attempt happened today.
  // card_attempts has no pair column, so this is counted across language pairs,
  // which matches how the budget is meant to work (per day of study, not per pair).
  async getNewWordsToday(): Promise<number> {
    const db = await this.open();
    const rows = await db.getAllAsync<any>(
      "SELECT word_id, MIN(timestamp) AS first_ts FROM card_attempts WHERE type = 'word' GROUP BY word_id"
    );
    const today = localDateString();
    return rows.filter(r => localDateString(new Date(r.first_ts)) === today).length;
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
