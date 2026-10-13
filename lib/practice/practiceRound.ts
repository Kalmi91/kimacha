// The Practice tab's unfinished reading round, so it survives a tab switch and an app restart (spec
// HAROM-JATEK.md 5.1). One JSON string in user_meta.practice_round (db.getPracticeRound / setPracticeRound):
//   {"v":2,"date":"2026-10-12","target":"es","ids":["o33","o47","o23"],
//    "qs":[{"kind":"meaning","itemId":"o33","options":["o12","o33","o4"]},{"kind":"truefalse","sourceId":"o47"},...],
//    "step":2,"picks":[0,null,null]}
// ids = the words of the text (card ids, in reading order), qs = the questions (lib/practice/reading.ts, ids
// only: the sentences come from the corpus), step = where the round is (0 the text, 1..n question n, n+1 the
// "practice these words in sentences" step), picks = the option chosen per question (null = not answered yet).
// It is only resumed on the same local day and in the same direction; an older format (v1, the missing-word
// round) is not resumed, a new round starts. Pure logic plus two thin DB wrappers.

import type { PcicItem, PcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { resolveSet, type ReadingQuestion, type ReadingSet, type ReadingWord } from '@/lib/practice/reading';

export interface PracticeRound {
  v: 2;
  /** The local day the round was built (localDateString). */
  date: string;
  target: PcicTarget;
  ids: string[];
  qs: ReadingQuestion[];
  step: number;
  picks: (number | null)[];
}

/** A round read back for the screen. */
export interface ResumedRound {
  set: ReadingSet;
  step: number;
  picks: (number | null)[];
}

export function newPracticeRound(set: ReadingSet, target: PcicTarget, date: string): PracticeRound {
  return { v: 2, date, target, ids: set.words.map((w) => w.itemId), qs: set.questions, step: 0, picks: set.questions.map(() => null) };
}

const isId = (x: unknown): x is string => typeof x === 'string' && x !== '';

function validQuestion(q: any): q is ReadingQuestion {
  if (!q || typeof q !== 'object') return false;
  if (q.kind === 'truefalse') return isId(q.sourceId);
  if (q.kind !== 'meaning') return false;
  return isId(q.itemId) && Array.isArray(q.options) && q.options.length >= 2 && q.options.every(isId) && q.options.includes(q.itemId);
}

// A missing, broken or wrongly shaped value gives null (= no round to resume).
export function parsePracticeRound(raw: unknown): PracticeRound | null {
  if (typeof raw !== 'string' || raw === '') return null;
  let p: any;
  try {
    p = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!p || typeof p !== 'object' || p.v !== 2) return null;
  if (typeof p.date !== 'string' || (p.target !== 'es' && p.target !== 'en')) return null;
  if (!Array.isArray(p.ids) || p.ids.length === 0 || !p.ids.every(isId)) return null;
  if (!Array.isArray(p.qs) || p.qs.length === 0 || !p.qs.every(validQuestion)) return null;
  if (!Number.isInteger(p.step) || p.step < 0 || p.step > p.qs.length + 1) return null;
  if (!Array.isArray(p.picks) || p.picks.length !== p.qs.length) return null;
  // a pick is an option index: the options of a meaning question, True / False (0 / 1) of a true/false one
  const picksFit = p.picks.every((pick: unknown, i: number) => {
    if (pick === null) return true;
    const limit = p.qs[i].kind === 'meaning' ? p.qs[i].options.length : 2;
    return Number.isInteger(pick) && (pick as number) >= 0 && (pick as number) < limit;
  });
  if (!picksFit) return null;
  return { v: 2, date: p.date, target: p.target, ids: p.ids, qs: p.qs, step: p.step, picks: p.picks };
}

// The saved round as the screen resumes it, or null when a new one has to be built: nothing saved, another
// day, another direction, or a saved card that has no sentence any more. A question answered before the break
// comes back answered (its feedback and Next), it is never asked again.
export function restorePracticeRound(
  saved: PracticeRound | null,
  today: string,
  target: PcicTarget,
  wordFor: (itemId: string) => ReadingWord | null,
  findItem: (id: string) => PcicItem | undefined,
): ResumedRound | null {
  if (!saved || saved.date !== today || saved.target !== target) return null;
  const words: ReadingWord[] = [];
  for (const id of saved.ids) {
    const word = wordFor(id);
    if (!word) return null;
    words.push(word);
  }
  const set = resolveSet(words, saved.qs, findItem, target);
  return set ? { set, step: saved.step, picks: saved.picks } : null;
}

export async function loadPracticeRound(): Promise<PracticeRound | null> {
  return parsePracticeRound(await getDb().getPracticeRound());
}

/** null deletes the saved round (no reading to resume). */
export async function savePracticeRound(round: PracticeRound | null): Promise<void> {
  await getDb().setPracticeRound(round ? JSON.stringify(round) : null);
}
