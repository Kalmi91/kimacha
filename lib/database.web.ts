import { BACKUP_SCHEMA_VERSION, getAppVersion, type BackupPayload } from './backup';
import { pickSurvivor } from './cardMerge';
import { FORCED_PAIR, needsPairCorrection } from './languages';
import { WORD_MERGES } from './wordMerges';
import { localDateString, summarizeUsage, DEFAULT_WEEKLY_GOAL_MINUTES, DEFAULT_DAILY_NEW_LIMIT, type UsageStats } from './usageStats';
import { addDays, type Sm2Card } from './sm2';
import type { PcicLevel } from '@/data/pcic';
import { DEFAULT_AGAIN_DELAY_SEC } from './pcicSession';

export interface DB {
  getStreak(): Promise<{ current_count: number; last_date: string | null; longest_count: number }>;
  getOnboarding(): Promise<{ source: string; target: string } | null>;
  setOnboarding(source: string, target: string): Promise<void>;
  getLevel(): Promise<{ level: string; correct_streak: number; mistakes_in_window: number; fail_streak: number }>;
  claimDailyGreeting(): Promise<boolean>;
  getStatusBarTint(): Promise<number>;
  setStatusBarTint(index: number): Promise<void>;
  // PLAN-play 12. lépés: napi streak-írás visszakerült, a PCIC-értékelés hívja.
  updateStreak(): Promise<void>;
  addToSpellingList(wordId: number): Promise<void>;
  getSpellingList(): Promise<{ wordId: number; step: number; due: string }[]>;
  getSpellingDueCount(): Promise<number>;
  getSpellingListCount(): Promise<number>;
  updateSpellingStep(wordId: number, step: number, due: string): Promise<void>;
  // PLAN-play 12. lépés (s3): PCIC-tétel a helyesírás-listán, string id-vel.
  addToPcicSpellingList(itemId: string): Promise<void>;
  getPcicSpellingList(): Promise<{ itemId: string; step: number; due: string }[]>;
  getPcicSpellingDueCount(): Promise<number>;
  getPcicSpellingListCount(): Promise<number>;
  updatePcicSpellingStep(itemId: string, step: number, due: string): Promise<void>;
  getStrictAccents(): Promise<boolean>;
  setStrictAccents(v: boolean): Promise<void>;
  // FB364: a PCIC "rontott" (again) kártya ennyi másodperc múlva jön
  // mindenképp vissza (lib/pcicSession.ts).
  getAgainDelaySec(): Promise<number>;
  setAgainDelaySec(sec: number): Promise<void>;
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
  // GAMES.md 3.5 (F0): Game fül tables, scoped to the active pair like every
  // other per-pair setting/state in this interface.
  getGameProgress(gameId: string): Promise<{ itemId: string; state: string; data: unknown }[]>;
  setGameProgress(gameId: string, itemId: string, state: string, data?: unknown): Promise<void>;
  // PLAN-pcic 4. lépés: PCIC fül, SM-2, független a FSRS `cards`-tól
  getPcicCards(): Promise<Sm2Card[]>;
  upsertPcicCard(card: Sm2Card): Promise<void>;
  getPcicStats(today: string): Promise<{ total: number; newIntroducedToday: number; dueToday: number; learned: number }>;
  getPcicLevel(): Promise<PcicLevel>;
  setPcicLevel(level: PcicLevel): Promise<void>;
  resetPcicCards(levelPrefix?: string): Promise<void>;
  exportAll(): Promise<BackupPayload>;
  importAll(payload: BackupPayload): Promise<void>;
}

class MemoryDB implements DB {
  private cards: Map<string, any> = new Map();
  private streak = { current_count: 0, last_date: null as string | null, longest_count: 0 };
  // Active language pair (e.g. "es-hu"); scopes cards + level so each pair keeps its own progress.
  private activePair = 'es-hu';

  async getStreak() {
    return { ...this.streak };
  }

  // PLAN-play 12. lépés: visszahozva, a PCIC-értékelés hívja (mirrors the
  // native SQLiteDB.updateStreak).
  async updateStreak() {
    const today = localDateString();
    if (this.streak.last_date === today) return;
    const yesterday = addDays(today, -1);
    const newCount = this.streak.last_date === yesterday ? this.streak.current_count + 1 : 1;
    this.streak = { current_count: newCount, last_date: today, longest_count: Math.max(newCount, this.streak.longest_count) };
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

  // Play-vágás 7. lépés: updateLevel (the only public setter) had no app-code
  // caller and is gone; grammar-screen fixtures that need a specific level
  // use this instead. Not on the DB interface, same pattern as the old
  // __setRequeueLevelForTest.
  __setLevelForTest(level: string): void {
    this.userLevels.set(this.activePair, { level, correct_streak: 0, mistakes_in_window: 0, fail_streak: 0 });
  }

  private attempts: { word_id: number; type: string; pair?: string; correct: boolean; response_time_ms: number; timestamp: string }[] = [];

  private meta = { userId: crypto.randomUUID?.() ?? Math.random().toString(36), firstUseDate: new Date().toISOString(), lastSyncDate: null as string | null };

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

  // PLAN-play 12. lépés (s3): PCIC-tétel a helyesírás-listán, nem pair-hez
  // kötve (mint a pcic_cards map), item_id kulccsal.
  private pcicSpellingList: Map<string, { step: number; due: string }> = new Map();

  async addToPcicSpellingList(itemId: string) {
    if (!this.pcicSpellingList.has(itemId)) this.pcicSpellingList.set(itemId, { step: 0, due: new Date().toISOString() });
  }

  async getPcicSpellingList() {
    return [...this.pcicSpellingList.entries()].map(([itemId, v]) => ({ itemId, step: v.step, due: v.due }));
  }

  async getPcicSpellingDueCount() {
    const now = new Date().toISOString();
    return [...this.pcicSpellingList.values()].filter(v => v.due <= now).length;
  }

  async getPcicSpellingListCount() {
    return this.pcicSpellingList.size;
  }

  async updatePcicSpellingStep(itemId: string, step: number, due: string) {
    this.pcicSpellingList.set(itemId, { step, due });
  }

  // Play-vágás 7. lépés: getWordsOnly/setWordsOnly and getRandomTopics/
  // setRandomTopics are gone (no caller since the Learn/Topics tabs left),
  // but the maps stay so an imported old backup's learn_settings.words_only /
  // .random_topics values still round-trip through exportAll unchanged.
  private wordsOnlyMap: Map<string, boolean> = new Map();
  private randomTopicsMap: Map<string, boolean> = new Map();

  // FB132: difficulty switch, per pair (mirrors the SQLite side).
  private strictAccentsMap: Map<string, boolean> = new Map();

  async getStrictAccents(): Promise<boolean> {
    return this.strictAccentsMap.get(this.activePair) ?? false;
  }

  async setStrictAccents(v: boolean): Promise<void> {
    this.strictAccentsMap.set(this.activePair, v);
  }

  // FB364: memory mirror of the SQLite again_delay_sec column.
  private againDelaySecMap: Map<string, number> = new Map();

  async getAgainDelaySec(): Promise<number> {
    return this.againDelaySecMap.get(this.activePair) ?? DEFAULT_AGAIN_DELAY_SEC;
  }

  async setAgainDelaySec(sec: number): Promise<void> {
    this.againDelaySecMap.set(this.activePair, sec);
  }

  // FB188: névelő-gombsor kapcsoló, per pár (a SQLite oldal tükre). Alapból be.
  private articlePickerMap: Map<string, boolean> = new Map();

  async getArticlePicker(): Promise<boolean> {
    return this.articlePickerMap.get(this.activePair) ?? true;
  }

  async setArticlePicker(v: boolean): Promise<void> {
    this.articlePickerMap.set(this.activePair, v);
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

  async getDailyNewLimit(): Promise<number> {
    return this.dailyNewLimitMap.get(this.activePair) ?? DEFAULT_DAILY_NEW_LIMIT;
  }

  async setDailyNewLimit(limit: number): Promise<void> {
    this.dailyNewLimitMap.set(this.activePair, limit);
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

  // GAMES.md 3.5 (F0): Game fül tables, scoped to the active pair like every
  // other per-pair setting/state in this interface.
  private gameProgressMap: Map<string, Map<string, { state: string; data: unknown }>> = new Map();

  private gameKey(gameId: string) {
    return `${this.activePair}:${gameId}`;
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

  // PLAN-pcic 4. lépés: PCIC fül, SM-2, független a FSRS `cards`-tól. Nem
  // pair-hez kötött (a fül csak es→en tételekkel dolgozik), session-scoped
  // Map, mint a többi web-only állapot ebben a fájlban.
  private pcicCards: Map<string, Sm2Card> = new Map();

  async getPcicCards(): Promise<Sm2Card[]> {
    return [...this.pcicCards.values()].map(c => ({ ...c }));
  }

  async upsertPcicCard(card: Sm2Card): Promise<void> {
    this.pcicCards.set(card.itemId, { ...card });
  }

  async getPcicStats(today: string): Promise<{ total: number; newIntroducedToday: number; dueToday: number; learned: number }> {
    const cards = [...this.pcicCards.values()];
    return {
      total: cards.length,
      newIntroducedToday: cards.filter(c => c.introducedAt === today).length,
      dueToday: cards.filter(c => (c.state === 'review' || c.state === 'learning') && c.due <= today).length,
      learned: cards.filter(c => c.state === 'review' && c.interval >= 21).length,
    };
  }

  async resetPcicCards(levelPrefix?: string): Promise<void> {
    if (!levelPrefix) {
      this.pcicCards.clear();
      return;
    }
    for (const id of [...this.pcicCards.keys()]) {
      if (id.startsWith(`${levelPrefix}-`)) this.pcicCards.delete(id);
    }
  }

  // PLAN-play 10. lépés: a kiválasztott PCIC szint, memória-tükör (mint a
  // status-bar tint), alap B1, hogy egy meglévő telepítés progressze ("b1-...")
  // ne csússzon el.
  private pcicLevel: PcicLevel = 'B1';

  async getPcicLevel(): Promise<PcicLevel> {
    return this.pcicLevel;
  }

  async setPcicLevel(level: PcicLevel): Promise<void> {
    this.pcicLevel = level;
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
    const pcic_spelling_list = [...this.pcicSpellingList.entries()].map(([itemId, v]) => ({
      item_id: itemId,
      step: v.step,
      due: v.due,
    }));
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
        learn_settings,
        onboarding: this.onboarding ? [{ id: 1, ...this.onboarding }] : [],
        spelling_list,
        pcic_spelling_list,
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
    this.wordsOnlyMap = new Map();
    this.randomTopicsMap = new Map();
    this.feedbackBtnSideMap = new Map();
    for (const row of t.learn_settings) {
      if (row.words_only != null) this.wordsOnlyMap.set(row.pair, row.words_only === 1);
      if (row.random_topics != null) this.randomTopicsMap.set(row.pair, row.random_topics === 1);
      if (row.feedback_btn_side != null) this.feedbackBtnSideMap.set(row.pair, row.feedback_btn_side);
    }
    const ob = t.onboarding[0];
    // Corrected to the single supported pair if the backup carries an older
    // one (same rule as the app/_layout.tsx startup check).
    this.onboarding = ob
      ? (needsPairCorrection(ob) ? { ...FORCED_PAIR } : { source: ob.source, target: ob.target })
      : null;
    if (this.onboarding) this.activePair = `${this.onboarding.source}-${this.onboarding.target}`;
    this.spellingLists = new Map();
    for (const row of t.spelling_list) {
      this.spellingListFor(row.pair).set(row.word_id, { step: row.step, due: row.due });
    }
    // Play-vágás 12. lépés: a régi mentések nem ismerik ezt a táblát, `?? []`
    // az FB39-mintát követve visszatölthetővé teszi az új rész nélküli mentést.
    this.pcicSpellingList = new Map(
      (t.pcic_spelling_list ?? []).map((row: any) => [row.item_id, { step: row.step, due: row.due }])
    );
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
