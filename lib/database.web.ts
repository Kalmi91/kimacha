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
    return [...this.cards.values()]
      .filter(c => wordIds.has(c.word_id) && c.due <= now)
      .sort((a, b) => a.due.localeCompare(b.due))
      .slice(0, limit);
  }
}

let instance: DB;
export function getDb(): DB {
  if (!instance) instance = new MemoryDB();
  return instance;
}
