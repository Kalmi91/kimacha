import { Platform } from 'react-native';
import { getProcessExitReasons } from '../modules/app-diagnostics';
import { appLog } from './appLog';
import { errorEntry, type AppLogEntry } from './appLogFormat';

let installed = false;
let collecting: Promise<void> | null = null;

export function logError(event: AppLogEntry['event'], error: unknown, componentStack?: string | null): void {
  try {
    appLog.append(errorEntry(event, error, componentStack));
  } catch {
    // A full disk or a broken logger must never hide the original error.
  }
}

export function installErrorLogging(): void {
  if (installed) return;
  installed = true;
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    window.addEventListener('error', event => logError('js-error', event.error ?? event.message));
    window.addEventListener('unhandledrejection', event => logError('unhandled-rejection', event.reason));
    return;
  }
  if (typeof ErrorUtils !== 'undefined') {
    const previous = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      logError(isFatal ? 'js-fatal' : 'js-error', error);
      previous(error, isFatal);
    });
  }
  // Hermes only enables its default rejection tracker in development builds.
  if (!__DEV__) {
    const hermes = (globalThis as {
      HermesInternal?: { enablePromiseRejectionTracker?: (options: object) => void };
    }).HermesInternal;
    try {
      hermes?.enablePromiseRejectionTracker?.({
        allRejections: true,
        onUnhandled: (_id: number, error: unknown) => logError('unhandled-rejection', error),
      });
    } catch {
      // Older runtimes may not support rejection tracking.
    }
  }
}

export function collectProcessExits(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  collecting ??= (async () => {
    try {
      const exits = await getProcessExitReasons(appLog.lastExitTimestamp());
      appLog.recordExits(exits);
    } catch {
      // Older builds, Android < 30 and unavailable history are harmless.
    }
  })().finally(() => { collecting = null; });
  return collecting;
}
