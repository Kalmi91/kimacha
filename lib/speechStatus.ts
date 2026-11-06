import { useSyncExternalStore } from 'react';

export type SpeechPhase = 'idle' | 'loading' | 'playing' | 'noEngine' | 'noVoice' | 'failed';
type SpeechFailure = { phase: 'noEngine' | 'noVoice' | 'failed'; text: string };
let status = { id: 0, phase: 'idle' as SpeechPhase, text: '', error: null as SpeechFailure | null };
const listeners = new Set<() => void>();

export function speechStatus() {
  return status;
}

export function setSpeechStatus(id: number, phase: SpeechPhase, text = status.text) {
  if (id < status.id) return;
  const error = phase === 'noEngine' || phase === 'noVoice' || phase === 'failed'
    ? { phase, text }
    : id === status.id ? status.error : null;
  status = { id, phase, text, error };
  listeners.forEach((listener) => listener());
}

export function useSpeechStatus() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, speechStatus, speechStatus);
}

export function speechBusy(phase: SpeechPhase) {
  return phase === 'loading' || phase === 'playing';
}
