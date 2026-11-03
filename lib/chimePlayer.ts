// The expo-audio player of the bundled right-answer chime (assets/sounds/correct.wav). expo-audio and the asset
// are required lazily, so importing lib/chime.ts never touches the native module. Its own module, so the chime
// test stubs this file: stubbing expo-audio and the asset path worked locally but not on the Linux CI runner,
// where playChime never reached the player.
import type { AudioPlayer } from 'expo-audio';

export function makeChimePlayer(): AudioPlayer {
  const { createAudioPlayer } = require('expo-audio') as typeof import('expo-audio');
  return createAudioPlayer(require('../assets/sounds/correct.wav'));
}
