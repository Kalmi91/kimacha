import * as SQLite from 'expo-sqlite';

// the schema creation + every ALTER/CREATE migration
// (formerly SQLiteDB.open(), lib/database.ts),
// moved out here by responsibility. The class calls it at startup; the SQL order
// and every migration step are unchanged, only the location and the `this` references
// (`this.db` -> `db` parameter, `this.activePair` -> local variable) changed.

// Migration: SRS rows of the retired PCIC / Spanish word-list decks ("a1-<hash>" ... "b2-<hash>",
// "w<n>") match no card of the current decks (o<n> / e<n> ids), they would only linger in
// pcic_cards. The old id-remap migrations that carried them over are gone (pre-4.1 backups are
// not restored). Idempotent: from the second run the SELECT finds nothing to delete.
const LEGACY_PCIC_ID = /^(?:[a-c][0-9]-|w[0-9])/;

export function isLegacyPcicId(id: string): boolean {
  return LEGACY_PCIC_ID.test(id);
}

export async function dropLegacyPcicRows(db: SQLite.SQLiteDatabase) {
  const rows = await db.getAllAsync<{ item_id: string }>('SELECT item_id FROM pcic_cards');
  const legacy = rows.map((r) => r.item_id).filter(isLegacyPcicId);
  for (let i = 0; i < legacy.length; i += 500) {
    const chunk = legacy.slice(i, i + 500);
    await db.runAsync(`DELETE FROM pcic_cards WHERE item_id IN (${chunk.map(() => '?').join(',')})`, chunk);
  }
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
      status_bar_tint INTEGER,
      grammar_palette TEXT,
      skin TEXT,
      skin_mix TEXT
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
      again_delay_sec INTEGER,
      -- PLAN-ketiranyu 4. lépés javítás: a PCIC szint (A1-B2) párhoz kötve,
      -- hogy en-es és es-en külön szintet őrizzen (a user_meta szingliton
      -- oszlopból ide költözött, lásd a lenti ALTER-migráció régi DB-khez).
      pcic_level TEXT
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
    -- PLAN-hibaim.md 2. lépés: a betöltött "Hibáim" kötegek (a validált JSON,
    -- teljes egészében) és a hozzájuk tartozó SM-2 haladás, a pcic_cards
    -- oszlopaival, de saját táblában, hogy a PCIC-statisztikát ne szennyezze.
    CREATE TABLE IF NOT EXISTS mistake_batches (
      batch_id TEXT PRIMARY KEY,
      json TEXT NOT NULL,
      imported_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mistake_cards (
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
  `);
  // Migration: add random_topics column (DBs created before the random-topic toggle).
  try {
    await db.execAsync('ALTER TABLE learn_settings ADD COLUMN random_topics INTEGER');
  } catch {}
  // Migration: add strict_accents column (DBs created before the difficulty switches).
  try {
    await db.execAsync('ALTER TABLE learn_settings ADD COLUMN strict_accents INTEGER');
  } catch {}
  // Migration: add requeue_level column (DBs created before the difficulty dial).
  try {
    await db.execAsync('ALTER TABLE learn_settings ADD COLUMN requeue_level TEXT');
  } catch {}
  // Migration: add article_picker column (DBs created before the article chips).
  try {
    await db.execAsync('ALTER TABLE learn_settings ADD COLUMN article_picker INTEGER');
  } catch {}
  // Migration: add feedback_btn_side column (DBs created before the draggable feedback button).
  try {
    await db.execAsync('ALTER TABLE learn_settings ADD COLUMN feedback_btn_side TEXT');
  } catch {}
  // Migration: add weekly_goal_minutes column (DBs created before the weekly study goal).
  try {
    await db.execAsync('ALTER TABLE learn_settings ADD COLUMN weekly_goal_minutes INTEGER');
  } catch {}
  // Migration: last_open_date column (DBs created before the daily greeting).
  try {
    await db.execAsync('ALTER TABLE user_meta ADD COLUMN last_open_date TEXT');
  } catch {}
  // Migration: status-bar tint index (DBs created before the blue strip).
  try {
    await db.execAsync('ALTER TABLE user_meta ADD COLUMN status_bar_tint INTEGER');
  } catch {}
  // Migration: app-wide color palette id (DBs created before the neon UI).
  try {
    await db.execAsync('ALTER TABLE user_meta ADD COLUMN grammar_palette TEXT');
  } catch {}
  // Migration: chosen theme + "My mix" JSON (DBs created before the theme engine).
  try {
    await db.execAsync('ALTER TABLE user_meta ADD COLUMN skin TEXT');
  } catch {}
  try {
    await db.execAsync('ALTER TABLE user_meta ADD COLUMN skin_mix TEXT');
  } catch {}
  // Migration: daily new-word budget columns. daily_new_limit is the
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
  // hand_cap (P) and gap_laps (R) columns (DBs created before the
  // difficulty window, which replaces the requeue_level dial).
  try {
    await db.execAsync('ALTER TABLE learn_settings ADD COLUMN hand_cap INTEGER');
  } catch {}
  try {
    await db.execAsync('ALTER TABLE learn_settings ADD COLUMN gap_laps INTEGER');
  } catch {}
  // repair_gap, the separate, short gap of a missed card.
  try {
    await db.execAsync('ALTER TABLE learn_settings ADD COLUMN repair_gap INTEGER');
  } catch {}
  // Migration: add again_delay_sec column (DBs created before the PCIC
  // "missed word comes back after N seconds" setting).
  try {
    await db.execAsync('ALTER TABLE learn_settings ADD COLUMN again_delay_sec INTEGER');
  } catch {}
  // Migration: pcic_cards.known column (DBs created before "Don't learn this").
  try {
    await db.execAsync('ALTER TABLE pcic_cards ADD COLUMN known INTEGER');
  } catch {}
  // Migration: pcic_level column (DBs created before the A1-B2 level picker).
  try {
    await db.execAsync('ALTER TABLE user_meta ADD COLUMN pcic_level TEXT');
  } catch {}
  const meta = await db.getFirstAsync<any>('SELECT id FROM user_meta WHERE id = 1');
  if (!meta) {
    // user_id is NOT NULL but nothing reads it (the analytics that sent it are gone),
    // so a new install gets an empty value, not a persistent random identifier.
    await db.runAsync('INSERT INTO user_meta (id, user_id, first_use_date) VALUES (1, ?, ?)', ['', new Date().toISOString()]);
  }

  // Resolve the active pair from onboarding before running migrations.
  const ob = await db.getFirstAsync<any>('SELECT source, target FROM onboarding WHERE id = 1');
  if (ob) activePair = `${ob.source}-${ob.target}`;

  // Migration: pcic_level moves from the
  // user_meta singleton column into the per-pair row of learn_settings,
  // so that the two directions (en-es / es-en) keep separate levels
  // from each other. The old value always belonged to the en-es pair (the only
  // pair that existed until then); COALESCE only fills it in if the
  // learn_settings side has nothing yet (it does not overwrite a level chosen
  // later), so the migration is safe to run on every startup.
  try {
    await db.execAsync('ALTER TABLE learn_settings ADD COLUMN pcic_level TEXT');
  } catch {}
  const oldMeta = await db.getFirstAsync<any>('SELECT pcic_level FROM user_meta WHERE id = 1');
  if (oldMeta?.pcic_level) {
    await db.runAsync(
      `INSERT INTO learn_settings (pair, pcic_level) VALUES ('en-es', ?)
       ON CONFLICT(pair) DO UPDATE SET pcic_level = COALESCE(learn_settings.pcic_level, excluded.pcic_level)`,
      [oldMeta.pcic_level]
    );
  }

  // Migration: add buried column (DBs created before the bury feature).
  const buriedCol = await db.getFirstAsync<any>("SELECT * FROM pragma_table_info('cards') WHERE name = 'buried'");
  if (!buriedCol) {
    await db.execAsync('ALTER TABLE cards ADD COLUMN buried INTEGER NOT NULL DEFAULT 0');
  }
  // Migration: add learned_at (the daily new-word budget counts learned
  // words). Cards that already finished the ladder are stamped with a date in
  // the PAST, not today: they were learned on some earlier day, and dating them
  // today would eat a whole day's budget at once on the first launch.
  const learnedAtCol = await db.getFirstAsync<any>("SELECT * FROM pragma_table_info('cards') WHERE name = 'learned_at'");
  if (!learnedAtCol) {
    await db.execAsync('ALTER TABLE cards ADD COLUMN learned_at TEXT');
    await db.runAsync(
      // COALESCE wrote TODAY's review date, so on the first launch after the
      // update today's limit was used up immediately ("it says 0").
      // The old cards ALWAYS go into the past, as the comment above promises.
      // The literal 3 here is a historical migration value: the
      // LEARNED_PASSES constant is gone, this is the last place where the old
      // reps−lapses derivation occurs.
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
  // Migration: deliberately placed AFTER the pair-rebuild: the
  // rebuild copies the old (lap-less) table, this block adds the
  // columns and backfills them. The lap state used to be derived from the reps−lapses
  // difference (lib/wordPhase.ts), this is the last place
  // where that derivation occurs: a one-off backfill for rows created
  // before the spec, after which the `lap`/`in_hand` fields are the source of truth.
  const lapCol = await db.getFirstAsync<any>("SELECT * FROM pragma_table_info('cards') WHERE name = 'lap'");
  if (!lapCol) {
    await db.execAsync(`
      ALTER TABLE cards ADD COLUMN lap INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE cards ADD COLUMN in_hand INTEGER NOT NULL DEFAULT 0;
      UPDATE cards SET lap = MIN(3, MAX(0, reps - lapses)) WHERE type = 'word';
      UPDATE cards SET in_hand = 1 WHERE type = 'word' AND buried = 0 AND reps > 0 AND lap < 3;
    `);
  }
  // Migration: one definition of "known". The tree
  // tile and the topic completion used to look at the FSRS Review state (state >= 2), the
  // Stats card at the lap column above (lap >= 3 OR buried); that is how the
  // level could read 928/931 while a topic read 0/10. From now on both look
  // at the lap column (lib/topicMastery.ts), but the reps-lapses backfill above does not
  // find a word that FSRS already considers Review, because it may have entered Review
  // before the typing (3rd) lap. Idempotent (the WHERE is empty from the second
  // run), it runs on every startup.
  // A pure-JS mirror of the condition + its test: lib/lap.ts needsReviewLapBackfill.
  await db.runAsync(
    "UPDATE cards SET lap = 3 WHERE type = 'word' AND state >= 2 AND lap < 3"
  );
  // Migration: started_at column (DBs created before the daily
  // limit began to be spent when the 1st lap comes up, not when the word is learned).
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
  // Migration: per-pair attempt history. Without it the daily new-word
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
  await dropLegacyPcicRows(db);
  return activePair;
}
