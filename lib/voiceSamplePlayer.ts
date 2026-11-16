// The expo-audio player of a bundled voice sample (assets/voice-samples/<key>.mp3). expo-audio and the assets are
// required lazily and in their own module, like lib/chimePlayer.ts, so lib/voiceSample.ts never touches the native
// module on import and a jest test stubs this file. Metro needs the literal paths, hence the table.
import type { AudioPlayer } from 'expo-audio';

import type { SampleKey } from './voiceSampleData';

const FILES: Partial<Record<SampleKey, () => number>> = {
  'es-kokoro-f': () => require('../assets/voice-samples/es-kokoro-f.mp3'),
  'es-kokoro-m': () => require('../assets/voice-samples/es-kokoro-m.mp3'),
  'es-piper-f': () => require('../assets/voice-samples/es-piper-f.mp3'),
  'es-piper-m': () => require('../assets/voice-samples/es-piper-m.mp3'),
  'en-kokoro-f': () => require('../assets/voice-samples/en-kokoro-f.mp3'),
  'en-kokoro-m': () => require('../assets/voice-samples/en-kokoro-m.mp3'),
  'en-piper-f': () => require('../assets/voice-samples/en-piper-f.mp3'),
  'en-piper-m': () => require('../assets/voice-samples/en-piper-m.mp3'),
  'hu-piper-f': () => require('../assets/voice-samples/hu-piper-f.mp3'),
  'hu-piper-m': () => require('../assets/voice-samples/hu-piper-m.mp3'),
  'de-piper-f': () => require('../assets/voice-samples/de-piper-f.mp3'),
  'de-piper-m': () => require('../assets/voice-samples/de-piper-m.mp3'),
};

export function makeSamplePlayer(key: SampleKey): AudioPlayer {
  const { createAudioPlayer } = require('expo-audio') as typeof import('expo-audio');
  const file = FILES[key];
  if (!file) throw new Error(`no voice sample ${key}`); // hu and de have no Kokoro voice
  return createAudioPlayer(file());
}
