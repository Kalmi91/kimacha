// On-device neural speech (react-native-sherpa-onnx, sherpa-onnx under the hood).
// Native only: lib/neuralTts.web.ts is the no-op twin Metro picks for the web build.
//
// Voices (two per language, the caller alternates between them):
//   es  Kokoro em_alex, ef_dora        en  Kokoro af_heart, am_michael
//   hu  Piper hu_HU-berta-medium, hu_HU-imre-medium (two separate single-speaker models)
//
// Kokoro speaker ids come from the model's own ONNX metadata (`speaker2id` of
// kokoro-int8-multi-lang-v1_0/model.int8.onnx, 54 voices, 24 kHz):
//   af_heart=3  am_michael=16  ef_dora=28  em_alex=29  (em_santa=53, added last)
// The Piper models have one speaker, sid 0.
//
// The package is loaded lazily (dynamic import inside the functions), so merely
// importing this file, e.g. from a jest test, never touches the native module.

import { Platform } from 'react-native';
import type { StreamingTtsEngine, TtsStreamController } from 'react-native-sherpa-onnx/tts';

export type NeuralLang = 'es' | 'en' | 'hu';
export type NeuralModelKey = 'kokoro' | 'berta' | 'imre';
export type NeuralModelDirs = Partial<Record<NeuralModelKey, string>>;

export interface NeuralVoice {
  id: string;
  model: NeuralModelKey;
  sid: number;
}

export const NEURAL_VOICES: Record<NeuralLang, NeuralVoice[]> = {
  es: [
    { id: 'em_alex', model: 'kokoro', sid: 29 },
    { id: 'ef_dora', model: 'kokoro', sid: 28 },
  ],
  en: [
    { id: 'af_heart', model: 'kokoro', sid: 3 },
    { id: 'am_michael', model: 'kokoro', sid: 16 },
  ],
  hu: [
    { id: 'berta', model: 'berta', sid: 0 },
    { id: 'imre', model: 'imre', sid: 0 },
  ],
};

export interface NeuralSpeakOptions {
  /** Speech speed multiplier of the engine (1 = normal). */
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

// AudioTrack is written in blocking mode, so when the last write returns the
// audio still sitting in the track buffer has not been heard yet.
const PCM_TAIL_MS = 400;

const engines: Partial<Record<NeuralModelKey, StreamingTtsEngine>> = {};
const sampleRates: Partial<Record<NeuralModelKey, number>> = {};

interface ActiveRun {
  engine: StreamingTtsEngine;
  controller: TtsStreamController | null;
  timer: ReturnType<typeof setTimeout> | null;
  finished: boolean;
  onStopped?: () => void;
}
let active: ActiveRun | null = null;
let runCounter = 0;

const now = () => Date.now();

function isSupported(): boolean {
  return Platform.OS === 'android';
}

export function isNeuralReady(lang: NeuralLang): boolean {
  return NEURAL_VOICES[lang].some(v => engines[v.model] !== undefined);
}

export function hasNeuralVoice(lang: NeuralLang, voiceId: string): boolean {
  const voice = NEURAL_VOICES[lang].find(v => v.id === voiceId);
  return !!voice && engines[voice.model] !== undefined;
}

// Loads the models whose directory is given. Returns the load time per model.
export async function initNeural(
  modelDirs: NeuralModelDirs,
  options: { numThreads?: number; debug?: boolean } = {},
): Promise<Partial<Record<NeuralModelKey, number>>> {
  const loadMs: Partial<Record<NeuralModelKey, number>> = {};
  if (!isSupported()) return loadMs;
  const { createStreamingTTS } = await import('react-native-sherpa-onnx/tts');
  for (const key of Object.keys(modelDirs) as NeuralModelKey[]) {
    const dir = modelDirs[key];
    if (!dir || engines[key]) continue;
    const t0 = now();
    const engine = await createStreamingTTS({
      modelPath: { type: 'file', path: dir },
      modelType: key === 'kokoro' ? 'kokoro' : 'vits',
      numThreads: options.numThreads ?? 2,
      debug: options.debug ?? false,
    });
    sampleRates[key] = await engine.getSampleRate();
    engines[key] = engine;
    loadMs[key] = now() - t0;
    console.log(`[neural] loaded ${key} in ${loadMs[key]} ms (sampleRate ${sampleRates[key]})`);
  }
  return loadMs;
}

async function stopActive(): Promise<void> {
  const run = active;
  if (!run) return;
  active = null;
  if (run.timer) clearTimeout(run.timer);
  const wasInFlight = !run.finished;
  run.finished = true;
  try {
    await run.controller?.cancel();
  } catch {
    // already finished or cancelled
  }
  try {
    await run.engine.stopPcmPlayer();
  } catch {
    // player already released
  }
  if (wasInFlight) run.onStopped?.();
}

export function stopNeural(): void {
  runCounter += 1;
  void stopActive();
}

// Resolves when the generation has finished and the audio is queued (onDone
// fires after the audio has played out). Rejects if the voice is not loaded or
// the engine fails, so the caller can fall back to the phone's own voice.
export async function speakNeural(
  text: string,
  lang: NeuralLang,
  voiceId: string,
  options: NeuralSpeakOptions = {},
): Promise<NeuralTimings> {
  const voice = NEURAL_VOICES[lang].find(v => v.id === voiceId);
  const engine = voice ? engines[voice.model] : undefined;
  const sampleRate = voice ? sampleRates[voice.model] : undefined;
  if (!voice || !engine || !sampleRate) throw new Error(`neural voice not ready: ${lang}/${voiceId}`);

  runCounter += 1;
  const myRun = runCounter;
  await stopActive();
  if (myRun !== runCounter) return { firstChunkMs: -1, generatedMs: 0, audioMs: 0, peak: 0 }; // a newer speech or a stop won

  const run: ActiveRun = { engine, controller: null, timer: null, finished: false, onStopped: options.onStopped };
  active = run;

  const t0 = now();
  let firstChunkMs = -1;
  let samplesTotal = 0;
  let peak = 0;
  let writeChain: Promise<void> = Promise.resolve();

  await engine.startPcmPlayer(sampleRate, 1);

  return new Promise<NeuralTimings>((resolve, reject) => {
    const fail = (err: unknown) => {
      if (run.finished) return;
      run.finished = true;
      if (active === run) active = null;
      void engine.stopPcmPlayer().catch(() => {});
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    engine
      .generateSpeechStream(
        text,
        { sid: voice.sid, ...(options.rate !== undefined ? { speed: options.rate } : {}) },
        {
          onChunk: chunk => {
            if (run.finished) return;
            if (firstChunkMs < 0) firstChunkMs = now() - t0;
            samplesTotal += chunk.samples.length;
            for (let i = 0; i < chunk.samples.length; i += 1) {
              const a = Math.abs(chunk.samples[i]);
              if (a > peak) peak = a;
            }
            writeChain = writeChain.then(() => (run.finished ? undefined : engine.writePcmChunk(chunk.samples)));
          },
          onEnd: event => {
            if (run.finished) return;
            if (event.cancelled) return;
            const generatedMs = now() - t0;
            const audioMs = Math.round((samplesTotal / sampleRate) * 1000);
            const timings: NeuralTimings = { firstChunkMs, generatedMs, audioMs, peak: Math.round(peak * 1000) / 1000 };
            console.log(`[neural] ${lang}/${voiceId} first=${firstChunkMs} gen=${generatedMs} audio=${audioMs} peak=${timings.peak} "${text.slice(0, 40)}"`);
            resolve(timings);
            writeChain
              .then(() => {
                if (run.finished) return;
                run.timer = setTimeout(() => {
                  if (run.finished) return;
                  run.finished = true;
                  if (active === run) active = null;
                  void engine.stopPcmPlayer().catch(() => {});
                  options.onDone?.();
                }, PCM_TAIL_MS);
              })
              .catch(fail);
          },
          onError: event => fail(new Error(event.message)),
        },
      )
      .then(controller => {
        run.controller = controller;
      })
      .catch(fail);
  });
}

// Spike only: speaks one word card and one 10-word sentence per voice in turn and
// logs the timings ("[neural] ..."), so a device run needs no tapping.
const SELFTEST_CASES: [NeuralLang, string, string][] = [
  ['es', 'em_alex', 'el perro'],
  ['es', 'em_alex', 'Mañana por la tarde vamos a visitar a mis abuelos.'],
  ['es', 'ef_dora', 'Mañana por la tarde vamos a visitar a mis abuelos.'],
  ['en', 'af_heart', 'the dog'],
  ['en', 'af_heart', 'Tomorrow afternoon we are going to visit my old grandparents.'],
  ['en', 'am_michael', 'Tomorrow afternoon we are going to visit my old grandparents.'],
  ['hu', 'berta', 'a kutya'],
  ['hu', 'berta', 'Holnap délután meglátogatjuk a nagyszüleimet a régi faluban, ahol születtem.'],
  ['hu', 'imre', 'Holnap délután meglátogatjuk a nagyszüleimet a régi faluban, ahol születtem.'],
];

export async function runNeuralSelfTest(): Promise<void> {
  for (const [lang, voiceId, text] of SELFTEST_CASES) {
    if (!hasNeuralVoice(lang, voiceId)) {
      console.log(`[neural] selftest skip ${lang}/${voiceId} (not loaded)`);
      continue;
    }
    await new Promise<void>(resolve => {
      speakNeural(text, lang, voiceId, { onDone: resolve, onStopped: resolve }).catch(err => {
        console.log(`[neural] selftest FAIL ${lang}/${voiceId}: ${String(err)}`);
        resolve();
      });
    });
  }
  console.log('[neural] selftest done');
}
