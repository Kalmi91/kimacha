import { createEmptyCard, type Card } from 'ts-fsrs';
import { BACKUP_SCHEMA_VERSION, getAppVersion, type BackupPayload } from './backup';
import { pickSurvivor } from './cardMerge';
import { DEFAULT_REQUEUE_LEVEL } from './requeueGap';
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
  getPracticeCardsForLevel(level: string, limit: number): Promise<any[]>;
  // FB225: a szint-szűrésen kívül esedékes, megkezdett szó-kártyák (a natív tükre).
  getDueCarryoverCards(excludeWordIds: number[], limit: number): Promise<any[]>;
  countDueCarryoverWords(excludeWordIds: number[]): Promise<number>;
  getWordReps(wordIds: number[]): Promise<Map<number, number>>;
  getWordStates(wordIds: number[]): Promise<Map<number, number>>;
  // GAMES.md 3.1 (F0): every non-buried word card of a given pair, for
  // lib/games/vocabPool.ts. Explicit `pair` param, matches the native twin.
  getAllWordCards(pair: string): Promise<{ word_id: number; reps: number; lapses: number; state: number; buried: 0 | 1 }[]>;
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
  getScheduledWordDueDates(): Promise<string[]>;
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
  getStrictAccents(): Promise<boolean>;
  setStrictAccents(v: boolean): Promise<void>;
  getArticlePicker(): Promise<boolean>;
  setArticlePicker(v: boolean): Promise<void>;
  getRequeueLevel(): Promise<string>;
  setRequeueLevel(v: string): Promise<void>;
  getWeeklyGoalMinutes(): Promise<number>;
  setWeeklyGoalMinutes(minutes: number): Promise<void>;
  getFeedbackBtnSide(): Promise<'left' | 'right'>;
  setFeedbackBtnSide(side: 'left' | 'right'): Promise<void>;
  getDailyNewLimit(): Promise<number>;
  setDailyNewLimit(limit: number): Promise<void>;
  getNewLimitBonus(): Promise<number>;
  addNewLimitBonus(extra: number): Promise<void>;
  getNewWordsToday(): Promise<number>;
  getUnlearnedWordCount(): Promise<number>;
  addUsageMinute(): Promise<number>;
  getUsageStats(): Promise<UsageStats>;
  // GAMES.md 3.5 (F0): Game fül tables, scoped to the active pair like every
  // other per-pair setting/state in this interface.
  getGameScore(gameId: string): Promise<{ bestScore: number; bestAt: string | null; plays: number; lastPlayed: string | null } | null>;
  recordGameScore(gameId: string, score: number): Promise<{ isNewBest: boolean; best: number }>;
  getGameSettings(gameId: string): Promise<Record<string, unknown> | null>;
  setGameSettings(gameId: string, settings: Record<string, unknown>): Promise<void>;
  getGameProgress(gameId: string): Promise<{ itemId: string; state: string; data: unknown }[]>;
  setGameProgress(gameId: string, itemId: string, state: string, data?: unknown): Promise<void>;
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
    const levelWords = getWordsForLevel(level, this.activePair.split('-')[1]);
    const wordIds = levelWords.map((w: any) => w.id);
    return this.getDueCardsForWordIds(wordIds, limit);
  }

  // FB190: szabad gyakorlás a szint megkezdett szavaiból, esedékesség nélkül
  // (a SQLite oldal tükre).
  async getPracticeCardsForLevel(level: string, limit: number) {
    const { getWordsForLevel } = require('@/data/words');
    const ids = new Set(getWordsForLevel(level as any, this.activePair.split('-')[1] ?? 'es').map((w: any) => w.id));
    const rows = [...this.cards.values()].filter(
      (c: any) => c.type === 'word' && c.pair === this.activePair && c.reps > 0 && !c.buried && ids.has(c.word_id)
    );
    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rows[i], rows[j]] = [rows[j], rows[i]];
    }
    return rows.slice(0, limit);
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

    // FB89: same 4:1 cap and weakest-word-first ordering as the native DB.
    const sentenceSlots = sentenceSlotCount(newCards.length + reviewWords.length);
    const weakness = new Map<number, WordWeakness>(
      all
        .filter(c => c.type === 'word')
        .map(c => [c.word_id, { lapses: c.lapses, difficulty: c.difficulty }])
    );
    const sentenceCards = rankSentencesByWordWeakness(
      all
        .filter(c => c.type === 'sentence' && !c.buried && knownWordIds.has(c.word_id) && c.due <= lookahead)
        .sort((a, b) => a.due.localeCompare(b.due)),
      weakness
    ).slice(0, sentenceSlots);

    return [...reviewWords, ...sentenceCards, ...newCards];
  }

  async countDueReviewWords(wordIds: number[]) {
    if (wordIds.length === 0) return 0;
    const idSet = new Set(wordIds);
    const lookahead = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const due = new Set(
      [...this.cards.values()]
        .filter(c => idSet.has(c.word_id) && c.type === 'word' && c.reps > 0 && !c.buried
          && c.pair === this.activePair && c.due <= lookahead)
        .map(c => c.word_id)
    );
    return due.size;
  }

  async countDueReviewWordsForLevel(level: string) {
    const { getWordsForLevel } = require('@/data/words');
    const levelWords = getWordsForLevel(level, this.activePair.split('-')[1]);
    return this.countDueReviewWords(levelWords.map((w: any) => w.id));
  }

  // FB225: a szinten kívüli, már megkezdett szavak esedékes ismétlései (a
  // SQLite oldal tükre). A szűrés a hívó által besorolt id-kra megy, nem
  // szintre, így nem függ a szint-sorrendtől.
  async getDueCarryoverCards(excludeWordIds: number[], limit: number) {
    if (limit <= 0) return [];
    const excluded = new Set(excludeWordIds);
    const lookahead = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    return [...this.cards.values()]
      .filter(c => c.type === 'word' && c.reps > 0 && !c.buried && c.pair === this.activePair
        && c.due <= lookahead && !excluded.has(c.word_id))
      .sort((a, b) => a.due.localeCompare(b.due))
      .slice(0, limit);
  }

  async countDueCarryoverWords(excludeWordIds: number[]) {
    const excluded = new Set(excludeWordIds);
    const lookahead = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const due = new Set(
      [...this.cards.values()]
        .filter(c => c.type === 'word' && c.reps > 0 && !c.buried && c.pair === this.activePair
          && c.due <= lookahead && !excluded.has(c.word_id))
        .map(c => c.word_id)
    );
    return due.size;
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

  // A szó-kártya FSRS állapota (0 New, 1 Learning, 2 Review, 3 Relearning).
  // A topic-készültség ebből dől el, nem a reps-ből, lásd lib/topicMastery.ts.
  async getWordStates(wordIds: number[]): Promise<Map<number, number>> {
    const idSet = new Set(wordIds);
    const map = new Map<number, number>();
    for (const c of this.cards.values()) {
      if (idSet.has(c.word_id) && c.type === 'word' && c.pair === this.activePair) {
        map.set(c.word_id, c.state);
      }
    }
    return map;
  }

  // GAMES.md 3.1 (F0): every non-buried word card of `pair`, for vocabPool.ts.
  // FB162 follow-up: buried cards stay in the list, flagged (see database.ts).
  async getAllWordCards(pair: string) {
    return [...this.cards.values()]
      .filter((c) => c.type === 'word' && c.pair === pair)
      .map((c) => ({ word_id: c.word_id, reps: c.reps, lapses: c.lapses, state: c.state, buried: (c.buried ? 1 : 0) as 0 | 1 }));
  }

  private attempts: { word_id: number; type: string; pair?: string; correct: boolean; response_time_ms: number; timestamp: string }[] = [];

  async recordAttempt(wordId: number, type: string, correct: boolean, responseTimeMs: number) {
    this.attempts.push({ word_id: wordId, type, pair: this.activePair, correct, response_time_ms: responseTimeMs, timestamp: new Date().toISOString() });
  }

  private meta = { userId: crypto.randomUUID?.() ?? Math.random().toString(36), firstUseDate: new Date().toISOString(), lastSyncDate: null as string | null };

  async getUserMeta() { return { ...this.meta }; }
  async updateLastSync(date: string) { this.meta.lastSyncDate = date; }

  // FB76: first open of the day (memory mirror; a web reload counts as a new day).
  private lastOpenDate: string | null = null;

  async claimDailyGreeting(): Promise<boolean> {
    const today = localDateString();
    if (this.lastOpenDate === today) return false;
    this.lastOpenDate = today;
    return true;
  }

  // FB83: status-bar tint index (memory mirror, like every other web setting).
  private statusBarTint = 0;

  async getStatusBarTint(): Promise<number> { return this.statusBarTint; }
  async setStatusBarTint(index: number): Promise<void> { this.statusBarTint = index; }
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
    const levelWords = getWordsForLevel(level, this.activePair.split('-')[1]);
    const wordIds = new Set(levelWords.map((w: any) => w.id));
    // FB111: mastery needs the typing step passed too, see database.ts.
    return [...this.cards.values()].filter(c =>
      wordIds.has(c.word_id) && c.type === 'word' && c.pair === this.activePair &&
      ((c.state >= 2 && (c.reps ?? 0) - (c.lapses ?? 0) >= 3) || c.buried === 1)
    ).length;
  }
  async getReviewedWordCount(level: string) {
    const { getWordsForLevel } = require('@/data/words');
    const levelWords = getWordsForLevel(level, this.activePair.split('-')[1]);
    const wordIds = new Set(levelWords.map((w: any) => w.id));
    return [...this.cards.values()].filter(c => wordIds.has(c.word_id) && c.type === 'word' && (c.reps > 0 || c.buried) && c.pair === this.activePair).length;
  }

  // FB100: see the native twin, due dates of the word cards still in rotation.
  async getScheduledWordDueDates() {
    return [...this.cards.values()]
      .filter(c => c.type === 'word' && c.reps > 0 && !c.buried && c.pair === this.activePair)
      .map(c => String(c.due));
  }

  async buryCard(wordId: number, type: string) {
    const k = this.key(wordId, type);
    const card = this.cards.get(k);
    if (card) card.buried = 1;
  }

  // FB38: push the card's due date out by `days`, leaving reps/stability untouched
  // (unlike buryCard, this isn't final, the card resurfaces after the snooze).
  async snoozeCard(wordId: number, type: string, days: number) {
    const k = this.key(wordId, type);
    const card = this.cards.get(k);
    if (card) card.due = new Date(Date.now() + days * 86400000).toISOString();
  }

  // FB39: spelling-practice list, per-pair map like the other pair-scoped state.
  // Web doesn't survive reload, known, fine (same limit as wordsOnlyMap etc).
  private spellingLists: Map<string, Map<number, { step: number; due: string }>> = new Map();

  private spellingListFor(pair: string) {
    let m = this.spellingLists.get(pair);
    if (!m) { m = new Map(); this.spellingLists.set(pair, m); }
    return m;
  }

  async addToSpellingList(wordId: number) {
    const list = this.spellingListFor(this.activePair);
    if (!list.has(wordId)) list.set(wordId, { step: 0, due: new Date().toISOString() });
  }

  async removeFromSpellingList(wordId: number) {
    this.spellingListFor(this.activePair).delete(wordId);
  }

  async getSpellingList() {
    const list = this.spellingListFor(this.activePair);
    return [...list.entries()].map(([wordId, v]) => ({ wordId, step: v.step, due: v.due }));
  }

  async getSpellingDueCount() {
    const now = new Date().toISOString();
    return [...this.spellingListFor(this.activePair).values()].filter(v => v.due <= now).length;
  }

  async getSpellingListCount() {
    return this.spellingListFor(this.activePair).size;
  }

  async updateSpellingStep(wordId: number, step: number, due: string) {
    this.spellingListFor(this.activePair).set(wordId, { step, due });
  }

  async isInSpellingList(wordId: number) {
    return this.spellingListFor(this.activePair).has(wordId);
  }

  async resetAllProgress() {
    // Reset only the active pair, other languages keep their progress.
    for (const k of [...this.cards.keys()]) {
      if (this.cards.get(k)?.pair === this.activePair) this.cards.delete(k);
    }
    this.userLevels.delete(this.activePair);
  }

  private selectedTopics: Map<string, string | null> = new Map();

  async getSelectedTopic(): Promise<string | null> {
    return this.selectedTopics.get(this.activePair) ?? null;
  }

  async setSelectedTopic(topicId: string | null): Promise<void> {
    this.selectedTopics.set(this.activePair, topicId);
  }

  private wordsOnlyMap: Map<string, boolean> = new Map();

  async getWordsOnly(): Promise<boolean> {
    return this.wordsOnlyMap.get(this.activePair) ?? false;
  }

  async setWordsOnly(v: boolean): Promise<void> {
    this.wordsOnlyMap.set(this.activePair, v);
  }

  private randomTopicsMap: Map<string, boolean> = new Map();

  async getRandomTopics(): Promise<boolean> {
    return this.randomTopicsMap.get(this.activePair) ?? false;
  }

  async setRandomTopics(v: boolean): Promise<void> {
    this.randomTopicsMap.set(this.activePair, v);
  }

  // FB132: difficulty switch, per pair (mirrors the SQLite side).
  private strictAccentsMap: Map<string, boolean> = new Map();

  async getStrictAccents(): Promise<boolean> {
    return this.strictAccentsMap.get(this.activePair) ?? false;
  }

  async setStrictAccents(v: boolean): Promise<void> {
    this.strictAccentsMap.set(this.activePair, v);
  }

  // FB188: névelő-gombsor kapcsoló, per pár (a SQLite oldal tükre). Alapból be.
  private articlePickerMap: Map<string, boolean> = new Map();

  async getArticlePicker(): Promise<boolean> {
    return this.articlePickerMap.get(this.activePair) ?? true;
  }

  async setArticlePicker(v: boolean): Promise<void> {
    this.articlePickerMap.set(this.activePair, v);
  }

  // FB198: az elrontott szó visszatérési távolsága, per pár (a SQLite oldal tükre).
  private requeueLevelMap: Map<string, string> = new Map();

  async getRequeueLevel(): Promise<string> {
    return this.requeueLevelMap.get(this.activePair) ?? DEFAULT_REQUEUE_LEVEL;
  }

  async setRequeueLevel(v: string): Promise<void> {
    this.requeueLevelMap.set(this.activePair, v);
  }

  // FB65: weekly study goal in minutes, per pair (mirrors the SQLite side).
  private weeklyGoalMap: Map<string, number> = new Map();

  async getWeeklyGoalMinutes(): Promise<number> {
    return this.weeklyGoalMap.get(this.activePair) ?? DEFAULT_WEEKLY_GOAL_MINUTES;
  }

  async setWeeklyGoalMinutes(minutes: number): Promise<void> {
    this.weeklyGoalMap.set(this.activePair, minutes);
  }

  private feedbackBtnSideMap: Map<string, 'left' | 'right'> = new Map();

  async getFeedbackBtnSide(): Promise<'left' | 'right'> {
    return this.feedbackBtnSideMap.get(this.activePair) ?? 'right';
  }

  async setFeedbackBtnSide(side: 'left' | 'right'): Promise<void> {
    this.feedbackBtnSideMap.set(this.activePair, side);
  }

  // FB77: daily new-word budget (memory mirror of the SQLite columns).
  private dailyNewLimitMap: Map<string, number> = new Map();
  private newBonusMap: Map<string, { date: string; bonus: number }> = new Map();

  async getDailyNewLimit(): Promise<number> {
    return this.dailyNewLimitMap.get(this.activePair) ?? DEFAULT_DAILY_NEW_LIMIT;
  }

  async setDailyNewLimit(limit: number): Promise<void> {
    this.dailyNewLimitMap.set(this.activePair, limit);
  }

  async getNewLimitBonus(): Promise<number> {
    const entry = this.newBonusMap.get(this.activePair);
    return entry && entry.date === localDateString() ? entry.bonus : 0;
  }

  async addNewLimitBonus(extra: number): Promise<void> {
    const current = await this.getNewLimitBonus();
    this.newBonusMap.set(this.activePair, { date: localDateString(), bonus: current + extra });
  }

  async getNewWordsToday(): Promise<number> {
    const today = localDateString();
    const first = new Map<number, string>();
    for (const a of this.attempts) {
      // FB129: per-pair, so a day on one course does not exhaust the other's budget.
      if (a.type !== 'word' || (a.pair ?? this.activePair) !== this.activePair) continue;
      const prev = first.get(a.word_id);
      if (!prev || a.timestamp < prev) first.set(a.word_id, a.timestamp);
    }
    return [...first.values()].filter(ts => localDateString(new Date(ts)) === today).length;
  }

  // FB103: word cards still in the FSRS learning (1) / relearning (3) state.
  async getUnlearnedWordCount(): Promise<number> {
    return [...this.cards.values()].filter(
      c => c.type === 'word' && c.pair === this.activePair && !c.buried && c.reps > 0 && (c.state === 1 || c.state === 3)
    ).length;
  }

  // Usage-timer feature: one entry per local calendar day, app-wide (not
  // scoped to a language pair, unlike cards/level). Web doesn't survive
  // reload, same known limitation as the other in-memory maps above.
  private usageMinutes: Map<string, number> = new Map();

  async addUsageMinute(): Promise<number> {
    const date = localDateString();
    const total = (this.usageMinutes.get(date) ?? 0) + 1;
    this.usageMinutes.set(date, total);
    return total;
  }

  async getUsageStats(): Promise<UsageStats> {
    const rows = [...this.usageMinutes.entries()].map(([date, minutes]) => ({ date, minutes }));
    return summarizeUsage(rows);
  }

  // FB108: one local calendar day's totals, for the midnight celebration.
  async getDayStats(date: string): Promise<{ minutes: number; words: number }> {
    const words = new Set(
      this.attempts
        .filter(a => a.type === 'word' && localDateString(new Date(a.timestamp)) === date)
        .map(a => a.word_id)
    );
    return { minutes: this.usageMinutes.get(date) ?? 0, words: words.size };
  }

  // GAMES.md 3.5 (F0): Game fül rekord/beállítás/haladás táblák, per-pair
  // maps like the other web-only state above (session-scoped, doesn't
  // survive reload, same known limitation as everything else in this file).
  private gameScores: Map<string, { bestScore: number; bestAt: string | null; plays: number; lastPlayed: string | null }> = new Map();
  private gameSettingsMap: Map<string, Record<string, unknown>> = new Map();
  private gameProgressMap: Map<string, Map<string, { state: string; data: unknown }>> = new Map();

  private gameKey(gameId: string) {
    return `${this.activePair}:${gameId}`;
  }

  async getGameScore(gameId: string) {
    return this.gameScores.get(this.gameKey(gameId)) ?? null;
  }

  async recordGameScore(gameId: string, score: number) {
    const key = this.gameKey(gameId);
    const existing = this.gameScores.get(key);
    const prevBest = existing?.bestScore ?? 0;
    const isNewBest = score > prevBest;
    const now = new Date().toISOString();
    this.gameScores.set(key, {
      bestScore: isNewBest ? score : prevBest,
      bestAt: isNewBest ? now : (existing?.bestAt ?? now),
      plays: (existing?.plays ?? 0) + 1,
      lastPlayed: now,
    });
    return { isNewBest, best: isNewBest ? score : prevBest };
  }

  async getGameSettings(gameId: string) {
    return this.gameSettingsMap.get(this.gameKey(gameId)) ?? null;
  }

  async setGameSettings(gameId: string, settings: Record<string, unknown>) {
    this.gameSettingsMap.set(this.gameKey(gameId), settings);
  }

  private gameProgressFor(gameId: string) {
    const key = this.gameKey(gameId);
    let m = this.gameProgressMap.get(key);
    if (!m) {
      m = new Map();
      this.gameProgressMap.set(key, m);
    }
    return m;
  }

  async getGameProgress(gameId: string) {
    return [...this.gameProgressFor(gameId).entries()].map(([itemId, v]) => ({ itemId, state: v.state, data: v.data }));
  }

  async setGameProgress(gameId: string, itemId: string, state: string, data?: unknown) {
    this.gameProgressFor(gameId).set(itemId, { state, data });
  }

  // Q0: full learning-state backup. Memory state is serialized into the same
  // table-row shapes as the SQLite implementation, so a backup made on one
  // platform restores on the other.
  async exportAll(): Promise<BackupPayload> {
    const settingsPairs = new Set<string>([
      ...this.wordsOnlyMap.keys(),
      ...this.randomTopicsMap.keys(),
      ...this.feedbackBtnSideMap.keys(),
    ]);
    const learn_settings = [...settingsPairs].map(pair => ({
      pair,
      words_only: this.wordsOnlyMap.has(pair) ? (this.wordsOnlyMap.get(pair) ? 1 : 0) : null,
      random_topics: this.randomTopicsMap.has(pair) ? (this.randomTopicsMap.get(pair) ? 1 : 0) : null,
      feedback_btn_side: this.feedbackBtnSideMap.get(pair) ?? null,
    }));
    const spelling_list: any[] = [];
    for (const [pair, list] of this.spellingLists) {
      for (const [wordId, v] of list) {
        spelling_list.push({ pair, word_id: wordId, step: v.step, due: v.due });
      }
    }
    return {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      appVersion: getAppVersion(),
      tables: {
        cards: [...this.cards.values()].map(c => ({ ...c })),
        card_attempts: this.attempts.map(a => ({ ...a, correct: a.correct ? 1 : 0 })),
        game_progress: [...this.gameProgressMap].flatMap(([key, items]) => {
          const sep = key.lastIndexOf(':');
          const pair = key.slice(0, sep), game_id = key.slice(sep + 1);
          return [...items].map(([item_id, v]) => ({
            pair, game_id, item_id, state: v.state,
            data_json: v.data !== undefined ? JSON.stringify(v.data) : null,
          }));
        }),
        game_scores: [...this.gameScores].map(([key, v]) => {
          const sep = key.lastIndexOf(':');
          return {
            pair: key.slice(0, sep), game_id: key.slice(sep + 1),
            best_score: v.bestScore, best_at: v.bestAt, plays: v.plays, last_played: v.lastPlayed,
          };
        }),
        game_settings: [...this.gameSettingsMap].map(([key, settings]) => {
          const sep = key.lastIndexOf(':');
          return { pair: key.slice(0, sep), game_id: key.slice(sep + 1), settings_json: JSON.stringify(settings) };
        }),
        learn_settings,
        onboarding: this.onboarding ? [{ id: 1, ...this.onboarding }] : [],
        selected_topic: [...this.selectedTopics].map(([pair, topicId]) => ({ pair, topic_id: topicId })),
        spelling_list,
        streak: [{ id: 1, ...this.streak }],
        user_level: [...this.userLevels].map(([pair, l]) => ({ pair, ...l })),
        user_meta: [{ id: 1, user_id: this.meta.userId, first_use_date: this.meta.firstUseDate, last_sync_date: this.meta.lastSyncDate }],
      },
    };
  }

  // Q0: restore, replaces the whole in-memory state from the payload.
  async importAll(payload: BackupPayload): Promise<void> {
    const t = payload.tables;
    this.cards = new Map(t.cards.map((c: any) => [`${c.pair}:${c.word_id}:${c.type}`, { ...c }]));
    this.attempts = t.card_attempts.map((a: any) => ({ ...a, correct: !!a.correct }));
    // Re-keyed by `${pair}:${game_id}` directly (not via gameProgressFor,
    // which keys off the CURRENT activePair, a restore can carry rows for
    // several pairs at once).
    this.gameProgressMap = new Map(
      Object.entries(
        (t.game_progress as any[]).reduce((acc: Record<string, [string, { state: string; data: unknown }][]>, row) => {
          const key = `${row.pair}:${row.game_id}`;
          let data: unknown;
          if (row.data_json) {
            try {
              data = JSON.parse(row.data_json);
            } catch {
              data = undefined;
            }
          }
          (acc[key] ??= []).push([row.item_id, { state: row.state, data }]);
          return acc;
        }, {})
      ).map(([key, entries]) => [key, new Map(entries)])
    );
    this.gameScores = new Map(
      (t.game_scores as any[]).map((row) => [
        `${row.pair}:${row.game_id}`,
        { bestScore: row.best_score, bestAt: row.best_at, plays: row.plays, lastPlayed: row.last_played },
      ])
    );
    this.gameSettingsMap = new Map(
      (t.game_settings as any[]).map((row) => {
        let settings: Record<string, unknown> = {};
        try {
          settings = JSON.parse(row.settings_json);
        } catch {
          settings = {};
        }
        return [`${row.pair}:${row.game_id}`, settings];
      })
    );
    this.wordsOnlyMap = new Map();
    this.randomTopicsMap = new Map();
    this.feedbackBtnSideMap = new Map();
    for (const row of t.learn_settings) {
      if (row.words_only != null) this.wordsOnlyMap.set(row.pair, row.words_only === 1);
      if (row.random_topics != null) this.randomTopicsMap.set(row.pair, row.random_topics === 1);
      if (row.feedback_btn_side != null) this.feedbackBtnSideMap.set(row.pair, row.feedback_btn_side);
    }
    const ob = t.onboarding[0];
    this.onboarding = ob ? { source: ob.source, target: ob.target } : null;
    if (this.onboarding) this.activePair = `${this.onboarding.source}-${this.onboarding.target}`;
    this.selectedTopics = new Map(t.selected_topic.map((r: any) => [r.pair, r.topic_id]));
    this.spellingLists = new Map();
    for (const row of t.spelling_list) {
      this.spellingListFor(row.pair).set(row.word_id, { step: row.step, due: row.due });
    }
    const st = t.streak[0];
    if (st) this.streak = { current_count: st.current_count, last_date: st.last_date, longest_count: st.longest_count };
    this.userLevels = new Map(t.user_level.map((r: any) => [r.pair, { level: r.level, correct_streak: r.correct_streak, mistakes_in_window: r.mistakes_in_window, fail_streak: r.fail_streak }]));
    const um = t.user_meta[0];
    if (um) this.meta = { userId: um.user_id, firstUseDate: um.first_use_date, lastSyncDate: um.last_sync_date };
    this.applyWordMerges();
  }

  // A backup taken before the duplicate cleanup (2026-08-07) still holds cards
  // for word ids that no longer exist. Same rule as the native DB: the progress
  // moves to the surviving twin, and if both sides have history the stronger one
  // wins. Spanish-target pairs only, the en/hu tracks number their words apart.
  private applyWordMerges() {
    for (const [key, card] of [...this.cards]) {
      const newId = WORD_MERGES[card.word_id];
      if (!newId || !String(card.pair).endsWith('-es')) continue;
      this.cards.delete(key);
      const twinKey = `${card.pair}:${newId}:${card.type}`;
      const twin = this.cards.get(twinKey);
      if (twin && pickSurvivor(twin, card) === twin) continue;
      this.cards.set(twinKey, { ...card, word_id: newId });
    }
    for (const [pair, list] of this.spellingLists) {
      if (!pair.endsWith('-es')) continue;
      for (const [wordId, entry] of [...list]) {
        const newId = WORD_MERGES[wordId];
        if (!newId) continue;
        list.delete(wordId);
        if (!list.has(newId)) list.set(newId, entry);
      }
    }
    for (const attempt of this.attempts) {
      const newId = WORD_MERGES[attempt.word_id];
      if (newId) attempt.word_id = newId;
    }
  }
}

let instance: DB;
export function getDb(): DB {
  if (!instance) instance = new MemoryDB();
  return instance;
}
