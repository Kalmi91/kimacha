// FB328 (grammar-syllabus), Kálmán 2026-09-21: "legyen kiírva egy százalék
// szám, hogy a feladatok hányszázalékára sikerült jó választ adni". Pure
// helpers: the game_progress `${topic}:answered`/`${topic}:correct` counters
// (written in app/grammar/[topic].tsx's `finish`, one round at a time, every
// kind) turn into one cumulative lesson percentage.

/** `null` when nothing has been answered yet, otherwise the rounded percent. */
export function lessonPercent(answered: number, correct: number): number | null {
  if (answered === 0) return null;
  return Math.round((correct / answered) * 100);
}

interface ProgressRow {
  itemId: string;
  state: string;
  data: unknown;
}

// The syllabus screen needs every topic's percent in one pass over the same
// `db.getGameProgress(GRAMMAR_PROGRESS_KEY)` rows it already fetches for
// `doneGrammarTopicProgress` (lib/grammar/syllabus.ts), so this reads the
// `${topic}:answered`/`${topic}:correct` rows (state `'count'`, `data` a
// plain number) the same way that function reads `${topic}:${kind}` `'done'`
// rows, ignoring every other state.
export function lessonPercentsByTopic(rows: ProgressRow[]): Map<string, number> {
  const answered = new Map<string, number>();
  const correct = new Map<string, number>();
  for (const row of rows) {
    if (row.state !== 'count') continue;
    const sep = row.itemId.lastIndexOf(':');
    if (sep < 0) continue;
    const topicId = row.itemId.slice(0, sep);
    const field = row.itemId.slice(sep + 1);
    const n = typeof row.data === 'number' ? row.data : 0;
    if (field === 'answered') answered.set(topicId, n);
    else if (field === 'correct') correct.set(topicId, n);
  }
  const result = new Map<string, number>();
  for (const [topicId, a] of answered) {
    const pct = lessonPercent(a, correct.get(topicId) ?? 0);
    if (pct !== null) result.set(topicId, pct);
  }
  return result;
}

// FB328, Kálmán 2026-09-21: the syllabus row's single badge percent. The
// cumulative counters win when they exist; a topic marked `done` before FB328
// added them has no `${topic}:answered`/`${topic}:correct` rows yet, so the
// badge falls back to that topic's last round result instead of showing
// nothing.
export function lessonBadgePercent(
  cumulative: number | null,
  roundCorrect?: number,
  roundTotal?: number
): number | null {
  if (cumulative !== null) return cumulative;
  if (roundTotal !== undefined && roundTotal > 0) {
    return Math.round(((roundCorrect ?? 0) / roundTotal) * 100);
  }
  return null;
}
