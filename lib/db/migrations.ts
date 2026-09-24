import * as SQLite from 'expo-sqlite';
import { pickSurvivor } from '../cardMerge';
import { WORD_MERGES } from '../wordMerges';

// PLAN-play 14. lépés: a séma-létrehozás + minden ALTER/CREATE-migráció
// (korábban SQLiteDB.open() és SQLiteDB.applyWordMerges(), lib/database.ts),
// felelősség szerint ide kiemelve. Az osztály hívja induláskor; a SQL-sorrend
// és minden migrációs lépés változatlan, csak a hely és a `this` hivatkozások
// (`this.db` -> `db` paraméter, `this.activePair` -> helyi változó) módosultak.

// Migration: the duplicate cleanup (2026-08-07) removed the higher-level twin
// of words that were authored twice, so the progress on a deleted id moves to
// the surviving one. Idempotent: after the first run no merged id is left, and
// the probe below costs one indexed SELECT per app start. Spanish-target pairs
// only, the en/hu word tracks number their words on their own.
export async function applyWordMerges(db: SQLite.SQLiteDatabase) {
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

// Creates every table (if missing), runs each column/table migration, ensures
// the singleton user_meta row, resolves the active language pair from
// onboarding, and returns it so the caller (SQLiteDB.open()) can set
// this.activePair.
export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<string> {
  let activePair = 'es-hu';
  await db.execAsync(`
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
      repair_gap INTEGER,
      -- FB364 (PLAN-fb0923 5. lépés): a PCIC "rontott" (again) kártya ennyi
      -- másodperc múlva jön mindenképp vissza (lib/pcicSession.ts).
      again_delay_sec INTEGER
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
    CREATE TABLE IF NOT EXISTS pcic_spelling_list (
      item_id TEXT PRIMARY KEY,
      step INTEGER NOT NULL DEFAULT 0,
      due TEXT NOT NULL
    );
  `);
  // Migration: add random_topics column (DBs created before the random-topic toggle).
  try {
    await db.execAsync('ALTER TABLE learn_settings ADD COLUMN random_topics INTEGER');
  } catch {}
  // Migration: add strict_accents column (DBs created before the difficulty switches, FB132).
  try {
    await db.execAsync('ALTER TABLE learn_settings ADD COLUMN strict_accents INTEGER');
  } catch {}
  // Migration: add requeue_level column (DBs created before the difficulty dial, FB198).
  try {
    await db.execAsync('ALTER TABLE learn_settings ADD COLUMN requeue_level TEXT');
  } catch {}
  // Migration: add article_picker column (DBs created before the article chips, FB188).
  try {
    await db.execAsync('ALTER TABLE learn_settings ADD COLUMN article_picker INTEGER');
  } catch {}
  // Migration: add feedback_btn_side column (DBs created before the draggable feedback button, FB41).
  try {
    await db.execAsync('ALTER TABLE learn_settings ADD COLUMN feedback_btn_side TEXT');
  } catch {}
  // Migration: add weekly_goal_minutes column (DBs created before the weekly study goal, FB65).
  try {
    await db.execAsync('ALTER TABLE learn_settings ADD COLUMN weekly_goal_minutes INTEGER');
  } catch {}
  // Migration: last_open_date column (DBs created before the daily greeting, FB76).
  try {
    await db.execAsync('ALTER TABLE user_meta ADD COLUMN last_open_date TEXT');
  } catch {}
  // Migration: status-bar tint index (DBs created before the blue strip, FB83).
  try {
    await db.execAsync('ALTER TABLE user_meta ADD COLUMN status_bar_tint INTEGER');
  } catch {}
  // Migration: daily new-word budget columns (FB77). daily_new_limit is the
  // standing setting; new_bonus/new_bonus_date carry the "+5 new words" taps,
  // which only count while new_bonus_date is still today.
  try {
    await db.execAsync('ALTER TABLE learn_settings ADD COLUMN daily_new_limit INTEGER');
  } catch {}
  try {
    await db.execAsync('ALTER TABLE learn_settings ADD COLUMN new_bonus INTEGER');
  } catch {}
  try {
    await db.execAsync('ALTER TABLE learn_settings ADD COLUMN new_bonus_date TEXT');
  } catch {}
  // UTEMEZO 8: hand_cap (P) and gap_laps (R) columns (DBs created before the
  // difficulty window, which replaces the FB198 requeue_level dial).
  try {
    await db.execAsync('ALTER TABLE learn_settings ADD COLUMN hand_cap INTEGER');
  } catch {}
  try {
    await db.execAsync('ALTER TABLE learn_settings ADD COLUMN gap_laps INTEGER');
  } catch {}
  // UTEMEZO 4.7: repair_gap (R_javítás), a rontott lap külön, rövid rése.
  try {
    await db.execAsync('ALTER TABLE learn_settings ADD COLUMN repair_gap INTEGER');
  } catch {}
  // Migration: add again_delay_sec column (DBs created before the PCIC
  // "missed word comes back after N seconds" setting, FB364).
  try {
    await db.execAsync('ALTER TABLE learn_settings ADD COLUMN again_delay_sec INTEGER');
  } catch {}
  // Migration: pcic_cards.known column (DBs created before "Ezt nem tanulom", SZ3).
  try {
    await db.execAsync('ALTER TABLE pcic_cards ADD COLUMN known INTEGER');
  } catch {}
  // Migration: pcic_level column (DBs created before the A1-B2 level picker).
  try {
    await db.execAsync('ALTER TABLE user_meta ADD COLUMN pcic_level TEXT');
  } catch {}
  const meta = await db.getFirstAsync<any>('SELECT id FROM user_meta WHERE id = 1');
  if (!meta) {
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    await db.runAsync('INSERT INTO user_meta (id, user_id, first_use_date) VALUES (1, ?, ?)', [uuid, new Date().toISOString()]);
  }

  // Resolve the active pair from onboarding before running migrations.
  const ob = await db.getFirstAsync<any>('SELECT source, target FROM onboarding WHERE id = 1');
  if (ob) activePair = `${ob.source}-${ob.target}`;

  // Migration: add buried column (DBs created before the bury feature).
  const buriedCol = await db.getFirstAsync<any>("SELECT * FROM pragma_table_info('cards') WHERE name = 'buried'");
  if (!buriedCol) {
    await db.execAsync('ALTER TABLE cards ADD COLUMN buried INTEGER NOT NULL DEFAULT 0');
  }
  // Migration: add learned_at (FB210, the daily new-word budget counts learned
  // words). Cards that already finished the ladder are stamped with a date in
  // the PAST, not today: they were learned on some earlier day, and dating them
  // today would eat a whole day's budget at once on the first launch.
  const learnedAtCol = await db.getFirstAsync<any>("SELECT * FROM pragma_table_info('cards') WHERE name = 'learned_at'");
  if (!learnedAtCol) {
    await db.execAsync('ALTER TABLE cards ADD COLUMN learned_at TEXT');
    await db.runAsync(
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
  const cardsPairCol = await db.getFirstAsync<any>("SELECT * FROM pragma_table_info('cards') WHERE name = 'pair'");
  if (!cardsPairCol) {
    await db.execAsync(`
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
        SELECT word_id, type, '${activePair}', due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state, last_review, buried FROM cards;
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
  const lapCol = await db.getFirstAsync<any>("SELECT * FROM pragma_table_info('cards') WHERE name = 'lap'");
  if (!lapCol) {
    await db.execAsync(`
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
  await db.runAsync(
    "UPDATE cards SET lap = 3 WHERE type = 'word' AND state >= 2 AND lap < 3"
  );
  // Migration: UTEMEZO 2.2, started_at oszlop (DBs created before the daily
  // keret az 1. lap feljovetelekor fogy, nem a megtanuláskor).
  const startedAtCol = await db.getFirstAsync<any>("SELECT * FROM pragma_table_info('cards') WHERE name = 'started_at'");
  if (!startedAtCol) {
    await db.execAsync('ALTER TABLE cards ADD COLUMN started_at TEXT');
  }
  // Migration: per-pair user_level (old singleton id=1 → keyed by pair).
  const levelPairCol = await db.getFirstAsync<any>("SELECT * FROM pragma_table_info('user_level') WHERE name = 'pair'");
  if (!levelPairCol) {
    await db.execAsync(`
      CREATE TABLE user_level_new (
        pair TEXT PRIMARY KEY,
        level TEXT NOT NULL DEFAULT 'A0',
        correct_streak INTEGER NOT NULL DEFAULT 0,
        mistakes_in_window INTEGER NOT NULL DEFAULT 0,
        fail_streak INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO user_level_new (pair, level, correct_streak, mistakes_in_window, fail_streak)
        SELECT '${activePair}', level, correct_streak, mistakes_in_window, fail_streak FROM user_level WHERE id = 1;
      DROP TABLE user_level;
      ALTER TABLE user_level_new RENAME TO user_level;
    `);
  }
  // Migration: per-pair attempt history (FB129). Without it the daily new-word
  // counter was shared by every language pair, so a day spent on one course
  // left the other with a zero budget and an empty queue.
  const attemptsPairCol = await db.getFirstAsync<any>("SELECT * FROM pragma_table_info('card_attempts') WHERE name = 'pair'");
  if (!attemptsPairCol) {
    await db.execAsync('ALTER TABLE card_attempts ADD COLUMN pair TEXT');
    // Existing rows predate the column: a word that only ever had a card in one
    // pair is tagged with it, anything ambiguous falls back to the active pair.
    await db.runAsync(
      `UPDATE card_attempts SET pair = COALESCE(
         (SELECT MIN(c.pair) FROM cards c WHERE c.word_id = card_attempts.word_id AND c.type = card_attempts.type),
         ?
       ) WHERE pair IS NULL`,
      [activePair]
    );
  }
  await applyWordMerges(db);
  return activePair;
}
