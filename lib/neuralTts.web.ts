// Web twin of lib/neuralTts.ts: the web build keeps the browser's own speech, so
// nothing is ever "ready" here and the native package is never bundled.

export type NeuralLang = 'es' | 'en' | 'hu';
export type NeuralModelKey = 'kokoro' | 'berta' | 'imre';
export type NeuralModelDirs = Partial<Record<NeuralModelKey, string>>;

export interface NeuralVoice {
  id: string;
  model: NeuralModelKey;
  sid: number;
}

export const NEURAL_VOICES: Record<NeuralLang, NeuralVoice[]> = { es: [], en: [], hu: [] };

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

export function isNeuralReady(_lang: NeuralLang): boolean {
  return false;
}

export function hasNeuralVoice(_lang: NeuralLang, _voiceId: string): boolean {
  return false;
}

export async function initNeural(
  _modelDirs: NeuralModelDirs,
  _options: { numThreads?: number; debug?: boolean } = {},
): Promise<Partial<Record<NeuralModelKey, number>>> {
  return {};
}

export function stopNeural(): void {}

export async function speakNeural(
  _text: string,
  _lang: NeuralLang,
  _voiceId: string,
  _options: NeuralSpeakOptions = {},
): Promise<NeuralTimings> {
  throw new Error('neural speech is not available on web');
}

export async function runNeuralSelfTest(): Promise<void> {}
