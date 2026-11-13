import { MAX_LOG_ROWS, formatAppLog, type AppLogEntry } from './appLogFormat';

const STORAGE_KEY = 'kimacha-diagnostics';

function readEntries(): AppLogEntry[] {
  const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
  if (!saved) return [];
  try {
    const entries: AppLogEntry[] = JSON.parse(saved);
    return Array.isArray(entries) ? entries.slice(-MAX_LOG_ROWS) : [];
  } catch {
    return [];
  }
}

export const appLog = {
  append(entry: AppLogEntry): void {
    const entries = [...readEntries(), entry].slice(-MAX_LOG_ROWS);
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(entries));
  },
  lastExitTimestamp(): number { return 0; },
  recordExits(): void {},
  exportText(): string { return formatAppLog(readEntries()); },
};
