// On-device neural speech (react-native-sherpa-onnx, sherpa-onnx under the hood): Piper (VITS) and Kokoro
// voices for es, en and hu. Native only: lib/neuralTts.web.ts is the no-op twin Metro picks for the web
// build. The voice tables, the hash and the engine choice live in lib/neuralVoices.ts; the downloads in
// lib/neuralModels.ts; lib/speech.ts decides which level (word pack, this engine, the phone) speaks.
//
// One engine per model, except Kokoro: its language is part of the engine config (scripts/patch-sherpa-onnx.mjs
// hands it to the native side through the modelType string, "kokoro@es-419"), so the Spanish and the English
// Kokoro are two engines over the same model folder. The Piper models have one speaker, sid 0.
//
// The package is loaded lazily (a require inside the function), so merely importing this file, e.g.
// from a jest test, never touches the native module.

import { Platform } from 'react-native';
import type { StreamingTtsEngine, TtsStreamController } from 'react-native-sherpa-onnx/tts';
import { KOKORO_LANG_TAG, voicePair, type NeuralEngine, type NeuralLang, type NeuralVoice } from './neuralVoices';

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

const engines = new Map<string, StreamingTtsEngine>();
const sampleRates = new Map<string, number>();
const loading = new Map<string, Promise<number>>();

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

// One engine per model; the Kokoro engines also per language.
function engineKey(voice: NeuralVoice, lang: NeuralLang): string {
  return voice.engine === 'kokoro' ? `kokoro:${lang}` : voice.model;
}

// Both voices of the pair are loaded: the pair alternates, so half of the words would otherwise fall back.
export function isNeuralReady(lang: NeuralLang, engine: NeuralEngine): boolean {
  return voicePair(lang, engine).every(voice => engines.has(engineKey(voice, lang)));
}

// Loads the engine of one voice from its model folder (a no-op when it is loaded already). Resolves with
// the load time in ms; rejects when the folder is not a usable model, which leaves the voice not ready.
export function loadNeuralVoice(
  voice: NeuralVoice,
  lang: NeuralLang,
  modelDir: string,
  options: { numThreads?: number; debug?: boolean } = {},
): Promise<number> {
  if (!isSupported()) return Promise.resolve(0);
  const key = engineKey(voice, lang);
  if (engines.has(key)) return Promise.resolve(0);
  const pending = loading.get(key);
  if (pending) return pending;
  const run = (async () => {
    const { createStreamingTTS } = require('react-native-sherpa-onnx/tts') as typeof import('react-native-sherpa-onnx/tts');
    const t0 = now();
    const engine = await createStreamingTTS({
      modelPath: { type: 'file', path: modelDir },
      // "kokoro@es-419": the language rides on the type string (see scripts/patch-sherpa-onnx.mjs)
      modelType: (voice.engine === 'kokoro' ? `kokoro@${KOKORO_LANG_TAG[lang as 'es' | 'en']}` : 'vits') as 'kokoro',
      numThreads: options.numThreads ?? 2,
      debug: options.debug ?? false,
    });
    sampleRates.set(key, await engine.getSampleRate());
    engines.set(key, engine);
    const loadMs = now() - t0;
    console.log(`[neural] loaded ${key} in ${loadMs} ms (sampleRate ${sampleRates.get(key)})`);
    return loadMs;
  })().finally(() => {
    loading.delete(key);
  });
  loading.set(key, run);
  return run;
}

// Frees the engines (Settings switched the better voice off, or deleted the models).
export async function releaseNeural(): Promise<void> {
  stopNeural();
  const all = [...engines.values()];
  engines.clear();
  sampleRates.clear();
  for (const engine of all) {
    try {
      await engine.destroy();
    } catch {
      // already gone
    }
  }
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
  voice: NeuralVoice,
  options: NeuralSpeakOptions = {},
): Promise<NeuralTimings> {
  const key = engineKey(voice, lang);
  const engine = engines.get(key);
  const sampleRate = sampleRates.get(key);
  if (!engine || !sampleRate) throw new Error(`neural voice not ready: ${lang}/${voice.id}`);

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
            console.log(`[neural] ${lang}/${voice.id} first=${firstChunkMs} gen=${generatedMs} audio=${audioMs} peak=${timings.peak} "${text.slice(0, 40)}"`);
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
