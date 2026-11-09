// FB633: with the better voice off, a card word spoken before the phone's voice list was known got the engine's
// default voice, and the next speech (list loaded by then) the pinned Mexican voice: two voices for one language.
// The list is now asked for at start (watchAppStateForSpeech), so the very first speech is already pinned.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(),
}));
jest.mock('../neuralModels', () => ({
  startNeural: jest.fn(async () => {}),
  neuralPackFile: jest.fn(() => null),
  neuralSentenceFile: jest.fn(() => null),
  neuralEngineFor: jest.fn(() => null),
  releaseStandIns: jest.fn(async () => {}),
}));
jest.mock('../neuralTts', () => ({ speakNeural: jest.fn(), stopNeural: jest.fn() }));
jest.mock('../packAudio', () => ({ playPackFile: jest.fn(), stopPack: jest.fn() }));

import * as Speech from 'expo-speech';
import { setSpeakerChoice } from '@/lib/voicePreference';
import { loadVoices, noteSpeechTouch, resetVoiceCache, speak, stop, watchAppStateForSpeech } from '@/lib/speech';

const speech = Speech as jest.Mocked<typeof Speech>;
const VOICES = [
  { identifier: 'es-ES-default', name: 'es', quality: 'Default', language: 'es-ES' },
  { identifier: 'es-MX-enhanced', name: 'mx', quality: 'Enhanced', language: 'es-MX' },
];
const voiceOfCall = (i: number) => (speech.speak.mock.calls[i][1] as { voice?: string }).voice;

beforeEach(() => {
  jest.clearAllMocks();
  resetVoiceCache();
  noteSpeechTouch();
  (speech.getAvailableVoicesAsync as jest.Mock).mockResolvedValue(VOICES);
});
afterEach(() => stop());

describe('one phone voice per language', () => {
  it('reproduces the cause: a speech before the list is loaded has no voice (and keeps it, see the lock)', async () => {
    speak('el plomero', 'es-MX');
    await loadVoices();
    speak('El plomero viene hoy a mi casa.', 'es-MX');
    expect(voiceOfCall(0)).toBeUndefined();
    expect(voiceOfCall(1)).toBeUndefined();
  });

  it('the fix: with the list asked for at start, the first and the later speech use the same voice', async () => {
    const off = watchAppStateForSpeech();
    await new Promise<void>(resolve => setImmediate(resolve)); // the app's start, before any card speaks
    speak('el plomero', 'es-MX');
    speak('El plomero viene hoy a mi casa.', 'es-MX');
    expect(voiceOfCall(0)).toBe('es-MX-enhanced');
    expect(voiceOfCall(1)).toBe('es-MX-enhanced');
    off();
  });

  it('a list that arrives late does not flip the voice a language already spoke with', async () => {
    (speech.getAvailableVoicesAsync as jest.Mock).mockResolvedValue([]); // list unknown for the first speeches
    speak('el plomero', 'es-MX');
    await loadVoices();
    speak('Hola', 'es-MX');
    (speech.getAvailableVoicesAsync as jest.Mock).mockResolvedValue(VOICES);
    await loadVoices();
    speak('El plomero viene hoy a mi casa.', 'es-MX');
    expect([0, 1, 2].map(voiceOfCall)).toEqual([undefined, undefined, undefined]);
  });

  it('changing a voice setting releases the lock', async () => {
    (speech.getAvailableVoicesAsync as jest.Mock).mockResolvedValue([]);
    speak('uno', 'es-MX');
    await loadVoices();
    (speech.getAvailableVoicesAsync as jest.Mock).mockResolvedValue(VOICES);
    await loadVoices();
    setSpeakerChoice('es', 'm');
    setSpeakerChoice('es', 'auto');
    speak('dos', 'es-MX');
    expect(voiceOfCall(1)).toBe('es-MX-enhanced');
  });
});
