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

// The person every speech of `lang` without an explicit gender uses; undefined = Automatic (the text's own voice).
export function preferredGender(lang: NeuralLang): 'f' | 'm' | undefined {
  const choice = choices[lang];
  return choice === 'auto' ? undefined : choice;
}
