// Settings -> Voice: which person speaks, per language. The choice lives here (no native imports, so lib/speech.ts,
// lib/cardSpeaker.ts and the jest tests use it as it is); lib/neuralModels.ts loads it from the better voice's
// settings.json at start and writes it back when the learner changes it.

import { useSyncExternalStore } from 'react';
import { DEFAULT_SPEAKERS, type NeuralLang, type SpeakerChoice, type SpeakerChoices } from './neuralVoices';

let choices: SpeakerChoices = { ...DEFAULT_SPEAKERS };
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

// FB633: lib/speech.ts drops its per-language phone voice lock when the learner changes a voice setting.
export function onVoiceSettingsChange(fn: () => void): () => void {
  return subscribe(fn);
}

export function getSpeakerChoices(): SpeakerChoices {
  return choices;
}

export function setSpeakerChoices(next: SpeakerChoices): void {
  choices = next;
  listeners.forEach(fn => fn());
}

export function setSpeakerChoice(lang: NeuralLang, choice: SpeakerChoice): void {
  if (choices[lang] === choice) return;
  setSpeakerChoices({ ...choices, [lang]: choice });
}

export function useSpeakerChoices(): SpeakerChoices {
  return useSyncExternalStore(subscribe, () => choices, () => choices);
}

// Settings -> Voice, "Fast fallback": when the picked person has no recording of a text, the existing recording of
// the other person plays at once instead of a slower generated one. Default on.
// Temporary until EJSZAKA E101 (both voices recorded), Kálmán 2026-11-03.
let fastFallback = true;

export function getFastFallback(): boolean {
  return fastFallback;
}

export function setFastFallback(on: boolean): void {
  if (fastFallback === on) return;
  fastFallback = on;
  listeners.forEach(fn => fn());
}

export function useFastFallback(): boolean {
  return useSyncExternalStore(subscribe, () => fastFallback, () => fastFallback);
}

// The person every speech of `lang` without an explicit gender uses; undefined = Automatic (the text's own voice).
export function preferredGender(lang: NeuralLang): 'f' | 'm' | undefined {
  const choice = choices[lang];
  return choice === 'auto' ? undefined : choice;
}
