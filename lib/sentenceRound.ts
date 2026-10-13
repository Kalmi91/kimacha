// The Sentences tab round (spec HAROM-JATEK.md 3): a round holds SENTENCE_ROUND_SIZE sentences to build from tiles (no
// credit: lib/sentencePick.ts picks them), then ONE other, shorter sentence to type. Only the typing credits words, word
// by word (lib/sentenceTyping.ts, lib/sentenceTab.ts recordTypedWords). A wrong build sends the sentence to the end of
// the round; the typing ends the round, right or wrong (a retry would credit words that were just shown).
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
  /** The `focus` route parameter the round was built for ('' = none): a different focus makes it invalid. */
  focus: string;
  /** The sentences to build, in their first order (also the sentences' data: the saved round needs no queue rebuild). */
  entries: SentenceEntry[];
  /** The itemIds still to build, the first is the current one; a wrong build puts it at the end. */
  queue: string[];
  /** The itemIds built right (progress only: a build credits nothing). */
  rated: string[];
  /** The sentence to type: not one of `entries`, shorter than them (lib/sentencePick.ts). */
  typed: SentenceEntry;
  phase: RoundPhase;
}

/** A fresh round: every build still to do, then the typing (straight to the typing when there is nothing to build). */
export function startRound(entries: SentenceEntry[], typed: SentenceEntry, day: string, target: PcicTarget, focus = ''): SentenceRound {
  return { day, target, focus, entries, queue: entries.map((e) => e.itemId), rated: [], typed, phase: entries.length === 0 ? 'type' : 'build' };
}

/** The sentence on screen: the head of the queue while building, the typed one while typing. */
export function currentEntry(round: SentenceRound): SentenceEntry | undefined {
  if (round.phase === 'type') return round.typed;
  if (round.phase !== 'build') return undefined;
  return round.entries.find((e) => e.itemId === round.queue[0]);
}

/** Progress in steps: one build per sentence plus the one typing; a done step is a sentence built right or the typing. */
export function roundProgress(round: SentenceRound): { done: number; total: number } {
  return { done: round.rated.length + (round.phase === 'done' ? 1 : 0), total: round.entries.length + 1 };
}

/** The 1-based place of the sentence being built among the round's builds (stays put while a wrong one comes back). */
export function buildNumber(round: SentenceRound): number {
  return Math.min(round.rated.length + 1, Math.max(1, round.entries.length));
}

/** The sentences of the round, builds and the typed one. */
export function roundSentences(round: SentenceRound): SentenceEntry[] {
  return [...round.entries, round.typed];
}

/**
 * The build of the current sentence was answered. Right = the sentence leaves the queue (the last one moves on to the
 * typing); wrong = it goes to the end of the queue. Nothing is credited either way.
 */
export function answerBuild(round: SentenceRound, correct: boolean): SentenceRound {
  const id = round.queue[0];
  if (round.phase !== 'build' || id === undefined) return round;
  if (!correct) return { ...round, queue: [...round.queue.slice(1), id] };
  const queue = round.queue.slice(1);
  return { ...round, queue, rated: round.rated.includes(id) ? round.rated : [...round.rated, id], phase: queue.length === 0 ? 'type' : 'build' };
}

/** The typing was answered: the round is over, right or wrong. */
export function answerType(round: SentenceRound): SentenceRound {
  return round.phase === 'type' ? { ...round, phase: 'done' } : round;
}

/** Whether a saved round is for this day, direction and focus. */
export function isRoundFor(saved: SentenceRound | null, day: string, target: PcicTarget, focus = ''): saved is SentenceRound {
  return saved !== null && saved.day === day && saved.target === target && saved.focus === focus;
}

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

function parseEntry(raw: unknown): SentenceEntry | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const e = raw as Partial<SentenceEntry>;
  if (typeof e.itemId !== 'string' || typeof e.source !== 'string' || typeof e.target !== 'string') return null;
  if (typeof e.wordCount !== 'number' || !isStrings(e.wordIds) || typeof e.due !== 'boolean') return null;
  if (!isStrings(e.dueIds) || typeof e.staleness !== 'string' || !Array.isArray(e.slots)) return null;
  const slots = e.slots.every((s) => typeof s === 'object' && s !== null && typeof s.id === 'string' && isStrings(s.words));
  if (!slots) return null;
  return { itemId: e.itemId, source: e.source, target: e.target, wordCount: e.wordCount, wordIds: e.wordIds, due: e.due, dueIds: e.dueIds, staleness: e.staleness, slots: e.slots };
}

/**
 * A saved value back into a round, or null when it is not a round that can continue: broken, a round that has ended,
 * or one saved by an older version (no separate typed sentence): that one simply starts again as a fresh round.
 */
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
  const typed = parseEntry(r.typed);
  if (!typed || !isStrings(r.queue) || !isStrings(r.rated)) return null;
  const ids = new Set(entries.map((e) => e.itemId));
  if (![...r.queue, ...r.rated].every((id) => ids.has(id))) return null;
  const base = { day: r.day, target: r.target, focus: typeof r.focus === 'string' ? r.focus : '', entries, queue: r.queue, rated: r.rated, typed };
  if (r.phase === 'build' && r.queue.length > 0) return { ...base, phase: 'build' };
  if (r.phase === 'type' && r.queue.length === 0) return { ...base, phase: 'type' };
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
