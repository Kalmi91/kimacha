// Plays one bundled voice sample (lib/voiceSampleData.ts) from Settings -> Voice. No download, no model, and it does
// not depend on the Better voice switch or on the learner's speaker choice: it only plays. One sample at a time: a
// new one stops the one before. The playing key is a small store (useSamplePlaying) so the ▶ buttons show the state.
// The web build is silent (lib/voiceSample.web.ts).

import { useSyncExternalStore } from 'react';

import type { NeuralEngine, NeuralLang } from './neuralVoices';
import { hasSample, sampleKey, type SampleGender, type SampleKey } from './voiceSampleData';
import { makeSamplePlayer } from './voiceSamplePlayer';

// The longest sample is under 3 s; one that has not ended by now did not load, so the button must not hang.
const SAMPLE_MAX_MS = 8000;

let playing: SampleKey | null = null;
let stopCurrent: (() => void) | null = null;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const setPlaying = (key: SampleKey | null) => {
  playing = key;
  listeners.forEach(fn => fn());
};

export function getSamplePlaying(): SampleKey | null {
  return playing;
}

export function useSamplePlaying(): SampleKey | null {
  return useSyncExternalStore(subscribe, () => playing, () => playing);
}

export function stopVoiceSample(): void {
  const stop = stopCurrent;
  stopCurrent = null;
  stop?.();
}

export function playVoiceSample(lang: NeuralLang, engine: NeuralEngine, gender: SampleGender): void {
  if (!hasSample(lang, engine, gender)) return;
  stopVoiceSample();
  const key = sampleKey(lang, engine, gender);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let sub: { remove(): void } | null = null;
  let player: { remove(): void; pause(): void } | null = null;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (timer) clearTimeout(timer);
    if (stopCurrent === finish) stopCurrent = null;
    try {
      sub?.remove();
      player?.pause();
      player?.remove();
    } catch {
      // already released
    }
    if (playing === key) setPlaying(null);
  };
  try {
    const created = makeSamplePlayer(key);
    player = created;
    sub = created.addListener('playbackStatusUpdate', status => {
      if (status.didJustFinish) finish();
    });
    timer = setTimeout(finish, SAMPLE_MAX_MS);
    stopCurrent = finish;
    setPlaying(key);
    created.play();
  } catch {
    finish();
  }
}
