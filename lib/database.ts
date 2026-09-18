import * as SQLite from 'expo-sqlite';
import { createEmptyCard, type Card } from 'ts-fsrs';
import { BACKUP_SCHEMA_VERSION, BACKUP_TABLES, getAppVersion, type BackupPayload } from './backup';
import { pickSurvivor } from './cardMerge';
import { rankSentencesByWordWeakness, sentenceSlotCount, type WordWeakness } from './sentenceMix';
import { WORD_MERGES } from './wordMerges';
import { LAPS, type Lap } from './lap';
import { localDateString, summarizeUsage, DEFAULT_WEEKLY_GOAL_MINUTES, DEFAULT_DAILY_NEW_LIMIT, type UsageStats } from './usageStats';
import type { Sm2Card } from './sm2';

export interface DB {
  ensureCard(wordId: number, type: string): Promise<void>;
  updateCard(wordId: number, type: string, card: Card): Promise<void>;
  // UTEMEZO 11. szakasz: a lap-állás (lib/lap.ts) a szó laponkénti haladása,
  // az FSRS-t nem érinti a 3 lap alatt.
  startWord(wordId: number): Promise<void>;
  passLap(wordId: number): Promise<Lap>;
  getInHandWordCards(): Promise<{ word_id: number; lap: Lap }[]>;
  // UTEMEZO 2.2: hány szó indult el ma (a napi keret ekkor fogy).
  getWordsStartedToday(): Promise<number>;
  // UTEMEZO 2.4/12.1: `wordIds`-ből az érintetlenek (a fresh-lista forrása).
  getUntouchedWordIds(wordIds: number[]): Promise<Set<number>>;
  getDueCards(limit: number): Promise<any[]>;
  getStreak(): Promise<{ current_count: number; last_date: string | null; longest_count: number }>;
  updateStreak(): Promise<void>;
  getOnboarding(): Promise<{ source: string; target: string } | null>;
  setOnboarding(source: string, target: string): Promise<void>;
  getLevel(): Promise<{ level: string; correct_streak: number; mistakes_in_window: number; fail_streak: number }>;
  updateLevel(level: string, correctStreak: number, mistakesInWindow: number, failStreak: number): Promise<void>;
  getDueCardsForLevel(level: string, limit: number): Promise<any[]>;
  getDueCardsForWordIds(wordIds: number[], limit: number): Promise<any[]>;
  // FB190: szabad gyakorlás, ha a szinten már nincs új szó. Esedékesség NÉLKÜL
  // ad vissza megkezdett szókártyákat, véletlen sorrendben.
  getPracticeCardsForLevel(level: string, limit: number): Promise<any[]>;
  // FB174: how many DISTINCT words are due for review in a given scope, whether or
  // not they fit in this session's queue. The header turns it into "one batch of N,
  // M batches to go".
  countDueReviewWords(wordIds: number[]): Promise<number>;
  countDueReviewWordsForLevel(level: string): Promise<number>;
  // FB225: a szint-szűrésen KÍVÜL esedékes, már megkezdett szó-kártyák. Ezek
  // tartják forgásban az előző szinteken tanult szavakat, lásd mergeCarryover.
  getDueCarryoverCards(excludeWordIds: number[], limit: number): Promise<any[]>;
  countDueCarryoverWords(excludeWordIds: number[]): Promise<number>;
  getWordReps(wordIds: number[]): Promise<Map<number, number>>;
  getWordStates(wordIds: number[]): Promise<Map<number, number>>;
  // GAMES.md 3.1 (F0): every non-buried word card of a given pair, for
  // lib/games/vocabPool.ts. Unlike its siblings above this takes an explicit
  // `pair` (matches the GAMES.md spec text) rather than using `activePair`,
  // so a game can in principle read a pool for a pair other than the one
  // currently active.
  getAllWordCards(pair: string): Promise<{ word_id: number; reps: number; lapses: number; state: number; buried: 0 | 1; lap: Lap; in_hand: 0 | 1 }[]>;
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
  // FB293/294: "I know this" a SZORA vonatkozik, nem egy lap-tipusra.
  buryWord(wordId: number): Promise<void>;
  snoozeCard(wordId: number, type: string, days: number): Promise<void>;
  addToSpellingList(wordId: number): Promise<void>;
  removeFromSpellingList(wordId: number): Promise<void>;
  getSpellingList(): Promise<{ wordId: number; step: number; due: string }[]>;
  getSpellingDueCount(): Promise<number>;
  // FB186: a lista TELJES mérete, hogy a Beállítások sora meg tudja mondani,
  // a szám esedékes gyakorlás-e vagy összesen ennyi szó van a listán.
  getSpellingListCount(): Promise<number>;
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
  // FB188: a névelő-gombsor a gépelős spanyol főnév-kártyán, ki-be kapcsolható.
  getArticlePicker(): Promise<boolean>;
  setArticlePicker(v: boolean): Promise<void>;
  // UTEMEZO 8: a „Nehézség" ablak beállításai. P (3.1) és R (4.2) a
  // requeue_level tárcsát (FB198) váltja fel, lásd getGapLaps; R_javítás (4.7)
  // a rontott lap külön rése.
  getHandCap(): Promise<number>;
  setHandCap(n: number): Promise<void>;
  getGapLaps(): Promise<number>;
  setGapLaps(n: number): Promise<void>;
  getRepairGap(): Promise<number>;
  setRepairGap(n: number): Promise<void>;
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
  getWordsLearnedToday(): Promise<number>;
  addUsageMinute(): Promise<number>;
  getUsageStats(): Promise<UsageStats>;
  getDayStats(date: string): Promise<{ minutes: number; words: number }>;
  // GAMES.md 3.5 (F0): Game fül tables, scoped to the active pair like every
  // other per-pair setting/state in this interface.
  getGameScore(gameId: string): Promise<{ bestScore: number; bestAt: string | null; plays: number; lastPlayed: string | null } | null>;
  recordGameScore(gameId: string, score: number): Promise<{ isNewBest: boolean; best: number }>;
  getGameSettings(gameId: string): Promise<Record<string, unknown> | null>;
  setGameSettings(gameId: string, settings: Record<string, unknown>): Promise<void>;
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
      CREATE TABLE IF NOT EXISTS selected_topic (
        pair TEXT PRIMARY KEY,
        topic_id TEXT
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
      CREATE TABLE IF NOT EXISTS game_scores (
        pair TEXT NOT NULL,
        game_id TEXT NOT NULL,
        best_score INTEGER NOT NULL DEFAULT 0,
        best_at TEXT,
        plays INTEGER NOT NULL DEFAULT 0,
        last_played TEXT,
        PRIMARY KEY (pair, game_id)
      );
      CREATE TABLE IF NOT EXISTS game_settings (
        pair TEXT NOT NULL,
        game_id TEXT NOT NULL,
        settings_json TEXT NOT NULL,
        PRIMARY KEY (pair, game_id)
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
        introduced_at TEXT
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

  // UTEMEZO 11. szakasz: a szó 1. lapja most jött fel, kézbe kerül. Idempotens
  // (egy már kézben lévő vagy megtanult szón nem csinál semmit). UTEMEZO 2.2: a
  // started_at ekkor kap értéket, a napi keret fekete száma ekkor fogy.
  async startWord(wordId: number): Promise<void> {
    await this.ensureCard(wordId, 'word');
    const db = await this.open();
    await db.runAsync(
      "UPDATE cards SET in_hand = 1, started_at = COALESCE(started_at, ?) WHERE word_id = ? AND type = 'word' AND pair = ? AND lap < 3",
      [new Date().toISOString(), wordId, this.activePair]
    );
  }

  // UTEMEZO 3.3/3.4: helyes válasz lépteti a lapot; a 3. lap helyes válasza
  // után a szó megtanult, kikerül a kézből, és csak EKKOR kap FSRS-értékelést
  // (learned_at), a "csak egyszer" szabállyal (COALESCE, lásd fent).
  async passLap(wordId: number): Promise<Lap> {
    const db = await this.open();
    await db.runAsync(
      "UPDATE cards SET lap = MIN(3, lap + 1) WHERE word_id = ? AND type = 'word' AND pair = ?",
      [wordId, this.activePair]
    );
    const row = await db.getFirstAsync<any>(
      "SELECT lap FROM cards WHERE word_id = ? AND type = 'word' AND pair = ?",
      [wordId, this.activePair]
    );
    const lap = (row?.lap ?? 0) as Lap;
    if (lap >= LAPS) {
      await db.runAsync(
        "UPDATE cards SET in_hand = 0, learned_at = COALESCE(learned_at, ?) WHERE word_id = ? AND type = 'word' AND pair = ?",
        [new Date().toISOString(), wordId, this.activePair]
      );
    }
    return lap;
  }

  async getInHandWordCards(): Promise<{ word_id: number; lap: Lap }[]> {
    const db = await this.open();
    const rows = await db.getAllAsync<any>(
      "SELECT word_id, lap FROM cards WHERE type = 'word' AND pair = ? AND in_hand = 1 AND buried = 0 ORDER BY id",
      [this.activePair]
    );
    return rows.map((r: any) => ({ word_id: r.word_id, lap: r.lap as Lap }));
  }

  // UTEMEZO 2.2: hány szó indult el ma (a napi keret fekete száma ebből fogy,
  // ugyanaz az idióma, mint getWordsLearnedToday, csak started_at-ra).
  async getWordsStartedToday(): Promise<number> {
    const db = await this.open();
    const rows = await db.getAllAsync<any>(
      "SELECT started_at FROM cards WHERE type = 'word' AND pair = ? AND started_at IS NOT NULL",
      [this.activePair]
    );
    const today = localDateString();
    return rows.filter((r) => localDateString(new Date(r.started_at)) === today).length;
  }

  // UTEMEZO 2.4/12.1: `wordIds`-ből azok, amiket a szó még ÉRINTETLEN (lap = 0,
  // nincs kézben, nincs eltemetve), vagy amiknek meg sincs szó-kártyája (a hívó
  // ilyet a fresh-listába szánhat, meg sem kellett még nyitni ensureCard-dal).
  async getUntouchedWordIds(wordIds: number[]): Promise<Set<number>> {
    const db = await this.open();
    if (wordIds.length === 0) return new Set();
    const placeholders = wordIds.map(() => '?').join(',');
    const rows = await db.getAllAsync<any>(
      `SELECT word_id, lap, in_hand, buried FROM cards WHERE word_id IN (${placeholders}) AND type = 'word' AND pair = ?`,
      [...wordIds, this.activePair]
    );
    // Egy id "erintett", ha VAN sora, es az a sor NEM erintetlen; minden mas
    // id (nincs sora, vagy van, de meg semmit sem lattunk belole) erintetlen.
    const touched = new Set(
      rows.filter((r: any) => !(r.lap === 0 && r.in_hand === 0 && r.buried === 0)).map((r: any) => r.word_id)
    );
    return new Set(wordIds.filter((id) => !touched.has(id)));
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

  // FB174: same window as the review half of getDueCardsForWordIds (UTEMEZO 11.
  // szakasz: lap >= 3 AND in_hand = 0, azaz MEGTANULT szó, a ten-minute
  // lookahead), counted over words instead of cards, and unlimited.
  async countDueReviewWords(wordIds: number[]) {
    const db = await this.open();
    if (wordIds.length === 0) return 0;
    const placeholders = wordIds.map(() => '?').join(',');
    const lookahead = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const row = await db.getFirstAsync<any>(
      `SELECT COUNT(DISTINCT word_id) AS n FROM cards WHERE word_id IN (${placeholders}) AND type = 'word' AND lap >= 3 AND in_hand = 0 AND buried = 0 AND pair = ? AND due <= ?`,
      [...wordIds, this.activePair, lookahead]
    );
    return row?.n ?? 0;
  }

  async countDueReviewWordsForLevel(level: string) {
    const { getWordsForLevel } = require('@/data/words');
    const levelWords = getWordsForLevel(level, this.activePair.split('-')[1]);
    return this.countDueReviewWords(levelWords.map((w: any) => w.id));
  }

  // FB225, Kálmán 2026-09-10: az ismétlés átjár a szintek között. Egy A1-en
  // megkezdett szó A2-n is esedékes marad, csak a sor addig nem látta, mert a
  // szint (vagy az aktív téma) szavaira volt szűkítve.
  //
  // A szűrés szándékosan NEM szintre megy, hanem a hívó által már besorolt
  // `excludeWordIds`-ra: ami ezen kívül esik és meg van kezdve (UTEMEZO 11.
  // szakasz: lap >= 3 AND in_hand = 0, azaz MEGTANULT), az definíció szerint
  // korábbi tanulás, akármelyik szinten történt. Így a lekérdezés nem függ a
  // szint-sorrendtől, és nem kell hozzá több ezer elemű IN-lista sem
  // (SQLITE_LIMIT_VARIABLE_NUMBER).
  //
  // Szó-kártyánként egy sor létezik (ensureCard), ezért a
  // `limit + excludeWordIds.length` beolvasás garantáltan hoz `limit` darab
  // kizáráson kívüli sort, ha egyáltalán van annyi.
  async getDueCarryoverCards(excludeWordIds: number[], limit: number) {
    const db = await this.open();
    if (limit <= 0) return [];
    const lookahead = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM cards WHERE type = 'word' AND lap >= 3 AND in_hand = 0 AND buried = 0 AND pair = ? AND due <= ? ORDER BY due ASC LIMIT ?`,
      [this.activePair, lookahead, limit + excludeWordIds.length]
    );
    const excluded = new Set(excludeWordIds);
    return rows.filter((r: any) => !excluded.has(r.word_id)).slice(0, limit);
  }

  // A 🔁 jelvény ugyanazt az ablakot számolja, mint countDueReviewWords, csak a
  // kizáráson kívüli szavakra: a jelvény így a teljes esedékes halmazt mutatja,
  // nem csak az aktuális szintét.
  async countDueCarryoverWords(excludeWordIds: number[]) {
    const db = await this.open();
    const lookahead = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const rows = await db.getAllAsync<any>(
      `SELECT DISTINCT word_id FROM cards WHERE type = 'word' AND lap >= 3 AND in_hand = 0 AND buried = 0 AND pair = ? AND due <= ?`,
      [this.activePair, lookahead]
    );
    const excluded = new Set(excludeWordIds);
    return rows.filter((r: any) => !excluded.has(r.word_id)).length;
  }

  // FB190, Kálmán 2026-09-08: „ha már nincs új szó a szinten akkor kérdezze meg
  // hogy a szint szavait akarod gyakorolni és random adjon 32 szót a szintből".
  // Ez szándékosan MEGKERÜLI az esedékességet: nem SRS-kör, hanem szabad
  // gyakorlás, ezért nem is ír ütemezést (a válaszok a szokásos úton értékelődnek).
  async getPracticeCardsForLevel(level: string, limit: number) {
    const { getWordsForLevel } = require('@/data/words');
    const db = await this.open();
    const ids = getWordsForLevel(level as any, this.activePair.split('-')[1] ?? 'es').map((w: any) => w.id);
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    return await db.getAllAsync(
      `SELECT * FROM cards WHERE word_id IN (${placeholders}) AND type = 'word' AND lap >= 3 AND in_hand = 0 AND buried = 0 AND pair = ? ORDER BY RANDOM() LIMIT ?`,
      [...ids, this.activePair, limit]
    );
  }

  // UTEMEZO 11. szakasz: ez a lekérdezés csak ISMÉTLÉST ad (megtanult szó,
  // lap >= 3 AND in_hand = 0) plusz a hozzájuk tartozó mondat-kártyákat. Az
  // érintetlen és a kézben lévő szavak az ütemező `fresh`/`hand` listáján
  // jönnek, nem ezen a lekérdezésen (lásd a Learn tab loadCards-ját).
  async getDueCardsForWordIds(wordIds: number[], limit: number) {
    const db = await this.open();
    if (wordIds.length === 0) return [];
    const placeholders = wordIds.map(() => '?').join(',');
    const lookahead = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const reviewWords = await db.getAllAsync(
      `SELECT * FROM cards WHERE word_id IN (${placeholders}) AND type = 'word' AND lap >= 3 AND in_hand = 0 AND buried = 0 AND pair = ? AND due <= ? ORDER BY due ASC LIMIT ?`,
      [...wordIds, this.activePair, lookahead, limit]
    );

    const reviewedWordIds = await db.getAllAsync<any>(
      `SELECT DISTINCT word_id FROM cards WHERE word_id IN (${placeholders}) AND type = 'word' AND pair = ? AND (lap >= 3 OR buried = 1)`,
      [...wordIds, this.activePair]
    );
    const reviewedSet = new Set(reviewedWordIds.map((r: any) => r.word_id));

    // FB89: sentences only ever support the words in this session, so their count
    // follows the 4:1 cadence, and the slots go to the words with the most lapses.
    const sentenceSlots = sentenceSlotCount((reviewWords as any[]).length);
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

    return [...reviewWords, ...sentenceCards];
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

  // "Ismert" jelző (1/0) szavanként, UTEMEZO 12/4: EGY definíció a
  // Stats-kártyával (lap >= 3 OR buried, lásd getMasteredWordCount), nem FSRS
  // Review-állapot. A topic-készültség ebből dől el, nem a reps-ből, lásd
  // lib/topicMastery.ts.
  async getWordStates(wordIds: number[]): Promise<Map<number, number>> {
    const db = await this.open();
    if (wordIds.length === 0) return new Map();
    const placeholders = wordIds.map(() => '?').join(',');
    const rows = await db.getAllAsync<any>(
      `SELECT word_id, CASE WHEN lap >= 3 OR buried = 1 THEN 1 ELSE 0 END AS known
         FROM cards WHERE word_id IN (${placeholders}) AND type = 'word' AND pair = ?`,
      [...wordIds, this.activePair]
    );
    const map = new Map<number, number>();
    for (const r of rows) map.set(r.word_id, r.known);
    return map;
  }

  // GAMES.md 3.1 (F0): every non-buried word card of `pair`, for vocabPool.ts.
  // FB162 follow-up (Kálmán, 2026-08-28): "kerüljön be de ne azokat priorizálja".
  // Buried ("I know this") words used to be dropped here, so the header could say
  // "20 known words" while the Game tab said "1 word so far, 19 more needed" and
  // kept every game locked. They come back WITH the flag, and the pool orders
  // them last (lib/games/vocabPool.ts).
  async getAllWordCards(pair: string) {
    const db = await this.open();
    const rows = await db.getAllAsync<any>(
      "SELECT word_id, reps, lapses, state, buried, lap, in_hand FROM cards WHERE type = 'word' AND pair = ?",
      [pair]
    );
    return rows.map((r: any) => ({
      word_id: r.word_id, reps: r.reps, lapses: r.lapses, state: r.state,
      buried: (r.buried ? 1 : 0) as 0 | 1, lap: r.lap as Lap, in_hand: (r.in_hand ? 1 : 0) as 0 | 1,
    }));
  }

  async recordAttempt(wordId: number, type: string, correct: boolean, responseTimeMs: number) {
    const db = await this.open();
    await db.runAsync(
      'INSERT INTO card_attempts (word_id, type, pair, correct, response_time_ms, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      [wordId, type, this.activePair, correct ? 1 : 0, responseTimeMs, new Date().toISOString()]
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
    const { findWordById } = require('@/data/words');
    const onboarding = await this.getOnboarding();
    const lang = onboarding?.target ?? 'es';
    return rows.map((r: any) => {
      const w = findWordById(r.word_id, lang);
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
      // UTEMEZO 1. szakasz: megtanult = a 3. lap egyszer helyes volt. "I know
      // this" (buried) still counts outright.
      `SELECT COUNT(*) as cnt FROM cards
         WHERE word_id IN (${placeholders}) AND type = 'word' AND pair = ?
           AND (lap >= 3 OR buried = 1)`,
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

  async buryCard(wordId: number, type: string) {
    const db = await this.open();
    // UTEMEZO 11. szakasz: egy elásott szó kikerül a kézből is.
    await db.runAsync('UPDATE cards SET buried = 1, in_hand = 0 WHERE word_id = ? AND type = ? AND pair = ?', [wordId, type, this.activePair]);
  }

  // FB293/294: "I know this" a SZORA vonatkozik, nem egy lap-tipusra (mint a
  // buryCard): a szó MINDEN meglévő kártya-típus-sorát temeti.
  async buryWord(wordId: number) {
    const db = await this.open();
    await db.runAsync('UPDATE cards SET buried = 1, in_hand = 0 WHERE word_id = ? AND pair = ?', [wordId, this.activePair]);
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

  // UTEMEZO 8/3.1: P, hány szó lehet egyszerre kézben. Tartomány 1-10, alap 5.
  async getHandCap(): Promise<number> {
    const db = await this.open();
    const row = await db.getFirstAsync<any>('SELECT hand_cap FROM learn_settings WHERE pair = ?', [this.activePair]);
    const v = typeof row?.hand_cap === 'number' ? row.hand_cap : 5;
    return Math.min(10, Math.max(1, v));
  }

  async setHandCap(n: number): Promise<void> {
    const db = await this.open();
    await db.runAsync(
      'INSERT INTO learn_settings (pair, hand_cap) VALUES (?, ?) ON CONFLICT(pair) DO UPDATE SET hand_cap = excluded.hand_cap',
      [this.activePair, Math.min(10, Math.max(1, n))]
    );
  }

  // UTEMEZO 8/4.2: R, hány lap teljen el, mielőtt egy elrontott szó visszajön.
  // Tartomány 1-30, alap 5. Régen a FB198-tárcsa (easy/normal/hard, lásd a
  // requeue_level oszlopot) adta ugyanezt a távolságot; ha gap_laps még üres,
  // de requeue_level be volt állítva, a régi fokozat számértékét vesszük át,
  // és el is mentjük, hogy legközelebb már sima olvasás legyen.
  async getGapLaps(): Promise<number> {
    const db = await this.open();
    const row = await db.getFirstAsync<any>('SELECT gap_laps, requeue_level FROM learn_settings WHERE pair = ?', [this.activePair]);
    if (typeof row?.gap_laps === 'number') return Math.min(30, Math.max(1, row.gap_laps));
    if (row?.requeue_level) {
      const carryOver: Record<string, number> = { easy: 5, normal: 12, hard: 25 };
      const carried = carryOver[row.requeue_level] ?? 5;
      await this.setGapLaps(carried);
      return carried;
    }
    return 5;
  }

  async setGapLaps(n: number): Promise<void> {
    const db = await this.open();
    await db.runAsync(
      'INSERT INTO learn_settings (pair, gap_laps) VALUES (?, ?) ON CONFLICT(pair) DO UPDATE SET gap_laps = excluded.gap_laps',
      [this.activePair, Math.min(30, Math.max(1, n))]
    );
  }

  // UTEMEZO 4.7: R_javítás, hány lap teljen el, mielőtt egy rontott kézben lévő
  // lap visszajön. Tartomány 1-10, alap 2. A sor ezt R-re vágja: a javítás-rés
  // sosem nagyobb a sima résnél.
  async getRepairGap(): Promise<number> {
    const db = await this.open();
    const row = await db.getFirstAsync<any>('SELECT repair_gap FROM learn_settings WHERE pair = ?', [this.activePair]);
    const v = typeof row?.repair_gap === 'number' ? row.repair_gap : 2;
    return Math.min(10, Math.max(1, v));
  }

  async setRepairGap(n: number): Promise<void> {
    const db = await this.open();
    await db.runAsync(
      'INSERT INTO learn_settings (pair, repair_gap) VALUES (?, ?) ON CONFLICT(pair) DO UPDATE SET repair_gap = excluded.repair_gap',
      [this.activePair, Math.min(10, Math.max(1, n))]
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

  // A word counts as "started today" when its FIRST attempt IN THIS PAIR happened
  // today. FB129: counting across pairs meant a day spent on one course left the
  // other course with a zero budget, i.e. an empty queue and the Done screen.
  async getNewWordsToday(): Promise<number> {
    const db = await this.open();
    const rows = await db.getAllAsync<any>(
      "SELECT word_id, MIN(timestamp) AS first_ts FROM card_attempts WHERE type = 'word' AND pair = ? GROUP BY word_id",
      [this.activePair]
    );
    const today = localDateString();
    return rows.filter(r => localDateString(new Date(r.first_ts)) === today).length;
  }

  // FB103: words already started but not yet learned. They are the "congestion"
  // the learner sees, so the new-word budget waits for them (see
  // newWordAllowance). UTEMEZO 11. szakasz: ez most a "kézben lévő" szavak
  // száma, a tárolt `in_hand` jelzőből, nem az FSRS-ből származtatva.
  async getUnlearnedWordCount(): Promise<number> {
    const db = await this.open();
    const row = await db.getFirstAsync<any>(
      `SELECT COUNT(*) as cnt FROM cards WHERE type = 'word' AND pair = ? AND buried = 0
         AND in_hand = 1`,
      [this.activePair]
    );
    return row?.cnt ?? 0;
  }

  // FB210: a 🌱 napi keretet ez fogyasztja, tehát a szám akkor csökken, amikor egy
  // szót tényleg meg is tanult (le tudta írni helyesen), nem amikor először látta.
  async getWordsLearnedToday(): Promise<number> {
    const db = await this.open();
    const rows = await db.getAllAsync<any>(
      "SELECT learned_at FROM cards WHERE type = 'word' AND pair = ? AND learned_at IS NOT NULL",
      [this.activePair]
    );
    const today = localDateString();
    return rows.filter((r) => localDateString(new Date(r.learned_at)) === today).length;
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

  // GAMES.md 3.5 (F0): Game fül rekord/beállítás/haladás táblák.
  async getGameScore(gameId: string) {
    const db = await this.open();
    const row = await db.getFirstAsync<any>(
      'SELECT best_score, best_at, plays, last_played FROM game_scores WHERE pair = ? AND game_id = ?',
      [this.activePair, gameId]
    );
    if (!row) return null;
    return { bestScore: row.best_score, bestAt: row.best_at, plays: row.plays, lastPlayed: row.last_played };
  }

  async recordGameScore(gameId: string, score: number) {
    const db = await this.open();
    const now = new Date().toISOString();
    const existing = await db.getFirstAsync<any>(
      'SELECT best_score, best_at, plays FROM game_scores WHERE pair = ? AND game_id = ?',
      [this.activePair, gameId]
    );
    const prevBest = existing?.best_score ?? 0;
    const isNewBest = score > prevBest;
    const best = isNewBest ? score : prevBest;
    const bestAt = isNewBest ? now : (existing?.best_at ?? now);
    const plays = (existing?.plays ?? 0) + 1;
    await db.runAsync(
      `INSERT INTO game_scores (pair, game_id, best_score, best_at, plays, last_played)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(pair, game_id) DO UPDATE SET
         best_score = excluded.best_score, best_at = excluded.best_at,
         plays = excluded.plays, last_played = excluded.last_played`,
      [this.activePair, gameId, best, bestAt, plays, now]
    );
    return { isNewBest, best };
  }

  async getGameSettings(gameId: string) {
    const db = await this.open();
    const row = await db.getFirstAsync<any>(
      'SELECT settings_json FROM game_settings WHERE pair = ? AND game_id = ?',
      [this.activePair, gameId]
    );
    if (!row?.settings_json) return null;
    try {
      return JSON.parse(row.settings_json);
    } catch {
      return null;
    }
  }

  async setGameSettings(gameId: string, settings: Record<string, unknown>) {
    const db = await this.open();
    await db.runAsync(
      `INSERT INTO game_settings (pair, game_id, settings_json) VALUES (?, ?, ?)
       ON CONFLICT(pair, game_id) DO UPDATE SET settings_json = excluded.settings_json`,
      [this.activePair, gameId, JSON.stringify(settings)]
    );
  }

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
    }));
  }

  async upsertPcicCard(card: Sm2Card): Promise<void> {
    const db = await this.open();
    await db.runAsync(
      `INSERT INTO pcic_cards (item_id, state, step, ease, interval, reps, lapses, due, last_review, introduced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(item_id) DO UPDATE SET
         state = excluded.state, step = excluded.step, ease = excluded.ease,
         interval = excluded.interval, reps = excluded.reps, lapses = excluded.lapses,
         due = excluded.due, last_review = excluded.last_review, introduced_at = excluded.introduced_at`,
      [card.itemId, card.state, card.step, card.ease, card.interval, card.reps, card.lapses, card.due, card.lastReview, card.introducedAt]
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
