// Web twin of lib/voiceSample.ts: the web build keeps the browser's own speech and has no Better voice card,
// so the samples are native only and nothing plays here.

import type { NeuralEngine, NeuralLang } from './neuralVoices';
import type { SampleGender, SampleKey } from './voiceSampleData';

export function getSamplePlaying(): SampleKey | null {
  return null;
}

export function useSamplePlaying(): SampleKey | null {
  return null;
}

export function stopVoiceSample(): void {}

export function playVoiceSample(_lang: NeuralLang, _engine: NeuralEngine, _gender: SampleGender): void {}
