import { appBuildTag } from './appBuild';

export const MAX_LOG_ROWS = 500;

export interface ProcessExit {
  timestamp: number;
  reason: number;
  description: string | null;
  pssKb: number;
  rssKb: number;
}

export interface AppLogEntry {
  timestamp: number;
  version: string;
  event: 'js-error' | 'js-fatal' | 'unhandled-rejection' | 'render-error' | 'process-exit';
  message: string;
  stack: string;
}

// Never attach learner state, answers, requests or arbitrary objects to the log.
// Strip common dynamic values from exception messages before writing to disk.
export function diagnosticText(text: string): string {
  return text
    .replace(/https?:\/\/\S+|file:\/\/\S+/gi, '[url]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email]')
    .replace(/(?:[A-Z]:\\|\/(?:data|storage|Users|home)\/)[^\s)]+/gi, '[path]')
    .replace(/\{[^\n]*\}|\[["'\d{][^\n]*\]/g, '[data]')
    .replace(/(["'`])[^\n]*?\1/g, '[value]')
    .replace(/\b(token|pin|password|answer|word)\s*[:=]\s*\S+/gi, '$1=[value]')
    .slice(0, 2000);
}

export function errorEntry(event: AppLogEntry['event'], error: unknown, componentStack?: string | null): AppLogEntry {
  // Objects can hold a whole exercise or request. Never stringify them.
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';
  // The first line of Error.stack repeats the message. Only keep code locations.
  const frames = error instanceof Error ? error.stack?.split('\n').slice(1, 9).join('\n') : '';
  return {
    timestamp: Date.now(),
    version: appBuildTag(),
    event,
    message: diagnosticText(message),
    stack: diagnosticText([frames, componentStack?.split('\n').slice(0, 8).join('\n')].filter(Boolean).join('\n')
      .replace(/(?:[A-Z]:\\|(?:https?|file):\/\/|\/(?:data|storage|Users|home)\/)[^\s)]+/gi,
        path => path.split(/[\\/]/).pop()!.split(/[?#]/)[0])),
  };
}

const EXIT_REASONS = [
  'unknown', 'exit-self', 'signaled', 'low-memory', 'crash', 'crash-native', 'anr',
  'initialization-failure', 'permission-change', 'excessive-resource-usage',
  'user-requested', 'user-stopped', 'dependency-died', 'other', 'freezer', 'package-state-change', 'package-updated',
];

export function exitEntry(exit: ProcessExit): AppLogEntry {
  return {
    timestamp: exit.timestamp,
    version: appBuildTag(),
    event: 'process-exit',
    message: `reason=${exit.reason} (${EXIT_REASONS[exit.reason] ?? 'unknown'}); pssKb=${exit.pssKb}; rssKb=${exit.rssKb}; ${diagnosticText(exit.description ?? '')}`,
    stack: '',
  };
}

export function newProcessExits(exits: ProcessExit[], seen: number): ProcessExit[] {
  return exits.filter(exit => Number.isFinite(exit.timestamp) && exit.timestamp > seen)
    .sort((a, b) => b.timestamp - a.timestamp).slice(0, 10).sort((a, b) => a.timestamp - b.timestamp);
}

export function formatAppLog(entries: AppLogEntry[]): string {
  return ['Kimacha diagnostics', ...entries.map(entry =>
    `${new Date(entry.timestamp).toISOString()} ${entry.version} ${entry.event}\n${entry.message}${entry.stack ? `\n${entry.stack}` : ''}`,
  )].join('\n\n') + '\n';
}
