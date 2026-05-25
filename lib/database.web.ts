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
  recordAttempt(wordId: number, type: string, correct: boolean, responseTimeMs: number): Promise<void>;
  getUserMeta(): Promise<{ userId: string; firstUseDate: string; lastSyncDate: string | null }>;
  updateLastSync(date: string): Promise<void>;
  getTodayStats(): Promise<{ totalReviews: number; correctCount: number; avgResponseMs: number; flashcardCount: number; typingCount: number; wordCount: number; sentenceCount: number }>;
  getTop5Failed(): Promise<string[]>;
  getMasteredCount(): Promise<number>;
  getReviewedWordCount(level: string): Promise<number>;
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

class MemoryDB implements DB {
  private cards: Map<string, any> = new Map();
  private streak = { current_count: 0, last_date: null as string | null, longest_count: 0 };

  private key(wordId: number, type: string) { return `${wordId}:${type}`; }

  async ensureCard(wordId: number, type: string) {
    const k = this.key(wordId, type);
    if (this.cards.has(k)) return;
    const empty = createEmptyCard();
    this.cards.set(k, {
      word_id: wordId, type,
      due: empty.due.toISOString(),
      stability: empty.stability, difficulty: empty.difficulty,
      elapsed_days: empty.elapsed_days, scheduled_days: empty.scheduled_days,
      learning_steps: empty.learning_steps,
      reps: empty.reps, lapses: empty.lapses, state: empty.state,
      last_review: null,
    });
  }

  async updateCard(wordId: number, type: string, card: Card) {
    this.cards.set(this.key(wordId, type), {
      word_id: wordId, type,
      due: card.due.toISOString(),
      stability: card.stability, difficulty: card.difficulty,
      elapsed_days: card.elapsed_days, scheduled_days: card.scheduled_days,
      learning_steps: card.learning_steps,
      reps: card.reps, lapses: card.lapses, state: card.state,
      last_review: card.last_review ? card.last_review.toISOString() : null,
    });
  }

  async getDueCards(limit: number) {
    const now = new Date().toISOString();
    return [...this.cards.values()]
      .filter(c => c.due <= now)
      .sort((a, b) => a.due.localeCompare(b.due))
      .slice(0, limit);
  }

  async getStreak() {
    return { ...this.streak };
  }

  async updateStreak() {
    const today = new Date().toISOString().split('T')[0];
    if (this.streak.last_date === today) return;
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    this.streak.current_count = this.streak.last_date === yesterday ? this.streak.current_count + 1 : 1;
    this.streak.last_date = today;
    this.streak.longest_count = Math.max(this.streak.current_count, this.streak.longest_count);
  }

  private onboarding: { source: string; target: string } | null = null;
  private userLevel = { level: 'A0', correct_streak: 0, mistakes_in_window: 0, fail_streak: 0 };

  async getOnboarding() {
    return this.onboarding;
  }

  async setOnboarding(source: string, target: string) {
    this.onboarding = { source, target };
  }

  async getLevel() {
    return { ...this.userLevel };
  }

  async updateLevel(level: string, correctStreak: number, mistakesInWindow: number, failStreak: number) {
    this.userLevel = { level, correct_streak: correctStreak, mistakes_in_window: mistakesInWindow, fail_streak: failStreak };
  }

  async getDueCardsForLevel(level: string, limit: number) {
    const { getWordsForLevel } = require('@/data/words');
    const levelWords = getWordsForLevel(level);
    const wordIds = new Set(levelWords.map((w: any) => w.id));
    const now = new Date().toISOString();
    const all = [...this.cards.values()].filter(c => wordIds.has(c.word_id) && c.due <= now);

    const reviewedWordIds = new Set(
      [...this.cards.values()].filter(c => wordIds.has(c.word_id) && c.type === 'word' && c.reps > 0).map(c => c.word_id)
    );

    const wordCards = all.filter(c => c.type === 'word').sort((a, b) => a.due.localeCompare(b.due));
    const sentenceCards = all.filter(c => c.type === 'sentence' && reviewedWordIds.has(c.word_id)).sort((a, b) => a.due.localeCompare(b.due));

    return [...wordCards, ...sentenceCards].slice(0, limit);
  }

  private attempts: { word_id: number; type: string; correct: boolean; response_time_ms: number; timestamp: string }[] = [];

  async recordAttempt(wordId: number, type: string, correct: boolean, responseTimeMs: number) {
    this.attempts.push({ word_id: wordId, type, correct, response_time_ms: responseTimeMs, timestamp: new Date().toISOString() });
  }

  private meta = { userId: crypto.randomUUID?.() ?? Math.random().toString(36), firstUseDate: new Date().toISOString(), lastSyncDate: null as string | null };

  async getUserMeta() { return { ...this.meta }; }
  async updateLastSync(date: string) { this.meta.lastSyncDate = date; }
  async getTodayStats() {
    const today = new Date().toISOString().split('T')[0];
    const todayAttempts = this.attempts.filter(a => a.timestamp >= `${today}T00:00:00`);
    const total = todayAttempts.length;
    const correct = todayAttempts.filter(a => a.correct).length;
    const avgMs = total > 0 ? Math.round(todayAttempts.reduce((s, a) => s + a.response_time_ms, 0) / total) : 0;
    return { totalReviews: total, correctCount: correct, avgResponseMs: avgMs, flashcardCount: 0, typingCount: 0, wordCount: todayAttempts.filter(a => a.type === 'word').length, sentenceCount: todayAttempts.filter(a => a.type === 'sentence').length };
  }
  async getTop5Failed() { return []; }
  async getMasteredCount() { return 0; }
  async getReviewedWordCount(level: string) {
    const { getWordsForLevel } = require('@/data/words');
    const levelWords = getWordsForLevel(level);
    const wordIds = new Set(levelWords.map((w: any) => w.id));
    return [...this.cards.values()].filter(c => wordIds.has(c.word_id) && c.type === 'word' && c.reps > 0).length;
  }
}

let instance: DB;
export function getDb(): DB {
  if (!instance) instance = new MemoryDB();
  return instance;
}
