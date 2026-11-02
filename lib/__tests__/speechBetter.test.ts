// The levels of lib/speech.ts: the better voice's word pack, then its sentence engine, then the phone. Each
// level that is not ready is skipped, each that fails hands the same text on; the web and the not-installed
// cases keep the phone's own path exactly as it was.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(),
}));
jest.mock('../neuralModels', () => ({
  startNeural: jest.fn(async () => {}),
  neuralPackFile: jest.fn(() => null),
  neuralEngineFor: jest.fn(() => null),
}));
jest.mock('../neuralTts', () => ({
  speakNeural: jest.fn(async () => ({ firstChunkMs: 1, generatedMs: 2, audioMs: 3, peak: 0.5 })),
  stopNeural: jest.fn(),
}));
jest.mock('../packAudio', () => ({
  playPackFile: jest.fn(async () => {}),
  stopPack: jest.fn(),
}));

import * as Speech from 'expo-speech';
import { speak, speakSequence, stop, resetVoiceCache, loadVoices, missingVoiceLanguages } from '@/lib/speech';
import * as models from '../neuralModels';
import * as engine from '../neuralTts';
import * as pack from '../packAudio';

const speech = Speech as jest.Mocked<typeof Speech>;
const packFile = models.neuralPackFile as jest.Mock;
const engineFor = models.neuralEngineFor as jest.Mock;
const speakNeural = engine.speakNeural as jest.Mock;
const playPack = pack.playPackFile as jest.Mock;

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(() => {
  jest.clearAllMocks();
  resetVoiceCache();
  packFile.mockReturnValue(null);
  engineFor.mockReturnValue(null);
  speakNeural.mockResolvedValue({ firstChunkMs: 1, generatedMs: 2, audioMs: 3, peak: 0.5 });
});

describe('speak(): the levels', () => {
  it('nothing installed: the phone speaks, and nothing is cut first', () => {
    speak('el perro', 'es-MX');
    expect(speech.speak).toHaveBeenCalledWith('el perro', { language: 'es-MX' });
    expect(speech.stop).not.toHaveBeenCalled();
    expect(playPack).not.toHaveBeenCalled();
    expect(speakNeural).not.toHaveBeenCalled();
  });

  it('a card word in the pack plays its file, with the speed and the callbacks', () => {
    packFile.mockReturnValue('/files/tts/pack/es/27956ac4.mp3');
    engineFor.mockReturnValue('piper');
    const onDone = jest.fn();
    speak('el perro', 'es-MX', { rate: 0.8, onDone });
    expect(packFile).toHaveBeenCalledWith('es', 'el perro');
    expect(playPack).toHaveBeenCalledWith('/files/tts/pack/es/27956ac4.mp3', expect.objectContaining({ rate: 0.8, onDone }));
    expect(speakNeural).not.toHaveBeenCalled();
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it('a text that is not in the pack goes to the sentence engine, with the voice the hash picks', () => {
    engineFor.mockReturnValue('piper');
    speak('el perro', 'es-MX', { rate: 1.1 });
    expect(speakNeural).toHaveBeenCalledWith('el perro', 'es', expect.objectContaining({ id: 'es_MX-claude-high' }), expect.objectContaining({ rate: 1.1 }));
    speak('Mañana', 'es-MX');
    expect(speakNeural).toHaveBeenLastCalledWith('Mañana', 'es', expect.objectContaining({ id: 'es_MX-ald-medium' }), expect.anything());
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it('the engine the language chose is the one that speaks: Kokoro voices for Kokoro', () => {
    engineFor.mockReturnValue('kokoro');
    speak('the dog', 'en-US');
    expect(speakNeural).toHaveBeenCalledWith('the dog', 'en', expect.objectContaining({ id: 'af_heart', engine: 'kokoro' }), expect.anything());
  });

  it('a pack file that cannot be played falls to the engine, and an engine that fails to the phone', async () => {
    packFile.mockReturnValue('/files/tts/pack/es/x.mp3');
    engineFor.mockReturnValue('piper');
    speakNeural.mockRejectedValue(new Error('engine down'));
    speak('el perro', 'es-MX');
    const { onFail } = playPack.mock.calls[0][1];
    onFail();
    expect(speakNeural).toHaveBeenCalledTimes(1);
    await flush();
    expect(speech.speak).toHaveBeenCalledWith('el perro', { language: 'es-MX' });
  });

  it('the phone takes over from a failed level only after whatever of the better voice still sounds is cut', async () => {
    engineFor.mockReturnValue('piper');
    speakNeural.mockRejectedValue(new Error('write failed'));
    speak('el perro', 'es-MX');
    (engine.stopNeural as jest.Mock).mockClear(); // the cut that every speech starts with
    (pack.stopPack as jest.Mock).mockClear();
    await flush();
    expect(engine.stopNeural).toHaveBeenCalledTimes(1);
    expect(pack.stopPack).toHaveBeenCalledTimes(1);
    expect((engine.stopNeural as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(speech.speak.mock.invocationCallOrder[0]);
    expect((pack.stopPack as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(speech.speak.mock.invocationCallOrder[0]);
  });

  it('the engine going away between the levels goes straight to the phone', () => {
    packFile.mockReturnValue('/files/tts/pack/es/x.mp3');
    engineFor.mockReturnValueOnce('piper').mockReturnValue(null);
    speak('el perro', 'es-MX');
    playPack.mock.calls[0][1].onFail();
    expect(speakNeural).not.toHaveBeenCalled();
    expect(speech.speak).toHaveBeenCalled();
  });

  it('the better voice speaks a language the phone has no voice for, and the phone still reports it missing', async () => {
    (speech.getAvailableVoicesAsync as jest.Mock).mockResolvedValue([{ language: 'en-US' }]);
    await loadVoices();
    engineFor.mockReturnValue('piper');
    speak('a kutya', 'hu-HU');
    expect(speakNeural).toHaveBeenCalledTimes(1);
    expect(missingVoiceLanguages()).toEqual([]);
    engineFor.mockReturnValue(null);
    speak('a kutya', 'hu-HU');
    expect(speech.speak).not.toHaveBeenCalled();
    expect(missingVoiceLanguages()).toEqual(['hu']);
  });

  it('a language the better voice does not have is the phone', () => {
    packFile.mockReturnValue('/files/x.mp3');
    engineFor.mockReturnValue('piper');
    speak('Hund', 'de-DE');
    expect(speech.speak).toHaveBeenCalledWith('Hund', { language: 'de-DE' });
    expect(playPack).not.toHaveBeenCalled();
  });

  it('stop() stops the phone, the engine and the pack', () => {
    stop();
    expect(speech.stop).toHaveBeenCalled();
    expect(engine.stopNeural).toHaveBeenCalled();
    expect(pack.stopPack).toHaveBeenCalled();
  });
});

describe('speakSequence(): the levels per segment', () => {
  it('segments run one after the other through the engine, each starting when the last is done', () => {
    engineFor.mockReturnValue('piper');
    const onEnd = jest.fn();
    speakSequence([{ text: 'Hola', locale: 'es-MX', gender: 'f' }, { text: 'Hello', locale: 'en-US', gender: 'm' }], onEnd);
    expect(speakNeural).toHaveBeenCalledTimes(1);
    expect(speakNeural).toHaveBeenLastCalledWith('Hola', 'es', expect.objectContaining({ id: 'es_MX-claude-high', gender: 'f' }), expect.anything());
    speakNeural.mock.calls[0][3].onDone();
    expect(speakNeural).toHaveBeenCalledTimes(2);
    expect(speakNeural).toHaveBeenLastCalledWith('Hello', 'en', expect.objectContaining({ id: 'en_US-john-medium', gender: 'm' }), expect.anything());
    expect(onEnd).not.toHaveBeenCalled();
    speakNeural.mock.calls[1][3].onDone();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('a male line never gets a pack recording of a female voice', () => {
    packFile.mockReturnValue('/files/tts/pack/es/27956ac4.mp3'); // "el perro": hash even = ef_dora, a woman
    engineFor.mockReturnValue('piper');
    speakSequence([{ text: 'el perro', locale: 'es-MX', gender: 'm' }]);
    expect(playPack).not.toHaveBeenCalled();
    expect(speakNeural).toHaveBeenCalledWith('el perro', 'es', expect.objectContaining({ gender: 'm' }), expect.anything());
    speakSequence([{ text: 'el perro', locale: 'es-MX', gender: 'f' }]);
    expect(playPack).toHaveBeenCalledTimes(1);
  });

  it('a stopped segment reports it once, a failed engine carries on with the phone', async () => {
    engineFor.mockReturnValue('piper');
    speakNeural.mockRejectedValueOnce(new Error('boom'));
    const onEnd = jest.fn();
    const onStopped = jest.fn();
    speakSequence([{ text: 'Hola', locale: 'es-MX', pitch: 1.15 }], onEnd, onStopped);
    await flush();
    expect(speech.speak).toHaveBeenCalledWith('Hola', expect.objectContaining({ language: 'es-MX', pitch: 1.15 }));
    engineFor.mockReturnValue('piper');
    speakSequence([{ text: 'Hola', locale: 'es-MX' }], onEnd, onStopped);
    speakNeural.mock.calls[speakNeural.mock.calls.length - 1][3].onStopped();
    expect(onStopped).toHaveBeenCalledTimes(1);
  });
});
