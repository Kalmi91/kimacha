import { addXp } from './dailyXp';
import { getDb } from './database';
import { localDateString } from './usageStats';

// XP for the grammar, Sentences and speech sources (FB591, FB600, FB601, FB606). Per item per day:
// the first right answer pays the first number, the second the second, then nothing, so practising the
// same thing over and over earns less and less. These sources work for everyone.
export type XpKind = 'grammar' | 'levelTest' | 'levelPractice' | 'sentence' | 'sentenceHard' | 'speech';

export const XP_TABLE: Record<XpKind, readonly number[]> = {
  grammar: [2, 0.5],
  levelTest: [0.5],
  levelPractice: [0.5],
  sentence: [1],
  sentenceHard: [2],
  speech: [3, 0.5],
};

// XP of the n-th (0-based) payout of `kind` for one item on one day.
export function xpForRepeat(kind: XpKind, timesToday: number): number {
  return XP_TABLE[kind][timesToday] ?? 0;
}

// The per-item-per-day count lives in ONE game_progress row: game `xp-items`, item `today`, data {date, counts}.
// A new date empties it, so it is bounded by one day's activity (one row read per answer, nothing to merge across days).
// Grammar answers count per item id, whatever screen they come from (a question seen in the level test, the random
// round and the lesson drill is one item); the other kinds have their own key space, so level practice keeps its own line.
export const XP_ITEMS_GAME = 'xp-items';
const TODAY_ROW = 'today';

type DayCounts = { date: string; counts: Record<string, number> };

function readCounts(data: unknown, date: string): DayCounts {
  const d = data as Partial<DayCounts> | null | undefined;
  if (d && d.date === date && d.counts && typeof d.counts === 'object') return { date, counts: { ...d.counts } };
  return { date, counts: {} };
}

// Read-modify-write of the row must not interleave: two fast answers would both read the same counts.
let chain: Promise<unknown> = Promise.resolve();

// Records one right answer on `itemKey` and adds the XP it earns. Returns the XP earned (0 = nothing, show nothing).
// The count is written BEFORE the XP is added: a kill in between loses a payout, it never pays one twice.
export function awardXp(kind: XpKind, itemKey: string, date: string = localDateString()): Promise<number> {
  const run = async (): Promise<number> => {
    const db = getDb();
    const key = kind === 'grammar' ? itemKey : `${kind}:${itemKey}`;
    const row = (await db.getGameProgress(XP_ITEMS_GAME)).find((r) => r.itemId === TODAY_ROW);
    const day = readCounts(row?.data, date);
    const before = day.counts[key] ?? 0;
    const points = xpForRepeat(kind, before);
    day.counts[key] = before + 1;
    await db.setGameProgress(XP_ITEMS_GAME, TODAY_ROW, date, day);
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
