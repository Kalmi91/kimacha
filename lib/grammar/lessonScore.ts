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

// ---------------------------------------------------------------------------
// FB415 / FB420 / FB421 (PLAN-fb0929 4. lépés), Kálmán 2026-09-29: a lecke %-a a
// lecke ÖSSZES feladat-fajtájának átlaga (a még meg nem csinált fajta 0), a
// félbehagyott feladat elmentődik és onnan folytatódik, a jobb eredmény felülírja
// a régit. A tárolás ugyanaz a game_progress tábla (`grammar-course`), két új
// sor-fajtával fajtánként:
//   `${topic}:${kind}:best`  state 'best'  data {correct, total}   (a legjobb befejezett kör)
//   `${topic}:${kind}:run`   state 'run'   data KindRun | null     (a félbehagyott kör)
// A régi kumulált számlálók (`${topic}:${kind}:answered` / `:correct`) csak
// tartalékként olvasódnak (amíg a fajtának nincs sem best-, sem run-sora), hogy a
// meglévő haladás ne tűnjön el.

export type ScoredKind = 'choice' | 'match' | 'form' | 'why' | 'transform';

export interface KindBest {
  correct: number;
  total: number;
}

/** Egy félbehagyott kör: ugyanaz a kör folytatható (seed + item-id lista), `index` a már megválaszolt tételek száma. */
export interface KindRun {
  seed: number;
  ids: string[];
  index: number;
  /** A jó válaszok száma egységekben (a párosításnál a jó párok), ld. GrammarDrill. */
  correct: number;
  /** A teljes kör egységekben (a párosításnál az összes pár). */
  total: number;
}

export interface KindProgress {
  best: KindBest | null;
  run: KindRun | null;
  legacy: KindBest | null;
}

export const NO_KIND_PROGRESS: KindProgress = { best: null, run: null, legacy: null };

const ratioPercent = (correct: number, total: number): number | null =>
  total > 0 ? Math.round((correct / total) * 100) : null;

/**
 * Egy feladat-fajta %-a: a legjobb befejezett kör és a most félbehagyott kör közül
 * a jobb (a meg nem válaszolt tétel 0-nak számít, ezért 3 jó a 10-ből = 30%).
 * `null`: a fajtát még nem kezdte el. Csak ha nincs best/run, jön a régi számláló.
 */
export function kindPercent(p: KindProgress): number | null {
  const candidates: number[] = [];
  if (p.best) {
    const v = ratioPercent(p.best.correct, p.best.total);
    if (v !== null) candidates.push(v);
  }
  if (p.run) {
    const v = ratioPercent(p.run.correct, p.run.total);
    if (v !== null) candidates.push(v);
  }
  if (candidates.length === 0 && p.legacy) {
    const v = ratioPercent(p.legacy.correct, p.legacy.total);
    if (v !== null) candidates.push(v);
  }
  return candidates.length > 0 ? Math.max(...candidates) : null;
}

/** A lecke %-a: az ÖSSZES fajta átlaga, a meg nem kezdett fajta 0. `null`, ha egyikhez sem nyúlt. */
export function lessonScore(kinds: KindProgress[]): number | null {
  if (kinds.length === 0) return null;
  const percents = kinds.map(kindPercent);
  if (percents.every((v) => v === null)) return null;
  const sum = percents.reduce<number>((acc, v) => acc + (v ?? 0), 0);
  return Math.round(sum / kinds.length);
}

/** A jobb eredmény felülírja a régit; egyenlő aránynál a régi marad. */
export function betterBest(old: KindBest | null, next: KindBest): KindBest {
  if (!old) return next;
  const a = ratioPercent(old.correct, old.total) ?? -1;
  const b = ratioPercent(next.correct, next.total) ?? -1;
  return b > a ? next : old;
}

/** A lecke-képernyő fajta-gombja alatti sor "3/10 · 30%" alakja (csak félbehagyott körnél). */
export function runSummary(run: KindRun): { answered: number; of: number; percent: number } {
  return { answered: run.index, of: run.ids.length, percent: ratioPercent(run.correct, run.total) ?? 0 };
}

interface Row {
  itemId: string;
  state: string;
  data: unknown;
}

function isKindBest(v: unknown): v is KindBest {
  const o = v as KindBest | null;
  return !!o && typeof o.correct === 'number' && typeof o.total === 'number';
}

function isKindRun(v: unknown): v is KindRun {
  const o = v as KindRun | null;
  return (
    !!o &&
    typeof o.seed === 'number' &&
    Array.isArray(o.ids) &&
    typeof o.index === 'number' &&
    typeof o.correct === 'number' &&
    typeof o.total === 'number'
  );
}

export const kindBestKey = (topicId: string, kind: ScoredKind) => `${topicId}:${kind}:best`;
export const kindRunKey = (topicId: string, kind: ScoredKind) => `${topicId}:${kind}:run`;

/** Egy lecke egy fajtájának tárolt haladása a game_progress sorokból. */
export function kindProgressFromRows(rows: Row[], topicId: string, kind: ScoredKind): KindProgress {
  let best: KindBest | null = null;
  let run: KindRun | null = null;
  let answered: number | null = null;
  let correct: number | null = null;
  const bestKey = kindBestKey(topicId, kind);
  const runKey = kindRunKey(topicId, kind);
  const answeredKey = `${topicId}:${kind}:answered`;
  const correctKey = `${topicId}:${kind}:correct`;
  for (const row of rows) {
    if (row.itemId === bestKey && row.state === 'best' && isKindBest(row.data)) best = row.data;
    else if (row.itemId === runKey && row.state === 'run' && isKindRun(row.data)) run = row.data;
    else if (row.itemId === answeredKey && row.state === 'count' && typeof row.data === 'number') answered = row.data;
    else if (row.itemId === correctKey && row.state === 'count' && typeof row.data === 'number') correct = row.data;
  }
  const legacy = answered !== null && answered > 0 ? { correct: correct ?? 0, total: answered } : null;
  return { best, run, legacy };
}

/**
 * A szillabusz-lista minden lecke-%-a egy menetben. `kindsOf` a lecke létező
 * feladat-fajtáit adja (üres: ismeretlen lecke). Ahol a lecke fajta-szintű sorai
 * hiányoznak (a FB380 előtti adat), a régi témaszintű számláló a tartalék.
 */
export function lessonScoresByTopic(rows: Row[], kindsOf: (topicId: string) => ScoredKind[]): Map<string, number> {
  const topics = new Set<string>();
  for (const row of rows) {
    const m = row.itemId.match(/^(.+?):(choice|match|form|why|transform):(best|run|answered|correct)$/);
    if (m) topics.add(m[1]);
  }
  const legacyByTopic = lessonPercentsByTopic(rows);
  const result = new Map<string, number>();
  for (const topicId of topics) {
    const kinds = kindsOf(topicId);
    const score = kinds.length > 0 ? lessonScore(kinds.map((k) => kindProgressFromRows(rows, topicId, k))) : null;
    if (score !== null) result.set(topicId, score);
  }
  for (const [topicId, pct] of legacyByTopic) {
    if (!result.has(topicId)) result.set(topicId, pct);
  }
  return result;
}
