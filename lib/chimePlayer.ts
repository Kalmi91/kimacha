// The expo-audio player of the bundled right-answer chime (assets/sounds/correct.wav). expo-audio and the asset
// are required lazily, so importing lib/chime.ts never touches the native module. Its own module, so the chime
// test stubs this file: stubbing expo-audio and the asset path worked locally but not on the Linux CI runner,
// where playChime never reached the player.
import type { AudioPlayer } from 'expo-audio';

export function makeChimePlayer(sound: 'right' | 'wrong' = 'right'): AudioPlayer {
  const { createAudioPlayer } = require('expo-audio') as typeof import('expo-audio');
  // wrong.wav is the Big test's wrong-answer sound (scripts/make-wrong-sound.mjs)
  return createAudioPlayer(sound === 'wrong' ? require('../assets/sounds/wrong.wav') : require('../assets/sounds/correct.wav'));
}
