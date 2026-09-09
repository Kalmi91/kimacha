// Listening to the learner speak, for the oral paper of the mock exam.
//
// Kálmán, 2026-09-09: „az utolsó rész a 4-ből, azt kellene úgy megcsinálni, hogy
// rá tudjak beszélni és akkor felismeri hogy mit mondok, leírja, és az alapján
// osztályozza le." Until now the speaking paper was self-assessed (0/1/2), which
// is honest but not a mark.
//
// What this can and cannot do, stated once so the app can say it out loud:
// the platform recognizers (Android SpeechRecognizer, iOS SFSpeechRecognizer)
// snap what they hear onto the nearest REAL word of the chosen language. So the
// transcript measures CONTENT, not pronunciation: a heavy accent that still gets
// recognized scores full marks, and a perfect sentence the recognizer misses
// scores nothing. That is why the self-rating stays as a fallback in the UI.
//
// The native module is loaded lazily and defensively: `expo-speech-recognition`
// calls `requireNativeModule` at import time, which throws where the native side
// is not linked (jest, web, a dev client built before this dependency landed).
// Every entry point here answers "not available" in that case instead of
// crashing the exam.

import { Platform } from 'react-native';

/** One result event, in the shape the native module emits. */
export interface RecognitionResultEvent {
  isFinal: boolean;
  results: { transcript: string; confidence: number }[];
}

export interface RecognitionErrorEvent {
  error: string;
  message?: string;
}

interface Subscription {
  remove: () => void;
}

interface RecognitionModule {
  start: (options: Record<string, unknown>) => void;
  stop: () => void;
  abort: () => void;
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  addListener: (event: string, listener: (payload: never) => void) => Subscription;
}

let cached: RecognitionModule | null | undefined;

function nativeModule(): RecognitionModule | null {
  if (cached !== undefined) return cached;
  try {
    // Inline require: the module must not be touched at import time (see above).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-speech-recognition') as { ExpoSpeechRecognitionModule?: RecognitionModule };
    cached = mod?.ExpoSpeechRecognitionModule ?? null;
  } catch {
    cached = null;
  }
  return cached;
}

/** Tests inject a fake recognizer; pass `undefined` to go back to the real one. */
export function __setRecognitionModule(mod: RecognitionModule | null | undefined): void {
  cached = mod;
}

export function isRecognitionAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  return nativeModule() !== null;
}

export async function requestRecognitionPermission(): Promise<boolean> {
  const mod = nativeModule();
  if (!mod) return false;
  try {
    const result = await mod.requestPermissionsAsync();
    return Boolean(result?.granted);
  } catch {
    return false;
  }
}

/**
 * In continuous mode a final result covers only the NEW utterance, and an
 * interim result covers only the segment being spoken right now (README,
 * "Continuous recognition"). So the running transcript is the finals joined,
 * plus the live interim on the end.
 */
export function mergeTranscript(finals: string[], interim: string): string {
  return [...finals, interim]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');
}

export interface RecognitionHandlers {
  /** Fires on every change of the running transcript, interim included. */
  onTranscript: (text: string) => void;
  onError?: (event: RecognitionErrorEvent) => void;
  onEnd?: () => void;
}

export interface RecognitionSession {
  /** Asks for a final result and ends the session. */
  stop: () => void;
  /** Drops the session without a final result (card unmounted, timer over). */
  cancel: () => void;
}

/**
 * Starts listening in `lang` and reports the running transcript.
 * Returns null when there is no recognizer or the permission was refused.
 *
 * `contextualStrings` are the words the task expects (names, places): the
 * recognizer weighs them higher, which is exactly what an exam prompt needs.
 */
export async function startRecognition(
  lang: string,
  handlers: RecognitionHandlers,
  contextualStrings?: string[],
): Promise<RecognitionSession | null> {
  const mod = nativeModule();
  if (!mod) return null;
  if (!(await requestRecognitionPermission())) return null;

  const finals: string[] = [];
  const subscriptions: Subscription[] = [];
  let closed = false;

  const closeSubscriptions = () => {
    for (const sub of subscriptions) {
      try {
        sub.remove();
      } catch {
        // A listener that is already gone is not a failure worth surfacing.
      }
    }
    subscriptions.length = 0;
  };

  subscriptions.push(
    mod.addListener('result', ((event: RecognitionResultEvent) => {
      const text = event?.results?.[0]?.transcript ?? '';
      if (event?.isFinal) {
        if (text.trim()) finals.push(text);
        handlers.onTranscript(mergeTranscript(finals, ''));
      } else {
        handlers.onTranscript(mergeTranscript(finals, text));
      }
    }) as (payload: never) => void),
  );

  subscriptions.push(
    mod.addListener('error', ((event: RecognitionErrorEvent) => {
      handlers.onError?.(event);
    }) as (payload: never) => void),
  );

  subscriptions.push(
    mod.addListener('end', (() => {
      if (closed) return;
      closed = true;
      closeSubscriptions();
      handlers.onEnd?.();
    }) as (payload: never) => void),
  );

  try {
    mod.start({
      lang,
      interimResults: true,
      // An exam answer is one to two minutes of speech with pauses in it, so the
      // session must survive silence instead of closing on the first gap.
      continuous: true,
      maxAlternatives: 1,
      ...(contextualStrings?.length ? { contextualStrings } : {}),
    });
  } catch (err) {
    closed = true;
    closeSubscriptions();
    handlers.onError?.({ error: 'start-failed', message: String(err) });
    return null;
  }

  return {
    stop: () => {
      try {
        mod.stop();
      } catch {
        // Nothing to stop; the `end` listener has already cleaned up.
      }
    },
    cancel: () => {
      closed = true;
      closeSubscriptions();
      try {
        mod.abort();
      } catch {
        // As above.
      }
    },
  };
}
