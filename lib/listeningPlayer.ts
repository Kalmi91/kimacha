// The expo-audio player of the bundled listening recording (assets/listening/{es-greetings,en-greetings,es-taxi}.mp3). expo-audio and
// the asset are required lazily and in their own module, like lib/voiceSamplePlayer.ts, so nothing touches the native module on
// import and a jest test stubs this file. Metro needs the literal path, so there is one require per item id.
import type { AudioPlayer } from 'expo-audio';

export function makeListeningPlayer(id: string): AudioPlayer {
  const { createAudioPlayer } = require('expo-audio') as typeof import('expo-audio');
  if (id === 'en-greetings') return createAudioPlayer(require('../assets/listening/en-greetings.mp3'));
  if (id === 'es-taxi') return createAudioPlayer(require('../assets/listening/es-taxi.mp3'));
  return createAudioPlayer(require('../assets/listening/es-greetings.mp3'));
}
