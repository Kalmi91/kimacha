// Two reports of 2026-11-02 against lib/speech.ts: opening the app read the first card aloud, and sometimes
// two voices sounded at once (a speech that fell to the phone left the word pack, the better voice or a
// word + example chain running).

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
}));
jest.mock('../neuralTts', () => ({
  speakNeural: jest.fn(async () => ({ firstChunkMs: 1, generatedMs: 2, audioMs: 3, peak: 0.5 })),
  stopNeural: jest.fn(),
}));
jest.mock('../packAudio', () => ({
  playPackFile: jest.fn(),
  stopPack: jest.fn(),
}));

import { AppState } from 'react-native';
import * as Speech from 'expo-speech';
import { noteSpeechTouch, resetVoiceCache, speak, speakAuto, speakSequence, stop, watchAppStateForSpeech } from '@/lib/speech';
import * as models from '../neuralModels';
import * as engine from '../neuralTts';
import * as pack from '../packAudio';

const speech = Speech as jest.Mocked<typeof Speech>;
const packFile = models.neuralPackFile as jest.Mock;
const engineFor = models.neuralEngineFor as jest.Mock;
const playPack = pack.playPackFile as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  resetVoiceCache();
  packFile.mockReturnValue(null);
  engineFor.mockReturnValue(null);
});
afterEach(() => stop());

describe('one voice at a time', () => {
  it('a speech that falls to the phone first cuts the word pack and the better voice still sounding', () => {
    packFile.mockReturnValueOnce('/files/tts/pack/es/1.mp3');
    speak('disculpar', 'es-MX'); // the word pack plays it
    jest.clearAllMocks();
    speak('Please excuse my brother.', 'en-US'); // no English voice ready: the phone reads it
    expect(speech.speak).toHaveBeenCalledTimes(1);
    const phoneAt = speech.speak.mock.invocationCallOrder[0];
    expect((pack.stopPack as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(phoneAt);
    expect((engine.stopNeural as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(phoneAt);
    expect(speech.stop.mock.invocationCallOrder[0]).toBeLessThan(phoneAt);
  });

  it('a speech ends the word + example chain in flight: the example does not start after the cut word', () => {
    packFile.mockReturnValueOnce('/files/tts/pack/en/2.mp3');
    speakSequence([
      { text: 'to excuse', locale: 'en-US' },
      { text: 'Please excuse my brother.', locale: 'en-US' },
    ]);
    const wordDone = playPack.mock.calls[0][1].onDone as () => void;
    speak('disculpar', 'es-MX'); // the learner taps another speaker meanwhile
    jest.clearAllMocks();
    wordDone(); // a late end event of the cut word
    expect(speech.speak).not.toHaveBeenCalled();
    expect(playPack).not.toHaveBeenCalled();
  });
});

describe('opening the app is silent', () => {
  it('the automatic read-aloud waits for the first touch; speak() (a button, a Check) always sounds', () => {
    speakAuto('disculpar', 'es-MX');
    expect(speech.speak).not.toHaveBeenCalled();
    speak('disculpar', 'es-MX');
    expect(speech.speak).toHaveBeenCalledTimes(1);
    noteSpeechTouch();
    speakAuto('perdonar', 'es-MX');
    expect(speech.speak).toHaveBeenLastCalledWith('perdonar', expect.objectContaining({ language: 'es-MX' }));
  });

  it('back from the background it is silent again until the next touch', () => {
    let onChange: (state: string) => void = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, fn: (state: string) => void) => {
      onChange = fn;
      return { remove: jest.fn() };
    }) as never);
    const unwatch = watchAppStateForSpeech();
    noteSpeechTouch();
    onChange('background');
    onChange('active');
    speakAuto('disculpar', 'es-MX');
    expect(speech.speak).not.toHaveBeenCalled();
    noteSpeechTouch();
    speakAuto('disculpar', 'es-MX');
    expect(speech.speak).toHaveBeenCalledTimes(1);
    unwatch();
  });
});
