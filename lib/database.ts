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
      CREATE TABLE IF NOT EXISTS onboarding (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        source TEXT NOT NULL,
        target TEXT NOT NULL
      );
    `);
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
    return await db.getAllAsync('SELECT * FROM cards WHERE due <= ? ORDER BY due ASC LIMIT ?', [new Date().toISOString(), limit]);
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
}

let instance: DB;
export function getDb(): DB {
  if (!instance) instance = new SQLiteDB();
  return instance;
}
