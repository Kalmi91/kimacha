import * as SQLite from 'expo-sqlite';
import { createEmptyCard, type Card } from 'ts-fsrs';

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
  getTodayStats(): Promise<{ totalReviews: number; correctCount: number; avgResponseMs: number; flashcardCount: number; typingCount: number; wordCount: number; sentenceCount: number }>;
  getTop5Failed(): Promise<string[]>;
  getMasteredCount(): Promise<number>;
  getMasteredWordCount(): Promise<number>;
  getReviewedWordCount(level: string): Promise<number>;
  buryCard(wordId: number, type: string): Promise<void>;
  resetAllProgress(): Promise<void>;
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

  private async open() {
    if (this.db) return this.db;
    this.db = await SQLite.openDatabaseAsync('kimacha.db');
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word_id INTEGER NOT NULL,
        type TEXT NOT NULL DEFAULT 'word',
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
        UNIQUE(word_id, type)
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
        id INTEGER PRIMARY KEY CHECK (id = 1),
        level TEXT NOT NULL DEFAULT 'A0',
        correct_streak INTEGER NOT NULL DEFAULT 0,
        mistakes_in_window INTEGER NOT NULL DEFAULT 0,
        fail_streak INTEGER NOT NULL DEFAULT 0
      );
      INSERT OR IGNORE INTO user_level (id, level, correct_streak, mistakes_in_window, fail_streak) VALUES (1, 'A0', 0, 0, 0);
      CREATE TABLE IF NOT EXISTS user_meta (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        user_id TEXT NOT NULL,
        first_use_date TEXT NOT NULL,
        last_sync_date TEXT
      );
    `);
    const meta = await this.db.getFirstAsync<any>('SELECT id FROM user_meta WHERE id = 1');
    if (!meta) {
      const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
      await this.db.runAsync('INSERT INTO user_meta (id, user_id, first_use_date) VALUES (1, ?, ?)', [uuid, new Date().toISOString()]);
    }
    // Migration: add buried column
    const colCheck = await this.db.getFirstAsync<any>("SELECT * FROM pragma_table_info('cards') WHERE name = 'buried'");
    if (!colCheck) {
      await this.db.execAsync('ALTER TABLE cards ADD COLUMN buried INTEGER NOT NULL DEFAULT 0');
    }
    return this.db;
  }

  async ensureCard(wordId: number, type: string) {
    const db = await this.open();
    const existing = await db.getFirstAsync('SELECT id FROM cards WHERE word_id = ? AND type = ?', [wordId, type]);
    if (existing) return;
    const empty = createEmptyCard();
    await db.runAsync(
      `INSERT INTO cards (word_id, type, due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [wordId, type, empty.due.toISOString(), empty.stability, empty.difficulty, empty.elapsed_days, empty.scheduled_days, empty.learning_steps, empty.reps, empty.lapses, empty.state]
    );
  }

  async updateCard(wordId: number, type: string, card: Card) {
    const db = await this.open();
    await db.runAsync(
      `UPDATE cards SET due = ?, stability = ?, difficulty = ?, elapsed_days = ?, scheduled_days = ?,
       learning_steps = ?, reps = ?, lapses = ?, state = ?, last_review = ? WHERE word_id = ? AND type = ?`,
      [card.due.toISOString(), card.stability, card.difficulty, card.elapsed_days, card.scheduled_days,
       card.learning_steps, card.reps, card.lapses, card.state, card.last_review ? card.last_review.toISOString() : null, wordId, type]
    );
  }

  async getDueCards(limit: number) {
    const db = await this.open();
    return await db.getAllAsync('SELECT * FROM cards WHERE due <= ? AND buried = 0 ORDER BY due ASC LIMIT ?', [new Date().toISOString(), limit]);
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
  }

  async getLevel() {
    const db = await this.open();
    return await db.getFirstAsync<any>('SELECT * FROM user_level WHERE id = 1');
  }

  async updateLevel(level: string, correctStreak: number, mistakesInWindow: number, failStreak: number) {
    const db = await this.open();
    await db.runAsync('UPDATE user_level SET level = ?, correct_streak = ?, mistakes_in_window = ?, fail_streak = ? WHERE id = 1',
      [level, correctStreak, mistakesInWindow, failStreak]);
  }

  async getDueCardsForLevel(level: string, limit: number) {
    const { getWordsForLevel } = require('@/data/words');
    const levelWords = getWordsForLevel(level);
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
      `SELECT * FROM cards WHERE word_id IN (${placeholders}) AND type = 'word' AND reps = 0 AND buried = 0 AND due <= ? ORDER BY due ASC LIMIT ?`,
      [...wordIds, now, newLimit]
    );

    const reviewWords = await db.getAllAsync(
      `SELECT * FROM cards WHERE word_id IN (${placeholders}) AND type = 'word' AND reps > 0 AND buried = 0 AND due <= ? ORDER BY due ASC LIMIT ?`,
      [...wordIds, lookahead, reviewLimit]
    );

    const reviewedWordIds = await db.getAllAsync<any>(
      `SELECT DISTINCT word_id FROM cards WHERE word_id IN (${placeholders}) AND type = 'word' AND (reps >= 2 OR buried = 1)`,
      wordIds
    );
    const reviewedSet = new Set(reviewedWordIds.map((r: any) => r.word_id));

    const sentenceSlots = Math.max(3, limit - (newCards as any[]).length - (reviewWords as any[]).length);
    let sentenceCards: any[] = [];
    if (reviewedSet.size > 0) {
      const reviewedIds = [...reviewedSet];
      const sentencePlaceholders = reviewedIds.map(() => '?').join(',');
      sentenceCards = await db.getAllAsync(
        `SELECT * FROM cards WHERE word_id IN (${sentencePlaceholders}) AND type = 'sentence' AND buried = 0 AND due <= ? ORDER BY due ASC LIMIT ?`,
        [...reviewedIds, lookahead, sentenceSlots]
      );
    }

    return [...reviewWords, ...sentenceCards, ...newCards];
  }

  async getWordReps(wordIds: number[]): Promise<Map<number, number>> {
    const db = await this.open();
    if (wordIds.length === 0) return new Map();
    const placeholders = wordIds.map(() => '?').join(',');
    const rows = await db.getAllAsync<any>(
      `SELECT word_id, reps FROM cards WHERE word_id IN (${placeholders}) AND type = 'word'`,
      wordIds
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
      "SELECT COUNT(*) as cnt FROM cards WHERE state >= 2 AND stability > 10"
    );
    return row?.cnt ?? 0;
  }

  async getMasteredWordCount() {
    const db = await this.open();
    const row = await db.getFirstAsync<any>(
      "SELECT COUNT(*) as cnt FROM cards WHERE type = 'word' AND state >= 2 AND stability > 10"
    );
    return row?.cnt ?? 0;
  }

  async getReviewedWordCount(level: string) {
    const db = await this.open();
    const { getWordsForLevel } = require('@/data/words');
    const levelWords = getWordsForLevel(level);
    const wordIds = levelWords.map((w: any) => w.id);
    if (wordIds.length === 0) return 0;
    const placeholders = wordIds.map(() => '?').join(',');
    const row = await db.getFirstAsync<any>(
      `SELECT COUNT(*) as cnt FROM cards WHERE word_id IN (${placeholders}) AND type = 'word' AND (reps > 0 OR buried = 1)`,
      wordIds
    );
    return row?.cnt ?? 0;
  }

  async buryCard(wordId: number, type: string) {
    const db = await this.open();
    await db.runAsync('UPDATE cards SET buried = 1 WHERE word_id = ? AND type = ?', [wordId, type]);
  }

  async resetAllProgress() {
    const db = await this.open();
    await db.execAsync(`
      DELETE FROM cards;
      DELETE FROM card_attempts;
      UPDATE user_level SET level = 'A0', correct_streak = 0, mistakes_in_window = 0, fail_streak = 0 WHERE id = 1;
      UPDATE streak SET current_count = 0, last_date = NULL, longest_count = 0 WHERE id = 1;
    `);
  }
}

let instance: DB;
export function getDb(): DB {
  if (!instance) instance = new SQLiteDB();
  return instance;
}
