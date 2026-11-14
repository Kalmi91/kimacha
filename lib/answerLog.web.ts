import { MAX_ANSWER_ROWS, formatAnswerLog, isAnswerLogEntry, type AnswerLogEntry } from './answerLogFormat';

export { MAX_ANSWER_ROWS, type AnswerLogEntry } from './answerLogFormat';
const STORAGE_KEY = 'kimacha-answer-log';

function readEntries(): AnswerLogEntry[] {
  const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
  if (!saved) return [];
  try {
    const value: unknown = JSON.parse(saved);
    return Array.isArray(value) ? value.filter(isAnswerLogEntry).slice(-MAX_ANSWER_ROWS) : [];
  } catch { return []; }
}

export const answerLog = {
  append(entry: AnswerLogEntry): void {
    try {
      if (!isAnswerLogEntry(entry)) return;
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify([...readEntries(), entry].slice(-MAX_ANSWER_ROWS)));
    } catch { /* Diagnostic storage is best effort. */ }
  },
  recent(pair: string, limit = MAX_ANSWER_ROWS): AnswerLogEntry[] {
    try {
      if (!Number.isSafeInteger(limit) || limit <= 0) return [];
      return readEntries().filter(e => e.pair === pair).sort((a, b) => a.at - b.at).slice(-Math.min(limit, MAX_ANSWER_ROWS));
    } catch { return []; }
  },
  removeLast(pair: string, itemId: string): void {
    try {
      const entries = readEntries();
      const last = entries.map(e => e.pair).lastIndexOf(pair);
      if (last < 0 || entries[last].itemId !== itemId) return;
      entries.splice(last, 1);
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch { /* Diagnostic storage is best effort. */ }
  },
  exportText(): string {
    try { return formatAnswerLog(readEntries().sort((a, b) => a.at - b.at)); }
    catch { return ''; }
  },
};
