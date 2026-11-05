import { addXp } from './dailyXp';
import { getDb } from './database';
import { localDateString } from './usageStats';

// XP for the grammar, Sentences and speech sources (FB591, FB600, FB601, FB606). Per item per day:
// the first right answer pays the first number, the second the second, then nothing, so practising the
// same thing over and over earns less and less. These sources work for everyone (no xpV2 flag).
export type XpKind = 'grammar' | 'levelPractice' | 'sentence' | 'sentenceHard' | 'speech';

export const XP_TABLE: Record<XpKind, readonly number[]> = {
  grammar: [2, 0.5],
  levelPractice: [0.5],
  sentence: [1],
  sentenceHard: [2],
  speech: [3, 0.5],
};

// XP of the n-th (0-based) payout of `kind` for one item on one day.
export function xpForRepeat(kind: XpKind, timesToday: number): number {
  return XP_TABLE[kind][timesToday] ?? 0;
}

// The per-item-per-day count lives in the game_progress table under this game id, one row per item:
// item_id = `${kind}:${itemKey}`, state = `${date}:${count}`. A row of an older day reads as 0, so the
// table holds one row per item ever rewarded, not one per day. It survives an app kill (SQLite).
export const XP_ITEMS_GAME = 'xp-items';

function parseState(state: string | undefined, date: string): number {
  if (!state) return 0;
  const at = state.lastIndexOf(':');
  if (at < 0 || state.slice(0, at) !== date) return 0;
  const n = Number(state.slice(at + 1));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Read-modify-write of one count must not interleave: two fast answers would both read the same count.
let chain: Promise<unknown> = Promise.resolve();

// Records one right answer on `itemKey` and adds the XP it earns. Returns the XP earned (0 = nothing, show nothing).
// The count is written BEFORE the XP is added: a kill in between loses a payout, it never pays one twice.
export function awardXp(kind: XpKind, itemKey: string, date: string = localDateString()): Promise<number> {
  const run = async (): Promise<number> => {
    const db = getDb();
    const id = `${kind}:${itemKey}`;
    const rows = await db.getGameProgress(XP_ITEMS_GAME);
    const before = parseState(rows.find((r) => r.itemId === id)?.state, date);
    const points = xpForRepeat(kind, before);
    await db.setGameProgress(XP_ITEMS_GAME, id, `${date}:${before + 1}`);
    if (points > 0) await addXp(points, date);
    return points;
  };
  const result = chain.then(run, run);
  chain = result.catch(() => undefined);
  return result;
}

const WORDS_FOR_HARD = 8;

// A "hard" Sentences-tab sentence (FB601): 8 or more words, or a sentence of a level above the learner's own.
// `level` / `learnerLevel` are CEFR labels in `order` (lowest first); an unknown label is not above anything.
export function isHardSentence(
  target: string,
  level: string | undefined,
  learnerLevel: string | undefined,
  order: readonly string[],
): boolean {
  if (target.trim().split(/\s+/).filter(Boolean).length >= WORDS_FOR_HARD) return true;
  const a = level === undefined ? -1 : order.indexOf(level);
  const b = learnerLevel === undefined ? -1 : order.indexOf(learnerLevel);
  return a >= 0 && b >= 0 && a > b;
}

// A screen's fire-and-forget form: `show` gets the XP the answer earned. A failed write earns nothing and the answer stands.
export function awardXpThen(kind: XpKind, itemKey: string, show: (points: number) => void): void {
  awardXp(kind, itemKey).then(show, () => undefined);
}
