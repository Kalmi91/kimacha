// Web twin of lib/neuralModels.ts: the web build keeps the browser's own speech, so the better voice does
// not exist here (the Settings row is hidden, `supported` is false) and nothing is ever downloaded.

import { useSyncExternalStore } from 'react';
import { DEFAULT_ENGINES, type NeuralEngine, type NeuralLang, type SpeakerChoice, type VoiceGender } from './neuralVoices';
import { setSpeakerChoice } from './voicePreference';
import type { NeuralState } from './neuralModels';

const state: NeuralState = {
  supported: false,
  ready: true,
  enabled: false,
  engines: { ...DEFAULT_ENGINES },
  installed: {},
  download: { running: false, percent: 0, phase: 'download', failed: [] },
};

export function getNeuralState(): NeuralState {
  return state;
}

export function useNeuralState(): NeuralState {
  return useSyncExternalStore(() => () => {}, () => state, () => state);
}

export async function startNeural(): Promise<void> {}

export function neuralEngineFor(_lang: NeuralLang): NeuralEngine | null {
  return null;
}

export function neuralPackFile(_lang: NeuralLang, _text: string): string | null {
  return null;
}

export function neuralSentenceFile(_lang: NeuralLang, _text: string, _gender?: VoiceGender): string | null {
  return null;
}

export function setNeuralSpeaker(lang: NeuralLang, choice: SpeakerChoice): void {
  setSpeakerChoice(lang, choice); // in memory only: nothing is saved on the web
}

export async function setNeuralEnabled(_enabled: boolean): Promise<void> {}

export async function setNeuralEngine(_lang: NeuralLang, _engine: NeuralEngine): Promise<void> {}

export async function downloadNeural(): Promise<void> {}
