// The expo-audio player of the bundled listening recording (assets/listening/{es,en}-greetings.mp3). expo-audio and the asset are
// required lazily and in their own module, like lib/voiceSamplePlayer.ts, so nothing touches the native module on import and a
// jest test stubs this file. Metro needs the literal path.
import type { AudioPlayer } from 'expo-audio';

export function makeListeningPlayer(lang: 'es' | 'en'): AudioPlayer {
  const { createAudioPlayer } = require('expo-audio') as typeof import('expo-audio');
  return createAudioPlayer(lang === 'en' ? require('../assets/listening/en-greetings.mp3') : require('../assets/listening/es-greetings.mp3'));
}
