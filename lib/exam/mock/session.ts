// a próbavizsga részenkénti mentése és az eredmény.
// A meglévő `game_progress` táblába ír, `mock-exam` játékkulccsal (nincs új tábla és
// migráció, a backup magától viszi, lásd lib/exam/result.ts mintáját):
//   - `<irány>-<szint>-session`: a félbehagyott vizsga (mag + a kész papírok válaszai)
//   - `<irány>-<szint>`: a legutóbbi eredmény (a Stats "Practice exam" kártya ezt mutatja)
// Papíronként mentünk: egy kész papír válaszai megmaradnak, a félbehagyott papír elölről indul.

import type { MockResult } from './score';
import type { MockAnswers, MockLevel, MockTarget } from './types';

export const MOCK_EXAM_PROGRESS_KEY = 'mock-exam';

export interface MockSession {
  /** A feladatsor magja: ugyanabból ugyanaz a vizsga épül (lib/exam/mock/build.ts). */
  seed: number;
  /** A feladatsor ujjlenyomata: csak egyezéskor folytatható (változott a szókészlet = új vizsga). */
  sig: string;
  /** A már lezárt papírok azonosítói (lib/exam/mock/types.ts MockPaper.id). */
  done: string[];
  /** A lezárt papírok feladatainak válaszai. */
  answers: MockAnswers;
}

export interface MockLast {
  passed: boolean;
  /** Igaz, ha a szóbeli helyőrző volt (E2 a). */
  provisional: boolean;
  /** YYYY-MM-DD. */
  date: string;
  /** Az átmenési szabály számai: csoportonként, vagy egyetlen sor az összpontból / az átlag-százalékból. */
  groups: { points: number; needed: number; of: number }[];
}

export type MockOverview = Partial<Record<MockLevel, { last?: MockLast; session?: MockSession }>>;

type Row = { itemId: string; state: string; data: unknown };
type ProgressStore = {
  getGameProgress(gameId: string): Promise<Row[]>;
  setGameProgress(gameId: string, itemId: string, state: string, data?: unknown): Promise<void>;
};

const lastId = (target: MockTarget, level: MockLevel) => `${target}-${level}`;
const sessionId = (target: MockTarget, level: MockLevel) => `${target}-${level}-session`;

function isSession(data: unknown): data is MockSession {
  const d = data as Partial<MockSession> | null | undefined;
  return !!d && typeof d.seed === 'number' && typeof d.sig === 'string' && Array.isArray(d.done) && !!d.answers && typeof d.answers === 'object';
}

function isLast(data: unknown): data is MockLast {
  const d = data as Partial<MockLast> | null | undefined;
  return !!d && typeof d.passed === 'boolean' && typeof d.date === 'string' && Array.isArray(d.groups);
}

/** Az irány összes szintjének mentett állapota (a Stats kártya egyetlen olvasással). */
export async function readMockOverview(store: ProgressStore, target: MockTarget, levels: readonly MockLevel[]): Promise<MockOverview> {
  const rows = await store.getGameProgress(MOCK_EXAM_PROGRESS_KEY);
  const out: MockOverview = {};
  for (const level of levels) {
    const last = rows.find((r) => r.itemId === lastId(target, level))?.data;
    const session = rows.find((r) => r.itemId === sessionId(target, level))?.data;
    out[level] = { ...(isLast(last) ? { last } : {}), ...(isSession(session) ? { session } : {}) };
  }
  return out;
}

export async function saveMockSession(store: ProgressStore, target: MockTarget, level: MockLevel, session: MockSession): Promise<void> {
  await store.setGameProgress(MOCK_EXAM_PROGRESS_KEY, sessionId(target, level), 'open', session);
}

export async function clearMockSession(store: ProgressStore, target: MockTarget, level: MockLevel): Promise<void> {
  await store.setGameProgress(MOCK_EXAM_PROGRESS_KEY, sessionId(target, level), 'done', null);
}

function lastFromResult(result: MockResult, date: string): MockLast {
  return {
    passed: result.passed,
    provisional: result.provisional,
    date,
    groups:
      result.rule.kind === 'groups'
        ? result.rule.groups.map((g) => ({ points: g.points, needed: g.needed, of: g.of }))
        : result.rule.kind === 'total'
          ? [{ points: result.rule.points, needed: result.rule.needed, of: result.rule.of }]
          : [{ points: result.rule.pct, needed: result.rule.passPct, of: 100 }],
  };
}

export async function saveMockLast(store: ProgressStore, target: MockTarget, level: MockLevel, result: MockResult, date: string): Promise<MockLast> {
  const last = lastFromResult(result, date);
  await store.setGameProgress(MOCK_EXAM_PROGRESS_KEY, lastId(target, level), last.passed ? 'passed' : 'failed', last);
  return last;
}

// --- Óra: időbélyegből számol, nem tick-számlálóból, hogy a háttérbe küldött app se csússzon el.

/** Hány másodperc van hátra egy papírból (nem megy 0 alá). */
export function secondsLeft(startedAt: number, minutes: number, now: number): number {
  return Math.max(0, Math.ceil((startedAt + minutes * 60_000 - now) / 1000));
}

/** m:ss. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Ennyi hátralévő másodperc alatt kap figyelmeztető színt az óra. */
export const CLOCK_WARNING_SECONDS = 60;
