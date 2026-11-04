// The Sentences tab round (spec HAROM-JATEK.md 3, FB524): a round holds SENTENCE_ROUND_SIZE sentences, each on ONE rung of
// the ladder (lib/sentenceLadder.ts), played through the steps of that rung (lib/sentenceSteps.ts: the parts of a split
// sentence and the whole sentence built, or listen and type, or the whole sentence typed). Only the typing step credits words,
// word by word (lib/sentenceTyping.ts, lib/sentenceTab.ts recordTypedWords). A wrong step goes to the end of the round; the
// typing step is done right or wrong (a retry would credit words that were just shown). A rung is passed when all its steps are
// done right; a wrong typing step passes nothing (`passed` below).
//
// Pure state functions plus the save of the round: it is kept so a round that was left (another tab, the app closed)
// continues on the same step the same day, and is dropped when the round ends. Not saved: the half-built tiles.

import type { PcicTarget } from '@/data/pcic';
import type { DB } from '@/lib/database';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import type { SentenceChunk } from '@/lib/sentenceChunks';
import { roundSteps, type RoundStep, type StepFlags, type StepKind } from '@/lib/sentenceSteps';
import type { SentenceEntry } from '@/lib/sentenceTab';

const ROUND_KEY = 'sentences';

export type RoundPhase = 'steps' | 'done';

export interface SentenceRound {
  /** Format version: a round saved by an older version (no steps, no rungs) is not continued. */
  v: 3;
  /** The local day the round started: a saved round is only valid the same day. */
  day: string;
  /** The direction the round was built for (a direction switch makes it invalid). */
  target: PcicTarget;
  /** The `focus` route parameter the round was built for ('' = none): a different focus makes it invalid. */
  focus: string;
  /** The round's sentences, in play order (also the sentences' data: the saved round needs no queue rebuild). */
  entries: SentenceEntry[];
  /** Every step of the round, in the first order (lib/sentenceSteps.ts). */
  steps: RoundStep[];
  /** The step ids still to do, the first is the current one; a wrong step puts itself at the end. */
  queue: string[];
  /** The step ids done (progress). */
  done: string[];
  phase: RoundPhase;
  /**
   * The learned cards whose word was looked at with the tap-a-word hint (lib/sentenceHint.ts, beta sentenceHint) in this
   * round: they get no half and no XP at the typing. Absent = none (also in rounds saved before the hint).
   */
  hinted?: string[];
  /** The sentences (itemId) whose rung was passed in this round: the screen moves them up the ladder. Absent = none yet. */
  passed?: string[];
}

/** A fresh round: every step still to do (done at once when there is nothing to play). */
export function startRound(entries: SentenceEntry[], day: string, target: PcicTarget, focus = '', flags: StepFlags = {}): SentenceRound {
  const steps = roundSteps(entries, flags);
  return { v: 3, day, target, focus, entries, steps, queue: steps.map((s) => s.id), done: [], phase: steps.length === 0 ? 'done' : 'steps' };
}

/** The step on screen: the head of the queue. */
export function currentStep(round: SentenceRound): RoundStep | undefined {
  if (round.phase !== 'steps') return undefined;
  return round.steps.find((s) => s.id === round.queue[0]);
}

/** The sentence the step on screen belongs to. */
export function currentEntry(round: SentenceRound): SentenceEntry | undefined {
  const step = currentStep(round);
  return step ? round.entries.find((e) => e.itemId === step.itemId) : undefined;
}

/** Progress in steps: the steps done out of all of them. */
export function roundProgress(round: SentenceRound): { done: number; total: number } {
  return { done: round.done.length, total: round.steps.length };
}

/** The 1-based place of the sentence on screen among the round's sentences (the last one once the round is over). */
export function sentenceNumber(round: SentenceRound): number {
  const step = currentStep(round);
  const place = step ? round.entries.findIndex((e) => e.itemId === step.itemId) + 1 : round.entries.length;
  return Math.min(Math.max(1, place), Math.max(1, round.entries.length));
}

/** The sentences of the round. */
export function roundSentences(round: SentenceRound): SentenceEntry[] {
  return round.entries;
}

/**
 * The step on screen was answered. The typing step is done either way (a retry would credit words that were just shown);
 * any other step: right = done, wrong = it goes to the end of the queue. The last step done ends the round. The sentence's
 * rung is passed (`passed`) when its typing step was right, or when its last other step was done (each of those is only done
 * right); a mistake sentence is outside the ladder.
 */
export function answerStep(round: SentenceRound, correct: boolean): SentenceRound {
  const id = round.queue[0];
  const step = currentStep(round);
  if (round.phase !== 'steps' || id === undefined || !step) return round;
  const rest = round.queue.slice(1);
  if (!correct && step.kind !== 'type') return { ...round, queue: [...rest, id] };
  const done = round.done.includes(id) ? round.done : [...round.done, id];
  const rungPassed =
    step.kind !== 'mistake' &&
    (step.kind === 'type' ? correct : round.steps.filter((st) => st.itemId === step.itemId).every((st) => done.includes(st.id)));
  const passed = rungPassed && !round.passed?.includes(step.itemId) ? { passed: [...(round.passed ?? []), step.itemId] } : {};
  return { ...round, ...passed, queue: rest, done, phase: rest.length === 0 ? 'done' : 'steps' };
}

/** The sentence that passed its rung with the answer that turned `before` into `after`, if any (see answerStep). */
export function newlyPassed(before: SentenceRound, after: SentenceRound): SentenceEntry | undefined {
  const id = after.passed?.find((p) => !before.passed?.includes(p));
  return id === undefined ? undefined : after.entries.find((e) => e.itemId === id);
}

/** How many sentences of the round became learned: they passed rung 3. */
export function learnedInRound(round: SentenceRound): number {
  return round.entries.filter((e) => e.rung === 3 && round.passed?.includes(e.itemId)).length;
}

/** Cards whose word was looked at with a hint: added to the round's `hinted` (the same round back when nothing is new). */
export function addHinted(round: SentenceRound, ids: readonly string[]): SentenceRound {
  const fresh = ids.filter((id) => !round.hinted?.includes(id));
  return fresh.length === 0 ? round : { ...round, hinted: [...(round.hinted ?? []), ...new Set(fresh)] };
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
  // Optional (rounds saved before the mistake step have none); present but malformed = not a usable round.
  if (e.mistake !== undefined && (typeof e.mistake !== 'object' || e.mistake === null || typeof e.mistake.wrong !== 'string')) return null;
  const mistake = e.mistake ? { mistake: { wrong: e.mistake.wrong } } : {};
  // Optional too (a sentence with no parts has none); present but malformed = not a usable round.
  if (e.chunks !== undefined && !(Array.isArray(e.chunks) && e.chunks.every((c: Partial<SentenceChunk>) => typeof c === 'object' && c !== null && typeof c.source === 'string' && typeof c.target === 'string'))) return null;
  const chunks = e.chunks ? { chunks: e.chunks.map((c) => ({ source: c.source, target: c.target })) } : {};
  // Optional (rung 1 has none); present but not 2 or 3 = not a usable round.
  if (e.rung !== undefined && e.rung !== 2 && e.rung !== 3) return null;
  const rung = e.rung ? { rung: e.rung } : {};
  return { itemId: e.itemId, source: e.source, target: e.target, wordCount: e.wordCount, wordIds: e.wordIds, due: e.due, dueIds: e.dueIds, staleness: e.staleness, slots: e.slots, ...chunks, ...rung, ...mistake };
}

const STEP_KINDS: readonly string[] = ['chunk', 'listen', 'build', 'type', 'mistake'] satisfies readonly StepKind[];

function parseStep(raw: unknown): RoundStep | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const st = raw as Partial<RoundStep>;
  if (typeof st.id !== 'string' || typeof st.itemId !== 'string' || typeof st.kind !== 'string' || !STEP_KINDS.includes(st.kind)) return null;
  if (st.chunk !== undefined && !Number.isInteger(st.chunk)) return null;
  return { id: st.id, itemId: st.itemId, kind: st.kind as StepKind, ...(st.chunk === undefined ? {} : { chunk: st.chunk }) };
}

/**
 * A saved value back into a round, or null when it is not a round that can continue: broken, a round that has ended,
 * or one saved by an older version (no `v: 3`: no steps, no rungs): that one simply starts again as a fresh round.
 */
export function parseSentenceRound(raw: unknown): SentenceRound | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<SentenceRound>;
  if (r.v !== 3 || typeof r.day !== 'string' || (r.target !== 'es' && r.target !== 'en' && r.target !== 'hu' && r.target !== 'de') || !Array.isArray(r.entries) || !Array.isArray(r.steps)) return null;
  const entries: SentenceEntry[] = [];
  for (const raw of r.entries) {
    const entry = parseEntry(raw);
    if (!entry) return null;
    entries.push(entry);
  }
  const steps: RoundStep[] = [];
  for (const raw of r.steps) {
    const st = parseStep(raw);
    if (!st) return null;
    steps.push(st);
  }
  const entryIds = new Set(entries.map((e) => e.itemId));
  if (!steps.every((st) => entryIds.has(st.itemId))) return null;
  if (!isStrings(r.queue) || !isStrings(r.done)) return null;
  const stepIds = new Set(steps.map((st) => st.id));
  if (![...r.queue, ...r.done].every((id) => stepIds.has(id))) return null;
  if (r.phase !== 'steps' || r.queue.length === 0) return null;
  const hinted = isStrings(r.hinted) && r.hinted.length > 0 ? { hinted: r.hinted } : {};
  const passed = isStrings(r.passed) && r.passed.length > 0 ? { passed: r.passed } : {};
  return { v: 3, day: r.day, target: r.target, focus: typeof r.focus === 'string' ? r.focus : '', entries, steps, queue: r.queue, done: r.done, phase: 'steps', ...hinted, ...passed };
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
