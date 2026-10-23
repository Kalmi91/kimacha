import type { BackupPayload } from './backup';
import type { Sm2Card } from './sm2';
import type { MistakeBatchRow } from './mistakes/deck';
import { DEFAULT_GRAMMAR_PALETTE, isGrammarPaletteId } from '@/constants/GrammarPalettes';
import { isSkinSelection, parseSkinMix } from '@/constants/Skins';
import { parseBetaFlagMap } from './betaFlags';
import { DbCore, decodeGameData, encodeGameData } from './db/core';
import type { DbStore, MetaColumn, SettingColumn, StreakRow } from './db/store';
import type { DB } from './dbTypes';
import { FORCED_PAIR, needsPairCorrection } from './languages';

// pcic_cards / mistake_cards row <-> Sm2Card, the same shapes the SQLite side stores.
const sm2ToRow = (c: Sm2Card) => ({
  item_id: c.itemId,
  state: c.state,
  step: c.step,
  ease: c.ease,
  interval: c.interval,
  reps: c.reps,
  lapses: c.lapses,
  due: c.due,
  last_review: c.lastReview,
  introduced_at: c.introducedAt,
  known: c.known ? 1 : 0,
});
const rowToSm2 = (r: any): Sm2Card => ({
  itemId: r.item_id,
  state: r.state,
  step: r.step,
  ease: r.ease,
  interval: r.interval,
  reps: r.reps,
  lapses: r.lapses,
  due: r.due,
  lastReview: r.last_review ?? null,
  introducedAt: r.introduced_at ?? null,
  known: !!r.known,
});

// pcic_cards adds the practice-tab columns (mistake_cards has no such columns); a missing value = 0,
// so a zero counter stays off the card object (as for a card that never got a half).
const pcicToRow = (c: Sm2Card) => ({ ...sm2ToRow(c), half_steps: c.halfSteps ?? 0, wrong_streak: c.wrongStreak ?? 0 });
const rowToPcic = (r: any): Sm2Card => ({
  ...rowToSm2(r),
  ...(r.half_steps ? { halfSteps: r.half_steps } : null),
  ...(r.wrong_streak ? { wrongStreak: r.wrong_streak } : null),
});

const WEB_STATE_VERSION = 1;

const isObject = (x: unknown): x is Record<string, any> => !!x && typeof x === 'object' && !Array.isArray(x);

// A Map written as an [key, value][] array (serializeState); anything else is a broken state.
function entriesOf(x: unknown): [string, any][] {
  if (!Array.isArray(x) || !x.every((e) => Array.isArray(e) && e.length === 2 && typeof e[0] === 'string')) {
    throw new Error('Not a Kimacha web state');
  }
  return x as [string, any][];
}

// The memory half of the DB (web and tests): the same columns as the SQLite tables, held in Maps.
// The rules are in lib/db/core.ts. It does not survive a reload, a known limitation of the web build
// (the web cloud save, lib/cloud/sync.ts, carries it through serializeState / restoreState below).
// Exported for the tests of that state (lib/__tests__/webState.test.ts).
export class MemoryStore implements DbStore {
  streak: StreakRow = { current_count: 0, last_date: null, longest_count: 0 };
  private onboarding: { source: string; target: string } | null = null;
  userLevels: Map<string, any> = new Map();

  // user_meta singleton. The export leaves out status_bar_tint and last_open_date (a web reload counts
  // as a new day), and the restore leaves them alone.
  private meta: Record<MetaColumn, unknown> = {
    last_open_date: null,
    status_bar_tint: 0,
    grammar_palette: DEFAULT_GRAMMAR_PALETTE,
    skin: null,
    skin_mix: null,
    beta_flags: null,
    practice_round: null,
  };
  private userMeta = { userId: '', firstUseDate: new Date().toISOString(), lastSyncDate: null as string | null };

  // learn_settings rows by pair. Play Store trim: getWordsOnly/setWordsOnly and getRandomTopics/
  // setRandomTopics are gone (no caller since the Learn/Topics tabs left), but words_only /
  // random_topics values of an imported old backup still round-trip through exportTables.
  private settings: Map<string, Record<string, unknown>> = new Map();

  private usageMinutes: Map<string, number> = new Map();
  // integer tenths of an XP (10 = 1 XP); not part of the backup
  private dailyXp: Map<string, number> = new Map();
  // `${pair}:${gameId}` -> itemId -> progress
  private gameProgress: Map<string, Map<string, { state: string; data: unknown }>> = new Map();

  // Session-scoped Maps, not tied to a pair (the PCIC tab only works with es→en items).
  private pcicCards: Map<string, Sm2Card> = new Map();
  private mistakeBatches: Map<string, { json: string; importedAt: string }> = new Map();
  private mistakeCards: Map<string, Sm2Card> = new Map();

  private gameKey(pair: string, gameId: string) {
    return `${pair}:${gameId}`;
  }

  async open() {
    return null;
  }

  async readStreak() {
    return { ...this.streak };
  }

  async writeStreak(streak: StreakRow) {
    this.streak = { current_count: streak.current_count, last_date: streak.last_date, longest_count: streak.longest_count };
  }

  async readOnboarding() {
    return this.onboarding;
  }

  async writeOnboarding(source: string, target: string) {
    this.onboarding = { source, target };
  }

  async readLevel(pair: string) {
    return { ...(this.userLevels.get(pair) ?? { level: 'A0', correct_streak: 0, mistakes_in_window: 0, fail_streak: 0 }) };
  }

  async readMeta(column: MetaColumn) {
    return this.meta[column];
  }

  async writeMeta(column: MetaColumn, value: unknown) {
    this.meta[column] = value;
  }

  async readSettings(pair: string) {
    return this.settings.get(pair) ?? null;
  }

  async writeSettings(pair: string, values: Partial<Record<SettingColumn, unknown>>) {
    this.settings.set(pair, { ...this.settings.get(pair), ...values });
  }

  async addUsageMinute(date: string) {
    const total = (this.usageMinutes.get(date) ?? 0) + 1;
    this.usageMinutes.set(date, total);
    return total;
  }

  async readUsage() {
    return [...this.usageMinutes.entries()].map(([date, minutes]) => ({ date, minutes }));
  }

  async readUsageMinutes(date: string) {
    return this.usageMinutes.get(date) ?? 0;
  }

  async countPcicIntroducedOn(date: string) {
    return [...this.pcicCards.values()].filter(c => c.introducedAt === date).length;
  }

  async readDailyXpTenths(date: string) {
    return this.dailyXp.get(date) ?? 0;
  }

  async addDailyXpTenths(date: string, delta: number) {
    this.dailyXp.set(date, Math.max(0, (this.dailyXp.get(date) ?? 0) + delta));
  }

  async readGameProgress(pair: string, gameId: string) {
    const items = this.gameProgress.get(this.gameKey(pair, gameId)) ?? new Map();
    return [...items.entries()].map(([itemId, v]) => ({ itemId, state: v.state, data: v.data }));
  }

  async writeGameProgress(pair: string, gameId: string, itemId: string, state: string, data: unknown) {
    const key = this.gameKey(pair, gameId);
    let items = this.gameProgress.get(key);
    if (!items) {
      items = new Map();
      this.gameProgress.set(key, items);
    }
    items.set(itemId, { state, data });
  }

  async deleteGameProgress(pair: string, gameId: string) {
    this.gameProgress.delete(this.gameKey(pair, gameId));
  }

  async readPcicCards() {
    return [...this.pcicCards.values()].map(c => ({ ...c }));
  }

  async readPcicCard(itemId: string) {
    const c = this.pcicCards.get(itemId);
    return c ? { ...c, halfSteps: c.halfSteps ?? 0, wrongStreak: c.wrongStreak ?? 0 } : null;
  }

  async writePcicCard(card: Sm2Card) {
    this.pcicCards.set(card.itemId, { ...card });
  }

  async deletePcicCards(itemIds?: string[]) {
    if (!itemIds) {
      this.pcicCards.clear();
      return;
    }
    for (const id of itemIds) this.pcicCards.delete(id);
  }

  async writeMistakeBatch(batchId: string, json: string, importedAt: string) {
    this.mistakeBatches.set(batchId, { json, importedAt });
  }

  async readMistakeBatches(): Promise<MistakeBatchRow[]> {
    return [...this.mistakeBatches.entries()]
      .map(([batchId, v]) => ({ batchId, json: v.json, importedAt: v.importedAt }))
      .sort((a, b) => (a.importedAt < b.importedAt ? 1 : a.importedAt > b.importedAt ? -1 : 0));
  }

  async readMistakeCards() {
    return [...this.mistakeCards.values()].map((c) => ({ ...c }));
  }

  async writeMistakeCard(card: Sm2Card) {
    this.mistakeCards.set(card.itemId, { ...card });
  }

  // Memory state is serialized into the same table-row shapes as the SQLite implementation, so a
  // backup made on one platform restores on the other.
  async exportTables(): Promise<BackupPayload['tables']> {
    const learn_settings = [...this.settings]
      .filter(([, s]) => s.words_only !== undefined || s.random_topics !== undefined || s.feedback_btn_side !== undefined)
      .map(([pair, s]) => ({
        pair,
        words_only: s.words_only !== undefined ? (s.words_only ? 1 : 0) : null,
        random_topics: s.random_topics !== undefined ? (s.random_topics ? 1 : 0) : null,
        feedback_btn_side: s.feedback_btn_side ?? null,
      }));
    return {
      game_progress: [...this.gameProgress].flatMap(([key, items]) => {
        const sep = key.lastIndexOf(':');
        const pair = key.slice(0, sep), game_id = key.slice(sep + 1);
        return [...items].map(([item_id, v]) => ({
          pair, game_id, item_id, state: v.state,
          data_json: encodeGameData(v.data),
        }));
      }),
      learn_settings,
      onboarding: this.onboarding ? [{ id: 1, ...this.onboarding }] : [],
      streak: [{ id: 1, ...this.streak }],
      user_level: [...this.userLevels].map(([pair, l]) => ({ pair, ...l })),
      user_meta: [{
        id: 1,
        first_use_date: this.userMeta.firstUseDate,
        last_sync_date: this.userMeta.lastSyncDate,
        grammar_palette: this.meta.grammar_palette,
        skin: this.meta.skin,
        skin_mix: this.meta.skin_mix,
        beta_flags: this.meta.beta_flags,
        practice_round: this.meta.practice_round,
      }],
      pcic_cards: [...this.pcicCards.values()].map(pcicToRow),
      mistake_batches: [...this.mistakeBatches].map(([batch_id, v]) => ({ batch_id, json: v.json, imported_at: v.importedAt })),
      mistake_cards: [...this.mistakeCards.values()].map(sm2ToRow),
      usage_minutes: [...this.usageMinutes].map(([date, minutes]) => ({ date, minutes })),
    };
  }

  // Replaces the whole in-memory state from the payload (not atomic: a malformed table
  // leaves the earlier ones already replaced).
  async importTables(t: BackupPayload['tables']) {
    // Re-keyed by `${pair}:${game_id}` directly (not via writeGameProgress, which is handed
    // the CURRENT active pair, a restore can carry rows for several pairs at once).
    const gameProgress: typeof this.gameProgress = new Map();
    for (const row of t.game_progress) {
      const key = this.gameKey(row.pair, row.game_id);
      let items = gameProgress.get(key);
      if (!items) {
        items = new Map();
        gameProgress.set(key, items);
      }
      items.set(row.item_id, { state: row.state, data: decodeGameData(row.data_json) });
    }
    this.gameProgress = gameProgress;
    // Only these three columns come from the backup; the other settings stay as they are.
    for (const s of this.settings.values()) {
      delete s.words_only;
      delete s.random_topics;
      delete s.feedback_btn_side;
    }
    for (const row of t.learn_settings) {
      const s = this.settings.get(row.pair) ?? {};
      if (row.words_only != null) s.words_only = row.words_only === 1 ? 1 : 0;
      if (row.random_topics != null) s.random_topics = row.random_topics === 1 ? 1 : 0;
      if (row.feedback_btn_side != null) s.feedback_btn_side = row.feedback_btn_side;
      this.settings.set(row.pair, s);
    }
    const ob = t.onboarding[0];
    this.onboarding = ob ? { source: ob.source, target: ob.target } : null;
    const st = t.streak[0];
    if (st) this.streak = { current_count: st.current_count, last_date: st.last_date, longest_count: st.longest_count };
    this.userLevels = new Map(t.user_level.map((r: any) => [r.pair, { level: r.level, correct_streak: r.correct_streak, mistakes_in_window: r.mistakes_in_window, fail_streak: r.fail_streak }]));
    const um = t.user_meta[0];
    if (um) this.userMeta = { userId: um.user_id, firstUseDate: um.first_use_date, lastSyncDate: um.last_sync_date };
    this.meta.grammar_palette = isGrammarPaletteId(um?.grammar_palette) ? um.grammar_palette : DEFAULT_GRAMMAR_PALETTE;
    this.meta.skin = isSkinSelection(um?.skin) ? um.skin : null;
    const skinMix = parseSkinMix(um?.skin_mix);
    this.meta.skin_mix = skinMix ? JSON.stringify(skinMix) : null;
    const betaFlags = parseBetaFlagMap(um?.beta_flags);
    this.meta.beta_flags = Object.keys(betaFlags).length ? JSON.stringify(betaFlags) : null;
    this.meta.practice_round = typeof um?.practice_round === 'string' ? um.practice_round : null;
    // A v1 file has no pcic_cards / mistake_* / usage_minutes: keep the local ones.
    if (t.pcic_cards) this.pcicCards = new Map(t.pcic_cards.map((r: any) => [r.item_id, rowToPcic(r)]));
    if (t.mistake_batches) this.mistakeBatches = new Map(t.mistake_batches.map((r: any) => [r.batch_id, { json: r.json, importedAt: r.imported_at }]));
    if (t.mistake_cards) this.mistakeCards = new Map(t.mistake_cards.map((r: any) => [r.item_id, rowToSm2(r)]));
    if (t.usage_minutes) this.usageMinutes = new Map(t.usage_minutes.map((r: any) => [r.date, r.minutes]));
  }

  // EVERY field of this class, for the web cloud save. exportTables/importTables are the backup format (the native
  // backup uses it) and leave things out on purpose (most learn_settings columns, daily XP, last_open_date,
  // status_bar_tint); this leaves out nothing. The guard test in lib/__tests__/webState.test.ts fails when a
  // field is added to the class and not listed here. Maps are written as [key, value][] arrays.
  serializeState(): string {
    return JSON.stringify({
      v: WEB_STATE_VERSION,
      streak: this.streak,
      onboarding: this.onboarding,
      userLevels: [...this.userLevels],
      meta: this.meta,
      userMeta: this.userMeta,
      settings: [...this.settings],
      usageMinutes: [...this.usageMinutes],
      dailyXp: [...this.dailyXp],
      gameProgress: [...this.gameProgress].map(([key, items]) => [key, [...items]]),
      pcicCards: [...this.pcicCards],
      mistakeBatches: [...this.mistakeBatches],
      mistakeCards: [...this.mistakeCards],
    });
  }

  // Replaces every field from serializeState() output. Throws, and changes nothing, when the string is not one
  // (all the parts are built before the first assignment). A field missing from the string takes its fresh default.
  restoreState(raw: string): void {
    const s = JSON.parse(raw);
    if (!isObject(s) || s.v !== WEB_STATE_VERSION) throw new Error('Not a Kimacha web state');
    if (!isObject(s.streak) || !isObject(s.meta) || !isObject(s.userMeta) || (s.onboarding != null && !isObject(s.onboarding))) {
      throw new Error('Not a Kimacha web state');
    }
    const fresh = new MemoryStore();
    const userLevels = new Map(entriesOf(s.userLevels));
    const settings = new Map(entriesOf(s.settings));
    const usageMinutes = new Map(entriesOf(s.usageMinutes));
    const dailyXp = new Map(entriesOf(s.dailyXp));
    const gameProgress = new Map(entriesOf(s.gameProgress).map(([key, items]): [string, Map<string, { state: string; data: unknown }>] => [key, new Map(entriesOf(items))]));
    const pcicCards = new Map<string, Sm2Card>(entriesOf(s.pcicCards));
    const mistakeBatches = new Map<string, { json: string; importedAt: string }>(entriesOf(s.mistakeBatches));
    const mistakeCards = new Map<string, Sm2Card>(entriesOf(s.mistakeCards));
    this.streak = { ...fresh.streak, ...s.streak };
    this.onboarding = s.onboarding ?? null;
    this.userLevels = userLevels;
    this.meta = { ...fresh.meta, ...s.meta };
    this.userMeta = { ...fresh.userMeta, ...s.userMeta };
    this.settings = settings;
    this.usageMinutes = usageMinutes;
    this.dailyXp = dailyXp;
    this.gameProgress = gameProgress;
    this.pcicCards = pcicCards;
    this.mistakeBatches = mistakeBatches;
    this.mistakeCards = mistakeCards;
  }
}

// Exported for the tests of the web state (lib/__tests__/webState.test.ts); the app goes through getDb().
export class MemoryDB extends DbCore {
  constructor(private readonly mem = new MemoryStore()) {
    super(mem);
  }

  // Play Store trim: updateLevel (the only public setter) had no app-code
  // caller and is gone; grammar-screen fixtures that need a specific level
  // use this instead. Not on the DB interface, same pattern as the old
  // __setRequeueLevelForTest.
  __setLevelForTest(level: string): void {
    this.mem.userLevels.set(this.activePair, { level, correct_streak: 0, mistakes_in_window: 0, fail_streak: 0 });
  }

  // The streak row for a test (default: no streak yet). Not on the DB interface, same pattern as __setLevelForTest.
  __setStreakForTest(streak: { current_count: number; last_date: string | null; longest_count: number } = { current_count: 0, last_date: null, longest_count: 0 }): void {
    this.mem.streak = streak;
  }

  // The whole memory state as one string (MemoryStore.serializeState), for the web cloud save.
  async exportState(): Promise<string> {
    await this.ready();
    return this.mem.serializeState();
  }

  // Restores exportState(). The active pair follows the restored onboarding, the same rule as DbCore.importAll.
  async importState(raw: string): Promise<void> {
    await this.ready();
    this.mem.restoreState(raw);
    const ob = await this.mem.readOnboarding();
    if (ob && needsPairCorrection(ob)) {
      await this.setOnboarding(FORCED_PAIR.source, FORCED_PAIR.target);
    } else if (ob) {
      this.activePair = `${ob.source}-${ob.target}`;
    }
  }
}

let instance: MemoryDB | undefined;
function memoryDb(): MemoryDB {
  if (!instance) instance = new MemoryDB();
  return instance;
}

export function getDb(): DB {
  return memoryDb();
}

// The web cloud save (lib/cloud/sync.ts) works on the getDb() singleton's whole state, not on the backup format.
export function exportWebState(): Promise<string> {
  return memoryDb().exportState();
}

export function importWebState(raw: string): Promise<void> {
  return memoryDb().importState(raw);
}
