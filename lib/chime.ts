// FB549: the short "right answer" chime of the grammar round (assets/sounds/correct.wav, made by
// scripts/make-chime.mjs), played with expo-audio like the word pack (lib/packAudio.ts). expo-audio is loaded
// lazily, so importing this file (a jest test, the web build) never touches the native module. The web build
// stays silent. There is no sound mute setting in the app (the better voice in Settings only chooses the
// speaking voice), so nothing to check here. `onDone` runs once when the chime has ended, or at once when it
// cannot play at all, so what comes after it (the sentence read aloud) never waits for a broken chime.

import { Platform } from 'react-native';

import { makeChimePlayer } from './chimePlayer';

// The file is 250 ms long; a chime that has not finished by now did not load.
const CHIME_MAX_MS = 1500;

export function playChime(onDone?: () => void): void {
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let sub: { remove(): void } | null = null;
  let player: { remove(): void; pause(): void } | null = null;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (timer) clearTimeout(timer);
    try {
      sub?.remove();
      player?.pause();
      player?.remove();
    } catch {
      // already released
    }
    onDone?.();
  };
  if (Platform.OS === 'web') {
    finish();
    return;
  }
  try {
    const created = makeChimePlayer();
    player = created;
    sub = created.addListener('playbackStatusUpdate', status => {
      if (status.didJustFinish) finish();
    });
    timer = setTimeout(finish, CHIME_MAX_MS);
    created.play();
  } catch {
    finish();
  }
}
