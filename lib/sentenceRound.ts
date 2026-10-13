// The Sentences tab round (spec HAROM-JATEK.md 3): a round holds SENTENCE_ROUND_SIZE sentences, each built from tiles;
// when all are built right, ONE of the built sentences is typed (picked from the round with a fixed seed, so the same
// round always picks the same one). The half of a sentence (one per learned word) is paid when its BUILD is right, once:
// the typing never pays again. A wrong build sends the sentence to the end of the round; a wrong typing sends the typed
// sentence back to the end (it is built again, then typed again), neither takes anything back from the words.
//
// Pure state functions plus the save of the round: it is kept so a round that was left (another tab, the app closed)
// continues on the same sentence the same day, and is dropped when the round ends. Not saved: the half-built tiles.

import type { PcicTarget } from '@/data/pcic';
import type { DB } from '@/lib/database';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import type { SentenceEntry } from '@/lib/sentenceTab';

const ROUND_KEY = 'sentences';

export type RoundPhase = 'build' | 'type' | 'done';

export interface SentenceRound {
  /** The local day the round started: a saved round is only valid the same day. */
  day: string;
  /** The direction the round was built for (a direction switch makes it invalid). */
  target: PcicTarget;
  /** The round's sentences in their first order (also the sentences' data: the saved round needs no queue rebuild). */
  entries: SentenceEntry[];
  /** The itemIds still to build, the first is the current one; a wrong build puts it at the end. */
  queue: string[];
  /** The itemIds built right: their halves are paid, they never pay again. */
  rated: string[];
  /** The sentence picked for typing, null until every sentence was built right once. */
  typeId: string | null;
  phase: RoundPhase;
}

/** A fresh round over these sentences: every one still to build. */
export function startRound(entries: SentenceEntry[], day: string, target: PcicTarget): SentenceRound {
  return { day, target, entries, queue: entries.map((e) => e.itemId), rated: [], typeId: null, phase: 'build' };
}

/** FNV-1a over the seed text: a small stable hash, no randomness, so a test and a saved round see the same pick. */
function seedHash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Which of the round's sentences is typed: a seeded pick from the first order of the round (day + the ids). */
export function pickTypedId(day: string, ids: readonly string[]): string | null {
  if (ids.length === 0) return null;
  return ids[seedHash(`${day}|${ids.join(',')}`) % ids.length];
}

/** The sentence on screen: the head of the queue while building, the picked one while typing. */
export function currentEntry(round: SentenceRound): SentenceEntry | undefined {
  const id = round.phase === 'build' ? round.queue[0] : round.phase === 'type' ? round.typeId : undefined;
  return id === undefined || id === null ? undefined : round.entries.find((e) => e.itemId === id);
}

/** Progress in steps: one build per sentence plus the one typing; a done step is a sentence built right or the typing right. */
export function roundProgress(round: SentenceRound): { done: number; total: number } {
  return { done: round.rated.length + (round.phase === 'done' ? 1 : 0), total: round.entries.length + 1 };
}

/** The 1-based place of the sentence being built among the round's builds (stays put while a wrong one comes back). */
export function buildNumber(round: SentenceRound): number {
  return Math.min(round.rated.length + 1, Math.max(1, round.entries.length));
}

/**
 * The build of the current sentence was answered. Right = the sentence leaves the queue and, the first time only, `pay`
 * is the sentence whose words get their half; the last right build moves on to the typing (the pick is made once).
 * Wrong = the sentence goes to the end of the queue, nothing is paid.
 */
export function answerBuild(round: SentenceRound, correct: boolean): { round: SentenceRound; pay: SentenceEntry | null } {
  const id = round.queue[0];
  if (round.phase !== 'build' || id === undefined) return { round, pay: null };
  if (!correct) return { round: { ...round, queue: [...round.queue.slice(1), id] }, pay: null };
  const first = !round.rated.includes(id);
  const queue = round.queue.slice(1);
  const typeId = queue.length === 0 ? round.typeId ?? pickTypedId(round.day, round.entries.map((e) => e.itemId)) : round.typeId;
  return {
    round: { ...round, queue, rated: first ? [...round.rated, id] : round.rated, typeId, phase: queue.length === 0 ? 'type' : 'build' },
    pay: first ? round.entries.find((e) => e.itemId === id) ?? null : null,
  };
}

/** The typing was answered: right ends the round; wrong sends the typed sentence back (built again, then typed again). */
export function answerType(round: SentenceRound, correct: boolean): SentenceRound {
  if (round.phase !== 'type' || round.typeId === null) return round;
  return correct ? { ...round, phase: 'done' } : { ...round, queue: [round.typeId], phase: 'build' };
}

/** Whether a saved round is for this day and direction. */
export function isRoundFor(saved: SentenceRound | null, day: string, target: PcicTarget): saved is SentenceRound {
  return saved !== null && saved.day === day && saved.target === target;
}

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

function parseEntry(raw: unknown): SentenceEntry | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const e = raw as Partial<SentenceEntry>;
  if (typeof e.itemId !== 'string' || typeof e.source !== 'string' || typeof e.target !== 'string') return null;
  if (typeof e.wordCount !== 'number' || !isStrings(e.wordIds) || typeof e.due !== 'boolean') return null;
  return { itemId: e.itemId, source: e.source, target: e.target, wordCount: e.wordCount, wordIds: e.wordIds, due: e.due };
}

/** A saved value back into a round, or null when it is not a round that can continue (broken, or a round that has ended). */
export function parseSentenceRound(raw: unknown): SentenceRound | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<SentenceRound>;
  if (typeof r.day !== 'string' || (r.target !== 'es' && r.target !== 'en') || !Array.isArray(r.entries)) return null;
  const entries: SentenceEntry[] = [];
  for (const raw of r.entries) {
    const entry = parseEntry(raw);
    if (!entry) return null;
    entries.push(entry);
  }
  if (entries.length === 0 || !isStrings(r.queue) || !isStrings(r.rated)) return null;
  const ids = new Set(entries.map((e) => e.itemId));
  if (![...r.queue, ...r.rated].every((id) => ids.has(id))) return null;
  const typeId = typeof r.typeId === 'string' && ids.has(r.typeId) ? r.typeId : null;
  if (r.phase === 'build' && r.queue.length > 0) return { day: r.day, target: r.target, entries, queue: r.queue, rated: r.rated, typeId, phase: 'build' };
  if (r.phase === 'type' && typeId !== null && r.queue.length === 0) return { day: r.day, target: r.target, entries, queue: r.queue, rated: r.rated, typeId, phase: 'type' };
  return null;
}

export async function loadSentenceRound(db: DB): Promise<SentenceRound | null> {
  return parseSentenceRound(await loadResumeValue(db, ROUND_KEY));
}

export async function saveSentenceRound(db: DB, round: SentenceRound): Promise<void> {
  await saveResumeValue(db, ROUND_KEY, round);
}

/** At the end of the round (or on a new day) the saved round is dropped. */
export async function clearSentenceRound(db: DB): Promise<void> {
  await saveResumeValue(db, ROUND_KEY, null);
}
