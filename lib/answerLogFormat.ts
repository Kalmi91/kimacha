export const MAX_ANSWER_ROWS = 2000;

export interface AnswerLogEntry {
  at: number;
  pair: string;
  itemId: string;
  thinkMs: number;
  knew: boolean;
}

export function isAnswerLogEntry(value: unknown): value is AnswerLogEntry {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<AnswerLogEntry>;
  return typeof v.at === 'number' && Number.isFinite(v.at) && Math.abs(v.at) <= 8.64e15
    && typeof v.pair === 'string' && typeof v.itemId === 'string'
    && typeof v.thinkMs === 'number' && Number.isFinite(v.thinkMs) && v.thinkMs >= 0 && typeof v.knew === 'boolean';
}

export function formatAnswerLog(entries: AnswerLogEntry[]): string {
  if (!entries.length) return '';
  return 'Answer log\n' + entries.map(e => `${new Date(e.at).toISOString()} ${e.pair} ${e.itemId} thinkMs=${e.thinkMs} knew=${e.knew ? 1 : 0}\n`).join('');
}
