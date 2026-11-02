// Plays one file of the word pack (mono MP3, see lib/neuralVoices.ts) with expo-audio. Native only:
// lib/packAudio.web.ts is the no-op twin of the web build. expo-audio is loaded lazily, so importing this
// file (a jest test, the web build) never touches the native module.
//
// The three callbacks follow lib/speech.ts: onDone at the natural end, onStopped when a stop() or the next
// speech cut the file off, onFail when the file could not be played at all (the caller then speaks the same
// text with the next level: the sentence engine, then the phone).

import { Platform } from 'react-native';

export interface PackPlayOptions {
  rate?: number;
  onDone?: () => void;
  onStopped?: () => void;
  onFail?: () => void;
}

// A file that is not loaded and not playing after this long counts as broken.
const LOAD_TIMEOUT_MS = 4000;

interface Current {
  player: { remove(): void; pause(): void } | null;
  sub: { remove(): void } | null;
  timer: ReturnType<typeof setTimeout> | null;
  finished: boolean;
  onStopped?: () => void;
}
let current: Current | null = null;

function release(run: Current): void {
  if (run.timer) clearTimeout(run.timer);
  try {
    run.sub?.remove();
  } catch {
    // already removed
  }
  try {
    run.player?.pause();
    run.player?.remove();
  } catch {
    // already released
  }
}

export function stopPack(): void {
  const run = current;
  if (!run) return;
  current = null;
  const wasInFlight = !run.finished;
  run.finished = true;
  release(run);
  if (wasInFlight) run.onStopped?.();
}

export function playPackFile(path: string, options: PackPlayOptions = {}): void {
  if (Platform.OS !== 'android') {
    options.onFail?.();
    return;
  }
  stopPack();
  const run: Current = { player: null, sub: null, timer: null, finished: false, onStopped: options.onStopped };
  current = run;
  const fail = () => {
    if (run.finished) return;
    run.finished = true;
    if (current === run) current = null;
    release(run);
    options.onFail?.();
  };
  try {
    const { createAudioPlayer } = require('expo-audio') as typeof import('expo-audio');
    const player = createAudioPlayer({ uri: `file://${path}` });
    run.player = player;
    run.sub = player.addListener('playbackStatusUpdate', status => {
      if (run.finished) return;
      if (status.isLoaded && run.timer) {
        clearTimeout(run.timer);
        run.timer = null;
      }
      if (status.didJustFinish) {
        run.finished = true;
        if (current === run) current = null;
        release(run);
        options.onDone?.();
      }
    });
    run.timer = setTimeout(fail, LOAD_TIMEOUT_MS);
    if (options.rate !== undefined && options.rate !== 1) {
      player.shouldCorrectPitch = true;
      player.playbackRate = options.rate;
    }
    player.play();
  } catch {
    fail();
  }
}
