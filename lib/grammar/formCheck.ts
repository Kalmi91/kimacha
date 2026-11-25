import type { GrammarTopicData } from '../games/content';
import { tableCellsForLesson } from './tableDeck';
import { isConjugationTable } from './tableShape';

export const FORM_CHECK_TOPICS = ['indefinido-irregular'] as const;

export function formCheckEnabled(topicId: string, learnedLang: string): boolean {
  return learnedLang === 'es' && FORM_CHECK_TOPICS.some((id) => id === topicId);
}

const PERSONS = new Set(['yo', 'tú', 'él/ella/usted', 'nosotros', 'ellos/ellas/ustedes']);

export function formCheckCells(lesson: GrammarTopicData | null | undefined) {
  if (!lesson) return [];
  // Filter tables before extraction so a reference table cannot shadow a conjugation cell.
  return tableCellsForLesson({
    ...lesson,
    body: lesson.body.filter((block) => block.kind === 'table' && isConjugationTable(block.header, block.rows)),
  }, 'es').filter((cell) => PERSONS.has(cell.person.trim().toLowerCase()));
}

export type FormCheckCell = ReturnType<typeof formCheckCells>[number];
export type FormCheckPhase = 'check' | 'checkEnd' | 'practice' | 'practiceEnd';

export interface FormCheckState {
  version: 1;
  phase: FormCheckPhase;
  order: string[];
  index: number;
  wrong: { id: string; typed: string }[];
  queue: string[];
  streaks: Record<string, number>;
  done: string[];
  // Keep the checked answer until Next, including across leaving the screen.
  result: { id: string; typed: string; correct: boolean } | null;
}

export const formCheckProgressKey = (topicId: string) => `${topicId}:formcheck`;

export function freshFormCheckState(cells: readonly { id: string }[]): FormCheckState {
  return { version: 1, phase: 'check', order: cells.map((cell) => cell.id), index: 0, wrong: [], queue: [], streaks: {}, done: [], result: null };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((id) => typeof id === 'string') && new Set(value).size === value.length;
}

export function parseFormCheckState(raw: unknown, cells: readonly { id: string }[]): FormCheckState {
  const fresh = freshFormCheckState(cells);
  if (!isRecord(raw) || raw.version !== 1 || !isIds(raw.order) ||
      raw.order.length !== fresh.order.length || raw.order.some((id, i) => id !== fresh.order[i]) ||
      typeof raw.phase !== 'string' || !['check', 'checkEnd', 'practice', 'practiceEnd'].includes(raw.phase) ||
      typeof raw.index !== 'number' || !Number.isInteger(raw.index) || raw.index < 0 || raw.index > cells.length ||
      !Array.isArray(raw.wrong) || !isIds(raw.queue) || !isIds(raw.done) || !isRecord(raw.streaks)) return fresh;

  const valid = new Set(fresh.order);
  const wrong: FormCheckState['wrong'] = [];
  for (const miss of raw.wrong) {
    if (!isRecord(miss) || typeof miss.id !== 'string' || typeof miss.typed !== 'string') return fresh;
    if (valid.has(miss.id) && !wrong.some((entry) => entry.id === miss.id)) wrong.push({ id: miss.id, typed: miss.typed });
  }
  const missing = new Set(wrong.map((miss) => miss.id));
  const done = raw.done.filter((id) => missing.has(id));
  const queue = raw.queue.filter((id) => missing.has(id) && !done.includes(id));
  const streaks: Record<string, number> = {};
  for (const id of queue) {
    const streak = raw.streaks[id];
    if (streak !== 0 && streak !== 1) return fresh;
    streaks[id] = streak;
  }
  for (const id of done) streaks[id] = 2;
  const phase = raw.phase as FormCheckPhase;
  if ((phase === 'check' && raw.index >= cells.length) || (phase !== 'check' && raw.index !== cells.length) ||
      (phase === 'check' && wrong.some((miss) => fresh.order.indexOf(miss.id) >= (raw.index as number))) ||
      ((phase === 'check' || phase === 'checkEnd') && (queue.length > 0 || done.length > 0)) ||
      ((phase === 'practice' || phase === 'practiceEnd') && queue.length + done.length !== wrong.length) ||
      (phase === 'practiceEnd' && queue.length > 0)) return fresh;

  let result: FormCheckState['result'] = null;
  if (raw.result !== null && raw.result !== undefined) {
    const answer = raw.result;
    const currentId = phase === 'check' ? fresh.order[raw.index] : phase === 'practice' ? queue[0] : undefined;
    if (!currentId || !isRecord(answer) || answer.id !== currentId || typeof answer.typed !== 'string' || typeof answer.correct !== 'boolean') return fresh;
    result = { id: currentId, typed: answer.typed, correct: answer.correct };
  }
  return { ...fresh, phase: phase === 'practice' && queue.length === 0 ? 'practiceEnd' : phase, index: raw.index, wrong, queue, streaks, done, result };
}

export function answerFormCheck(state: FormCheckState, correct: boolean, typed: string): FormCheckState {
  if (state.phase === 'check') {
    const id = state.order[state.index];
    if (!id) return state;
    const index = state.index + 1;
    return { ...state, index, wrong: correct ? state.wrong : [...state.wrong, { id, typed }], phase: index === state.order.length ? 'checkEnd' : 'check', result: null };
  }
  if (state.phase !== 'practice' || state.queue.length === 0) return state;
  const [id, ...queue] = state.queue;
  const streak = correct ? (state.streaks[id] ?? 0) + 1 : 0;
  const done = streak >= 2 ? [...state.done, id] : state.done;
  if (streak < 2) queue.splice(Math.min(3, queue.length), 0, id);
  return { ...state, queue, streaks: { ...state.streaks, [id]: streak }, done, phase: queue.length === 0 ? 'practiceEnd' : 'practice', result: null };
}

export function startFormCheckPractice(state: FormCheckState): FormCheckState {
  if (state.phase !== 'checkEnd' || state.wrong.length === 0) return state;
  const queue = state.wrong.map((miss) => miss.id);
  return { ...state, phase: 'practice', queue, streaks: Object.fromEntries(queue.map((id) => [id, 0])), done: [], result: null };
}
