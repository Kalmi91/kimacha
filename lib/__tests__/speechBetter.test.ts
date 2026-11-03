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
import { speak, speakSequence, speakerGenderFor, stop, resetVoiceCache, loadVoices, missingVoiceLanguages } from '@/lib/speech';
import * as models from '../neuralModels';
import * as engine from '../neuralTts';
import * as pack from '../packAudio';
import { voiceFor } from '../neuralVoices';

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
  it('nothing installed: the phone speaks, after whatever still sounded was cut', () => {
    speak('el perro', 'es-MX');
    expect(speech.speak).toHaveBeenCalledWith('el perro', { language: 'es-MX' });
    expect(speech.stop.mock.invocationCallOrder[0]).toBeLessThan(speech.speak.mock.invocationCallOrder[0]);
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

describe('speakSequence(): one speaker per language (FB543)', () => {
  const WORD = 'el perro'; // hash even: the woman (ef_dora / claude)
  // sentences of the other sex than the word, found through the same voice table the app uses
  const pick = (lang: 'es' | 'en' | 'hu', from: string, otherSex: boolean, candidates: string[]) => {
    const gender = voiceFor(lang, 'kokoro', from).gender;
    const found = candidates.find(c => (voiceFor(lang, 'kokoro', c).gender !== gender) === otherSex);
    if (!found) throw new Error('no candidate');
    return found;
  };
  const ES_SENTENCES = ['El perro duerme.', 'Mi perro es grande.', 'Quiero un perro.', 'El perro corre en el parque.', 'Tengo un perro negro.', 'Ese perro ladra mucho.'];

  it('the sentence after the word gets the sex of the word voice, not its own hash voice', () => {
    engineFor.mockReturnValue('piper');
    const sentence = pick('es', WORD, true, ES_SENTENCES);
    expect(voiceFor('es', 'kokoro', sentence).gender).not.toBe(voiceFor('es', 'kokoro', WORD).gender);
    speakSequence([{ text: WORD, locale: 'es-MX' }, { text: sentence, locale: 'es-MX' }]);
    const wordVoice = speakNeural.mock.calls[0][2];
    speakNeural.mock.calls[0][3].onDone();
    expect(speakNeural).toHaveBeenCalledTimes(2);
    expect(speakNeural.mock.calls[1][0]).toBe(sentence);
    expect(speakNeural.mock.calls[1][2].id).toBe(wordVoice.id);
  });

  it('Kokoro and Piper keep the same speaker: the engine in use does not decide the sex', () => {
    const sentence = pick('es', WORD, true, ES_SENTENCES);
    for (const kind of ['kokoro', 'piper']) {
      speakNeural.mockClear();
      engineFor.mockReturnValue(kind);
      speakSequence([{ text: WORD, locale: 'es-MX' }, { text: sentence, locale: 'es-MX' }]);
      speakNeural.mock.calls[0][3].onDone();
      expect(speakNeural.mock.calls[1][2].gender).toBe(speakNeural.mock.calls[0][2].gender);
    }
  });

  it("the example sentence's own speaker button keeps the word's speaker (speak + speakerGenderFor)", () => {
    engineFor.mockReturnValue('piper');
    const sentence = pick('es', WORD, true, ES_SENTENCES);
    speak(sentence, 'es-MX', { gender: speakerGenderFor(WORD, 'es-MX') });
    expect(speakNeural.mock.calls[0][0]).toBe(sentence);
    expect(speakNeural.mock.calls[0][2].gender).toBe(voiceFor('es', 'kokoro', WORD).gender);
  });

  it('a segment with its own gender keeps it (the practice exam speakers)', () => {
    engineFor.mockReturnValue('piper');
    const sentence = pick('es', WORD, true, ES_SENTENCES);
    const own = voiceFor('es', 'kokoro', sentence).gender;
    speakSequence([{ text: WORD, locale: 'es-MX' }, { text: sentence, locale: 'es-MX', gender: own }]);
    speakNeural.mock.calls[0][3].onDone();
    expect(speakNeural.mock.calls[1][2].gender).toBe(own);
  });

  it('each language has its own speaker: the English segments follow the first English one', () => {
    engineFor.mockReturnValue('piper');
    const EN = ['The dog sleeps.', 'My dog is big.', 'I want a dog.', 'The dog runs in the park.', 'I have a black dog.', 'That dog barks a lot.'];
    const second = pick('en', EN[0], true, EN.slice(1));
    speakSequence([{ text: WORD, locale: 'es-MX' }, { text: EN[0], locale: 'en-US' }, { text: second, locale: 'en-US' }]);
    speakNeural.mock.calls[0][3].onDone();
    speakNeural.mock.calls[1][3].onDone();
    expect(speakNeural).toHaveBeenCalledTimes(3);
    expect(speakNeural.mock.calls[2][2].id).toBe(speakNeural.mock.calls[1][2].id);
  });

  it('a stop() ends the whole chain: the sentences after the one that was cut never start', () => {
    engineFor.mockReturnValue('piper');
    speakSequence([{ text: ES_SENTENCES[0], locale: 'es-MX' }, { text: ES_SENTENCES[1], locale: 'es-MX' }, { text: ES_SENTENCES[2], locale: 'es-MX' }]);
    speakNeural.mock.calls[0][3].onDone();
    expect(speakNeural).toHaveBeenCalledTimes(2);
    stop();
    speakNeural.mock.calls[1][3].onDone(); // a late end event of the cut sentence
    expect(speakNeural).toHaveBeenCalledTimes(2);
  });

  it('Hungarian follows the same rule', () => {
    engineFor.mockReturnValue('piper');
    const HU = ['A kutya alszik.', 'A kutyám nagy.', 'Kutyát szeretnék.', 'A kutya a parkban fut.', 'Van egy fekete kutyám.', 'Az a kutya sokat ugat.'];
    const second = pick('hu', HU[0], true, HU.slice(1));
    speakSequence([{ text: HU[0], locale: 'hu-HU' }, { text: second, locale: 'hu-HU' }]);
    speakNeural.mock.calls[0][3].onDone();
    expect(speakNeural.mock.calls[1][2].id).toBe(speakNeural.mock.calls[0][2].id);
  });

  it('the example of the other hash voice is not played from its pack recording', () => {
    packFile.mockReturnValue('/files/tts/pack/es/x.mp3');
    engineFor.mockReturnValue('piper');
    const sentence = pick('es', WORD, true, ES_SENTENCES);
    speakSequence([{ text: WORD, locale: 'es-MX' }, { text: sentence, locale: 'es-MX' }]);
    expect(playPack).toHaveBeenCalledTimes(1); // the word, its own voice
    playPack.mock.calls[0][1].onDone();
    expect(playPack).toHaveBeenCalledTimes(1); // the sentence recording is of the other sex: the engine speaks it
    expect(speakNeural).toHaveBeenCalledWith(sentence, 'es', expect.anything(), expect.anything());
  });
});
