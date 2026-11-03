// On-device neural speech (react-native-sherpa-onnx, sherpa-onnx under the hood): Piper (VITS) and Kokoro
// voices for es, en, hu and de. Native only: lib/neuralTts.web.ts is the no-op twin Metro picks for the web
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
import { cleanPcm } from './pcmClean';

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
  /** Settles when generateSpeechStream has returned (the controller exists then) or failed. */
  started: Promise<unknown>;
  /** Settles when the native generation has really ended (its end event, also after a cancel), or never began. */
  ended: Promise<void>;
}
let active: ActiveRun | null = null;
let runCounter = 0;
// The native side has one PCM player per engine, and stopping is asynchronous (cancel, then the player
// release). Every release goes through this chain, and a new speech waits for it: a stopPcmPlayer that lands
// after the next startPcmPlayer leaves the new speech without a player ("PCM player not initialized").
let stopping: Promise<void> = Promise.resolve();

// The native side runs one generation per engine, and a cancel only takes effect when the generation reaches
// its next chunk (for one sentence that is when it is all generated: seconds on a slow phone). A new
// generation started before the old thread ended is refused with "already in progress", and the phone's
// voice would speak instead. So a stop waits for the end event of the generation it cut, at most this long,
// and a start that still meets a busy engine asks again.
const NATIVE_END_WAIT_MS = 30000;
const BUSY_RETRY_MS = 120;
const BUSY_RETRY_MAX = 50;

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
  await stopping;
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

// Frees the engines of one language's pair: its other engine is the chosen and loaded one now, and the
// memory of two loaded models is not needed (a Piper pair is two models, the Kokoro engine ~130 MB).
export async function releaseNeuralPair(lang: NeuralLang, engine: NeuralEngine): Promise<void> {
  const keys = [...new Set(voicePair(lang, engine).map(voice => engineKey(voice, lang)))].filter(key => engines.has(key));
  if (keys.length === 0) return;
  if (active && keys.some(key => engines.get(key) === active?.engine)) stopNeural();
  await stopping;
  for (const key of keys) {
    const gone = engines.get(key);
    engines.delete(key);
    sampleRates.delete(key);
    try {
      await gone?.destroy();
    } catch {
      // already gone
    }
  }
}

// Queues the release of an engine's PCM player behind the stops that are under way.
function releasePlayer(engine: StreamingTtsEngine): void {
  stopping = stopping.then(() => engine.stopPcmPlayer().catch(() => {}));
}

// Resolves when the promise settles, or after `ms`, whichever comes first.
function settledOrAfter(promise: Promise<unknown>, ms: number): Promise<void> {
  return new Promise<void>(resolve => {
    const timer = setTimeout(resolve, ms);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    promise.then(done, done);
  });
}

// Starts the generation; an engine that is still busy with the generation before (the end event arrives a
// moment before the native flag is cleared) is asked again instead of failing the speech.
async function generateWhenFree(
  run: ActiveRun,
  text: string,
  options: Parameters<StreamingTtsEngine['generateSpeechStream']>[1],
  handlers: Parameters<StreamingTtsEngine['generateSpeechStream']>[2],
): Promise<TtsStreamController> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await run.engine.generateSpeechStream(text, options, handlers);
    } catch (err) {
      const busy = /already in progress/i.test(err instanceof Error ? err.message : String(err));
      if (!busy || run.finished || attempt >= BUSY_RETRY_MAX) throw err;
      await new Promise(resolve => setTimeout(resolve, BUSY_RETRY_MS));
      if (run.finished) throw err;
    }
  }
}

// Cuts the run in flight; resolves when it and every stop before it are done (a new speech awaits this).
function stopActive(): Promise<void> {
  const run = active;
  if (run) {
    active = null;
    if (run.timer) clearTimeout(run.timer);
    const wasInFlight = !run.finished;
    run.finished = true;
    stopping = stopping.then(async () => {
      await run.started; // a generation that is just starting can only be cancelled once it has started
      try {
        // the engine's own cancel, not the controller's: that one also drops the listeners, and with them the end event
        await run.engine.cancelSpeechStream();
      } catch {
        // already finished or cancelled
      }
      try {
        await run.engine.stopPcmPlayer();
      } catch {
        // player already released
      }
      if (wasInFlight) run.onStopped?.();
      await settledOrAfter(run.ended, NATIVE_END_WAIT_MS);
    });
  }
  return stopping;
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

  const run: ActiveRun = { engine, controller: null, timer: null, finished: false, onStopped: options.onStopped, started: Promise.resolve(), ended: Promise.resolve() };
  active = run;

  const t0 = now();
  let firstChunkMs = -1;
  let samplesTotal = 0;
  let peak = 0;
  let writeChain: Promise<void> = Promise.resolve();

  try {
    await engine.startPcmPlayer(sampleRate, 1);
  } catch (err) {
    // the run never started: it must not stay `active` (a later stop would report it as cut off)
    const superseded = run.finished;
    run.finished = true;
    if (active === run) active = null;
    if (superseded) return { firstChunkMs: -1, generatedMs: 0, audioMs: 0, peak: 0 };
    throw err;
  }
  // stopped while the player was starting: no generation, or it would run on and the next one find the engine busy
  if (run.finished) return { firstChunkMs: -1, generatedMs: 0, audioMs: 0, peak: 0 };

  return new Promise<NeuralTimings>((resolve, reject) => {
    const fail = (err: unknown) => {
      if (run.finished) return;
      run.finished = true;
      if (active === run) active = null;
      releasePlayer(engine);
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    let endNative: () => void = () => {};
    run.ended = new Promise<void>(resolveEnded => {
      endNative = resolveEnded;
    });

    run.started = generateWhenFree(
        run,
        text,
        { sid: voice.sid, ...(options.rate !== undefined ? { speed: options.rate } : {}) },
        {
          onChunk: chunk => {
            if (run.finished) return;
            if (firstChunkMs < 0) firstChunkMs = now() - t0;
            // FB544/545: the Piper voices hiss in the pauses and click at the edges; Kokoro is clean
            const samples = voice.engine === 'piper' ? Array.from(cleanPcm(Float32Array.from(chunk.samples), sampleRate)) : chunk.samples;
            samplesTotal += samples.length;
            for (let i = 0; i < samples.length; i += 1) {
              const a = Math.abs(samples[i]);
              if (a > peak) peak = a;
            }
            writeChain = writeChain.then(() => (run.finished ? undefined : engine.writePcmChunk(samples)));
          },
          onEnd: event => {
            endNative(); // the native generation is over, cancelled or not
            if (run.finished) return;
            if (event.cancelled) return;
            const generatedMs = now() - t0;
            const audioMs = Math.round((samplesTotal / sampleRate) * 1000);
            const timings: NeuralTimings = { firstChunkMs, generatedMs, audioMs, peak: Math.round(peak * 1000) / 1000 };
            console.log(`[neural] ${lang}/${voice.id} first=${firstChunkMs} gen=${generatedMs} audio=${audioMs} peak=${timings.peak} "${text.slice(0, 40)}"`);
            // resolves once the audio is queued, so a write that fails (the player died, a Bluetooth headset
            // dropped) still rejects and the caller can hand the text to the next level
            writeChain
              .then(() => {
                if (run.finished) return;
                resolve(timings);
                run.timer = setTimeout(() => {
                  if (run.finished) return;
                  run.finished = true;
                  if (active === run) active = null;
                  releasePlayer(engine);
                  options.onDone?.();
                }, PCM_TAIL_MS);
              })
              .catch(fail);
          },
          onError: event => {
            endNative();
            fail(new Error(event.message));
          },
        },
      )
      .then(controller => {
        run.controller = controller;
      })
      .catch(err => {
        endNative(); // it never started
        fail(err);
      });
  });
}
