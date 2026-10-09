// The one DB interface both implementations satisfy: SQLite on device
// (lib/database.ts) and the in-memory store on web and in tests
// (lib/database.web.ts).

import type { PcicLevel } from '@/data/pcic';
import type { GrammarPaletteId } from '@/constants/GrammarPalettes';
import type { SkinMix, SkinSelection } from '@/constants/Skins';
import type { BackupPayload } from './backup';
import type { ExamResult, ExamResults } from './exam/types';
import type { MistakeBatchRow } from './mistakes/deck';
import type { Sm2Card } from './sm2';
import type { UsageStats } from './usageStats';

export interface DB {
  getStreak(): Promise<{ current_count: number; last_date: string | null; longest_count: number }>;
  getOnboarding(): Promise<{ source: string; target: string } | null>;
  setOnboarding(source: string, target: string): Promise<void>;
  getLevel(): Promise<{ level: string; correct_streak: number; mistakes_in_window: number; fail_streak: number }>;
  claimDailyGreeting(): Promise<boolean>;
  getStatusBarTint(): Promise<number>;
  setStatusBarTint(index: number): Promise<void>;
  getGrammarPalette(): Promise<GrammarPaletteId>;
  setGrammarPalette(id: GrammarPaletteId): Promise<void>;
  // a választott téma és a Saját mix (null = még nincs választás; setSkin(null) visszaállít).
  getSkin(): Promise<SkinSelection | null>;
  setSkin(id: SkinSelection | null): Promise<void>;
  getSkinMix(): Promise<SkinMix | null>;
  setSkinMix(mix: SkinMix): Promise<void>;
  // napi streak-írás visszakerült (a Tanulás fül vitte
  // el, a PCIC-értékelés az egyetlen hívó innentől, lásd app/(tabs)/index.tsx).
  updateStreak(): Promise<void>;
  getStrictAccents(): Promise<boolean>;
  setStrictAccents(v: boolean): Promise<void>;
  // a PCIC "rontott" (again) kártya ennyi másodperc múlva jön
  // mindenképp vissza (lib/pcicSession.ts); a táblázat-pakli cooldownja
  // (lib/grammar/tableDeck.ts) is ugyanebből olvas.
  getAgainDelaySec(): Promise<number>;
  setAgainDelaySec(sec: number): Promise<void>;
  // a névelő-gombsor a gépelős spanyol főnév-kártyán, ki-be kapcsolható.
  getArticlePicker(): Promise<boolean>;
  setArticlePicker(v: boolean): Promise<void>;
  getWeeklyGoalMinutes(): Promise<number>;
  setWeeklyGoalMinutes(minutes: number): Promise<void>;
  getFeedbackBtnSide(): Promise<'left' | 'right'>;
  setFeedbackBtnSide(side: 'left' | 'right'): Promise<void>;
  getDailyNewLimit(): Promise<number>;
  setDailyNewLimit(limit: number): Promise<void>;
  // a PCIC "+10 új szó" bónusz, a naptári nappal lejár (a `today`
  // paramot a hívó adja); 0, ha `today`-re nincs
  // perzisztált bónusz.
  getPcicNewBonus(today: string): Promise<number>;
  setPcicNewBonus(bonus: number, today: string): Promise<void>;
  addUsageMinute(): Promise<number>;
  getUsageStats(): Promise<UsageStats>;
  getDayStats(date: string): Promise<{ minutes: number; words: number }>;
  // Game fül tables, scoped to the active pair like every
  // other per-pair setting/state in this interface.
  getGameProgress(gameId: string): Promise<{ itemId: string; state: string; data: unknown }[]>;
  setGameProgress(gameId: string, itemId: string, state: string, data?: unknown): Promise<void>;
  // egy játék/kurzus (pl. a nyelvtan) teljes haladása az aktív párra.
  resetGameProgress(gameId: string): Promise<void>;
  // a szintvizsga eredménye szintenként (átment-e, legjobb pontszám),
  // a `level-exam` game_progress sorokban (lib/exam/result.ts); `save` a korábbival összevonva ment.
  getExamResults(): Promise<ExamResults>;
  saveExamResult(level: string, pct: number, passed: boolean, date: string): Promise<ExamResult>;
  // PCIC fül, SM-2, független a FSRS `cards`-tól
  getPcicCards(): Promise<Sm2Card[]>;
  upsertPcicCard(card: Sm2Card): Promise<void>;
  // a kiválasztott PCIC szint (A1-B2), app-szintű, mint a
  // status-bar tint. `levelPrefix` opcionális: csak azt a szintet üríti ki
  // (a betöltött korpuszból lekért id-lista szerint, lib/pcicLevels.ts
  // matchesLevel mintájára -, a szint-igazítás óta nem
  // csupasz id-előtag), üresen az egész táblát, mint eddig.
  getPcicLevel(): Promise<PcicLevel>;
  // van-e KIFEJEZETTEN választott szintje az
  // aktív párnak (a getPcicLevel fallbackja nem számít annak).
  hasPcicLevel(): Promise<boolean>;
  setPcicLevel(level: PcicLevel): Promise<void>;
  resetPcicCards(levelPrefix?: string): Promise<void>;
  // a "Hibáim" kötegek (Settings -> Load my mistakes)
  // és a hozzájuk tartozó SM-2 haladás, a pcic_cards-tól elkülönítve.
  saveMistakeBatch(batchId: string, json: string, importedAt: string): Promise<void>;
  getMistakeBatches(): Promise<MistakeBatchRow[]>;
  getMistakeCards(): Promise<Sm2Card[]>;
  upsertMistakeCard(card: Sm2Card): Promise<void>;
  exportAll(): Promise<BackupPayload>;
  importAll(payload: BackupPayload): Promise<void>;
}
