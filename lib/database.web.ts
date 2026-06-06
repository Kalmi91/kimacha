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
  getMasteredWordCount(level: string): Promise<number>;
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

class MemoryDB implements DB {
  private cards: Map<string, any> = new Map();
  private streak = { current_count: 0, last_date: null as string | null, longest_count: 0 };
  // Active language pair (e.g. "es-hu"); scopes cards + level so each pair keeps its own progress.
  private activePair = 'es-hu';

  private key(wordId: number, type: string) { return `${this.activePair}:${wordId}:${type}`; }

  async ensureCard(wordId: number, type: string) {
    const k = this.key(wordId, type);
    if (this.cards.has(k)) return;
    const empty = createEmptyCard();
    this.cards.set(k, {
      word_id: wordId, type, pair: this.activePair,
      due: empty.due.toISOString(),
      stability: empty.stability, difficulty: empty.difficulty,
      elapsed_days: empty.elapsed_days, scheduled_days: empty.scheduled_days,
      learning_steps: empty.learning_steps,
      reps: empty.reps, lapses: empty.lapses, state: empty.state,
      last_review: null,
    });
  }

  async updateCard(wordId: number, type: string, card: Card) {
    const k = this.key(wordId, type);
    const existing = this.cards.get(k);
    this.cards.set(k, {
      word_id: wordId, type, pair: this.activePair,
      due: card.due.toISOString(),
      stability: card.stability, difficulty: card.difficulty,
      elapsed_days: card.elapsed_days, scheduled_days: card.scheduled_days,
      learning_steps: card.learning_steps,
      reps: card.reps, lapses: card.lapses, state: card.state,
      last_review: card.last_review ? card.last_review.toISOString() : null,
      buried: existing?.buried ?? 0,
    });
  }

  async getDueCards(limit: number) {
    const now = new Date().toISOString();
    return [...this.cards.values()]
      .filter(c => c.due <= now && !c.buried && c.pair === this.activePair)
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
  private userLevels: Map<string, any> = new Map();

  async getOnboarding() {
    return this.onboarding;
  }

  async setOnboarding(source: string, target: string) {
    this.onboarding = { source, target };
    this.activePair = `${source}-${target}`;
  }

  async getLevel() {
    return { ...(this.userLevels.get(this.activePair) ?? { level: 'A0', correct_streak: 0, mistakes_in_window: 0, fail_streak: 0 }) };
  }

  async updateLevel(level: string, correctStreak: number, mistakesInWindow: number, failStreak: number) {
    this.userLevels.set(this.activePair, { level, correct_streak: correctStreak, mistakes_in_window: mistakesInWindow, fail_streak: failStreak });
  }

  async getDueCardsForLevel(level: string, limit: number) {
    const { getWordsForLevel } = require('@/data/words');
    const levelWords = getWordsForLevel(level);
    const wordIds = levelWords.map((w: any) => w.id);
    return this.getDueCardsForWordIds(wordIds, limit);
  }

  async getDueCardsForWordIds(wordIds: number[], limit: number) {
    const idSet = new Set(wordIds);
    const now = new Date().toISOString();
    const lookahead = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const all = [...this.cards.values()].filter(c => idSet.has(c.word_id) && c.pair === this.activePair);

    const newLimit = Math.max(1, Math.round(limit * 0.3));
    const reviewLimit = limit - newLimit;

    const newCards = all
      .filter(c => c.type === 'word' && c.reps === 0 && !c.buried && c.due <= now)
      .sort((a, b) => a.due.localeCompare(b.due))
      .slice(0, newLimit);

    const reviewWords = all
      .filter(c => c.type === 'word' && c.reps > 0 && !c.buried && c.due <= lookahead)
      .sort((a, b) => a.due.localeCompare(b.due))
      .slice(0, reviewLimit);

    const knownWordIds = new Set(
      all.filter(c => c.type === 'word' && (c.reps >= 2 || c.buried)).map(c => c.word_id)
    );

    const sentenceSlots = Math.max(3, limit - newCards.length - reviewWords.length);
    const sentenceCards = all
      .filter(c => c.type === 'sentence' && !c.buried && knownWordIds.has(c.word_id) && c.due <= lookahead)
      .sort((a, b) => a.due.localeCompare(b.due))
      .slice(0, sentenceSlots);

    return [...reviewWords, ...sentenceCards, ...newCards];
  }

  async getWordReps(wordIds: number[]): Promise<Map<number, number>> {
    const idSet = new Set(wordIds);
    const map = new Map<number, number>();
    for (const c of this.cards.values()) {
      if (idSet.has(c.word_id) && c.type === 'word' && c.pair === this.activePair) {
        map.set(c.word_id, c.reps);
      }
    }
    return map;
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
  async getMasteredWordCount(level: string) {
    const { getWordsForLevel } = require('@/data/words');
    const levelWords = getWordsForLevel(level);
    const wordIds = new Set(levelWords.map((w: any) => w.id));
    return [...this.cards.values()].filter(c =>
      wordIds.has(c.word_id) && c.type === 'word' && (c.state >= 2 || c.buried === 1) && c.pair === this.activePair
    ).length;
  }
  async getReviewedWordCount(level: string) {
    const { getWordsForLevel } = require('@/data/words');
    const levelWords = getWordsForLevel(level);
    const wordIds = new Set(levelWords.map((w: any) => w.id));
    return [...this.cards.values()].filter(c => wordIds.has(c.word_id) && c.type === 'word' && (c.reps > 0 || c.buried) && c.pair === this.activePair).length;
  }

  async buryCard(wordId: number, type: string) {
    const k = this.key(wordId, type);
    const card = this.cards.get(k);
    if (card) card.buried = 1;
  }

  async resetAllProgress() {
    // Reset only the active pair — other languages keep their progress.
    for (const k of [...this.cards.keys()]) {
      if (this.cards.get(k)?.pair === this.activePair) this.cards.delete(k);
    }
    this.userLevels.delete(this.activePair);
  }
}

let instance: DB;
export function getDb(): DB {
  if (!instance) instance = new MemoryDB();
  return instance;
}
