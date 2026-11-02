// Web twin of lib/neuralTts.ts: the web build keeps the browser's own speech, so
// nothing is ever "ready" here and the native package is never bundled.

import type { NeuralEngine, NeuralLang, NeuralVoice } from './neuralVoices';

export interface NeuralSpeakOptions {
  rate?: number;
  onDone?: () => void;
  onStopped?: () => void;
}

export interface NeuralTimings {
  firstChunkMs: number;
  generatedMs: number;
  audioMs: number;
  peak: number;
}

export function isNeuralReady(_lang: NeuralLang, _engine: NeuralEngine): boolean {
  return false;
}

export async function loadNeuralVoice(
  _voice: NeuralVoice,
  _lang: NeuralLang,
  _modelDir: string,
  _options: { numThreads?: number; debug?: boolean } = {},
): Promise<number> {
  return 0;
}

export async function releaseNeural(): Promise<void> {}

export function stopNeural(): void {}

export async function speakNeural(
  _text: string,
  _lang: NeuralLang,
  _voice: NeuralVoice,
  _options: NeuralSpeakOptions = {},
): Promise<NeuralTimings> {
  throw new Error('neural speech is not available on web');
}
