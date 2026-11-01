import { useCallback, useEffect, useRef, useState } from 'react';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

// A thin wrapper around expo-speech-recognition for the Situations mode (components/practice/SituationGame.tsx): one sentence by
// voice, final result only. Everything that can go wrong (no service on the device, the emulator, a denied microphone permission,
// a thrown native error) ends as `error` and never as an exception, so the screen can offer typing instead.

/** Whether the device has a speech recognition service at all (false on an emulator without one, and on any error). */
export async function recognitionAvailable(): Promise<boolean> {
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

// not an error for the learner: the recognition was cancelled by us ('no-speech' is one: the screen says nothing was heard)
const QUIET_ERRORS = new Set(['aborted']);

export interface Recognizer {
  listening: boolean;
  /** Asks for the microphone permission (the first time) and starts listening. */
  start: () => Promise<void>;
  /** Stops listening; the result of what was said so far still comes. */
  stop: () => void;
  /** The last final result ('' until there is one, and again after start()). */
  transcript: string;
  /** The error code of the last start / listening ('not-allowed', 'no-speech', 'service-not-allowed', ...), or null. */
  error: string | null;
}

/**
 * Listens in `lang` (e.g. 'es-MX'). `onResult` gets the final transcript (the last callback passed is the one called);
 * it is not called for an empty result.
 */
export function useRecognizer(lang: string, onResult?: (transcript: string) => void): Recognizer {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const active = useRef(false);

  useSpeechRecognitionEvent('start', () => {
    active.current = true;
    setListening(true);
  });
  useSpeechRecognitionEvent('end', () => {
    active.current = false;
    setListening(false);
  });
  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript?.trim() ?? '';
    if (!event.isFinal || !text) return;
    setTranscript(text);
    onResult?.(text);
  });
  useSpeechRecognitionEvent('error', (event) => {
    active.current = false;
    setListening(false);
    if (!QUIET_ERRORS.has(event.error)) setError(event.error);
  });

  // leaving the screen while the microphone is open closes it
  useEffect(
    () => () => {
      if (!active.current) return;
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // already closed by the service
      }
    },
    [],
  );

  const start = useCallback(async () => {
    setError(null);
    setTranscript('');
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setError('not-allowed');
        return;
      }
      ExpoSpeechRecognitionModule.start({ lang, interimResults: false, continuous: false, maxAlternatives: 1 });
    } catch {
      setError('service-not-allowed');
    }
  }, [lang]);

  const stop = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      setListening(false);
    }
  }, []);

  return { listening, start, stop, transcript, error };
}
