import { useCallback, useEffect, useRef, useState } from 'react';

// A thin wrapper around expo-speech-recognition for the Situations mode (components/practice/SituationGame.tsx): one sentence by
// voice, final result only. Everything that can go wrong (no service on the device, the emulator, a denied microphone permission,
// a thrown native error) ends as `error` and never as an exception, so the screen can offer typing instead.
//
// The package is loaded with a guarded require: its native module is looked up when it is imported and the import throws where
// the module is not in the app (an APK built before the package was added, a dev client). The app must still open then, so
// without the module the wrapper is a no-op: not available, no events, start() reports an error. The screen then offers typing.

type Lib = typeof import('expo-speech-recognition');

/** The package, or null when it cannot be loaded (no native module). */
export function loadSpeechRecognition(load: () => Lib): Lib | null {
  try {
    return load();
  } catch {
    return null;
  }
}

// not an error for the learner: the recognition was cancelled by us
const QUIET_ERRORS = new Set(['aborted']);
// the microphone itself cannot be used: the screen says so and switches to typing; any other error is "try again"
const MIC_OFF_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported']);
// nothing was said: a hint to say it again
const NOTHING_HEARD_ERRORS = new Set(['no-speech', 'speech-timeout']);

/** The microphone cannot be used (denied permission, no service, no input, language missing): typing is the way. */
export const isMicOffError = (error: string) => MIC_OFF_ERRORS.has(error);
/** Nothing was heard: tap the microphone again. */
export const isNothingHeardError = (error: string) => NOTHING_HEARD_ERRORS.has(error);

export interface Recognizer {
  listening: boolean;
  /** Asks for the microphone permission (the first time) and starts listening. */
  start: () => Promise<void>;
  /** Stops listening; the result of what was said so far still comes. */
  stop: () => void;
  /** Closes the microphone and drops whatever result is still on its way (so it cannot land on the next line). */
  abort: () => void;
  /** Clears the error and the transcript. */
  reset: () => void;
  /** The last final result ('' until there is one, and again after start() / reset()). */
  transcript: string;
  /** The error code of the last start / listening ('not-allowed', 'no-speech', 'speech-timeout', 'network', ...), or null. */
  error: string | null;
}

const noEvents = (() => {}) as Lib['useSpeechRecognitionEvent'];

/**
 * The wrapper over `lib` (null = no native module). The module makes it once from the real package (below); a test makes
 * one of its own.
 */
export function createSpeechRecognition(lib: Lib | null) {
  const native = lib?.ExpoSpeechRecognitionModule;
  const useEvent = lib?.useSpeechRecognitionEvent ?? noEvents;

  /** Whether the device has a speech recognition service at all (false on an emulator without one, without the module, and on any error). */
  async function recognitionAvailable(): Promise<boolean> {
    try {
      return native?.isRecognitionAvailable() ?? false;
    } catch {
      return false;
    }
  }

  /**
   * Listens in `lang` (e.g. 'es-MX'). `onResult` gets the final transcript (the last callback passed is the one called);
   * it is not called for an empty result, nor for one that comes after abort().
   */
  function useRecognizer(lang: string, onResult?: (transcript: string) => void): Recognizer {
    const [listening, setListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);
    // the microphone is open (from start() until it ends or is aborted)
    const active = useRef(false);
    // a result is wanted: from start() until the final result or abort()
    const accepting = useRef(false);

    useEvent('start', () => {
      active.current = true;
      setListening(true);
    });
    useEvent('end', () => {
      active.current = false;
      setListening(false);
    });
    useEvent('result', (event) => {
      const text = event.results[0]?.transcript?.trim() ?? '';
      if (!accepting.current || !event.isFinal || !text) return;
      accepting.current = false;
      setTranscript(text);
      onResult?.(text);
    });
    useEvent('error', (event) => {
      active.current = false;
      accepting.current = false;
      setListening(false);
      if (!QUIET_ERRORS.has(event.error)) setError(event.error);
    });

    const abort = useCallback(() => {
      accepting.current = false;
      if (!active.current) return;
      active.current = false;
      setListening(false);
      try {
        native?.abort();
      } catch {
        // already closed by the service
      }
    }, []);
    // leaving the screen while the microphone is open closes it
    useEffect(() => abort, [abort]);

    const start = useCallback(async () => {
      setError(null);
      setTranscript('');
      if (!native) {
        setError('service-not-allowed');
        return;
      }
      try {
        const permission = await native.requestPermissionsAsync();
        if (!permission.granted) {
          setError('not-allowed');
          return;
        }
        accepting.current = true;
        active.current = true;
        native.start({ lang, interimResults: false, continuous: false, maxAlternatives: 1 });
      } catch {
        accepting.current = false;
        active.current = false;
        setError('service-not-allowed');
      }
    }, [lang]);

    const stop = useCallback(() => {
      try {
        native?.stop();
      } catch {
        setListening(false);
      }
    }, []);

    const reset = useCallback(() => {
      setError(null);
      setTranscript('');
    }, []);

    return { listening, start, stop, abort, reset, transcript, error };
  }

  return { recognitionAvailable, useRecognizer };
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded: the native module may be missing, see above
const speechRecognition = createSpeechRecognition(loadSpeechRecognition(() => require('expo-speech-recognition') as Lib));
export const { recognitionAvailable, useRecognizer } = speechRecognition;
