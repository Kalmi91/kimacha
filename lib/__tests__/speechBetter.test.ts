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
  neuralSentenceFile: jest.fn(() => null),
  neuralEngineFor: jest.fn(() => null),
  neuralFallbackEngine: jest.fn(() => null),
  noteNeuralTrouble: jest.fn(),
  noteNeuralOk: jest.fn(),
  releaseStandIns: jest.fn(async () => {}),
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
const sentenceFile = models.neuralSentenceFile as jest.Mock;
const engineFor = models.neuralEngineFor as jest.Mock;
const fallbackEngine = models.neuralFallbackEngine as jest.Mock;
const noteTrouble = models.noteNeuralTrouble as jest.Mock;
const noteOk = models.noteNeuralOk as jest.Mock;
const speakNeural = engine.speakNeural as jest.Mock;
const playPack = pack.playPackFile as jest.Mock;

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(() => {
  jest.clearAllMocks();
  resetVoiceCache();
  packFile.mockReturnValue(null);
  sentenceFile.mockReturnValue(null);
  engineFor.mockReturnValue(null);
  fallbackEngine.mockReturnValue(null);
  speakNeural.mockResolvedValue({ firstChunkMs: 1, generatedMs: 2, audioMs: 3, peak: 0.5 });
});
afterEach(() => stop());

describe('speak(): the levels', () => {
  it('nothing installed: the phone speaks, after whatever still sounded was cut', () => {
    speak('el perro', 'es-MX');
    expect(speech.speak).toHaveBeenCalledWith('el perro', expect.objectContaining({ language: 'es-MX' }));
    expect(speech.stop.mock.invocationCallOrder[0]).toBeLessThan(speech.speak.mock.invocationCallOrder[0]);
    expect(playPack).not.toHaveBeenCalled();
    expect(speakNeural).not.toHaveBeenCalled();
  });

  it('a card word in the pack plays its file, with the speed and the callbacks', () => {
    packFile.mockReturnValue('/files/tts/pack/es/27956ac4.mp3');
    engineFor.mockReturnValue('piper');
    const onDone = jest.fn();
    speak('el perro', 'es-MX', { rate: 0.8, onDone });
    expect(packFile).toHaveBeenCalledWith('es', 'el perro', undefined);
    expect(playPack).toHaveBeenCalledWith('/files/tts/pack/es/27956ac4.mp3', expect.objectContaining({ rate: 0.8, onDone: expect.any(Function) }));
    playPack.mock.calls[0][1].onDone();
    expect(onDone).toHaveBeenCalledTimes(1);
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
    expect(speech.speak).toHaveBeenCalledWith('el perro', expect.objectContaining({ language: 'es-MX' }));
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

  it('every engine speech carries a time limit for its first audio, longer for Kokoro and for longer text', () => {
    engineFor.mockReturnValue('kokoro');
    speak('Hola', 'es-MX');
    speak('Quiero otro café con leche, por favor, y también un vaso de agua fría.', 'es-MX');
    const limits = speakNeural.mock.calls.map(c => c[3].firstChunkTimeoutMs);
    expect(limits[0]).toBeGreaterThanOrEqual(4000);
    expect(limits[1]).toBeGreaterThan(limits[0]);
    expect(limits[1]).toBeLessThanOrEqual(9000);
  });

  it('a too-slow chosen engine hands over to the other engine if it is loaded, and a second failure to the phone', async () => {
    const slow = Object.assign(new Error('neural voice too slow'), { name: 'NeuralSlowError' });
    engineFor.mockReturnValue('kokoro');
    fallbackEngine.mockImplementation((_lang: string, failed: string) => (failed === 'kokoro' ? 'piper' : null));
    speakNeural.mockRejectedValueOnce(slow).mockRejectedValueOnce(new Error('piper down'));
    speak('Quiero otro café con leche.', 'es-MX');
    await flush();
    expect(speakNeural).toHaveBeenCalledTimes(2);
    expect(speakNeural.mock.calls[1][2].engine).toBe('piper');
    expect(noteTrouble).toHaveBeenNthCalledWith(1, 'es', 'kokoro', 'slow');
    expect(noteTrouble).toHaveBeenNthCalledWith(2, 'es', 'piper', 'failed');
    expect(speech.speak).toHaveBeenCalledTimes(1); // the phone, last
    expect(fallbackEngine).toHaveBeenCalledTimes(1); // the stand-in never hands on again
  });

  it('an engine that spoke clears its trouble; the learner\'s own cut (busy) is not reported at all', async () => {
    engineFor.mockReturnValue('kokoro');
    speak('Hola amigo', 'es-MX');
    await flush();
    expect(noteOk).toHaveBeenCalledWith('es', 'kokoro');
    fallbackEngine.mockReturnValue('piper');
    speakNeural.mockRejectedValueOnce(Object.assign(new Error('busy'), { name: 'NeuralBusyError' }));
    speak('Hola amigo', 'es-MX');
    await flush();
    expect(noteTrouble).not.toHaveBeenCalled();
    expect(speakNeural).toHaveBeenLastCalledWith('Hola amigo', 'es', expect.objectContaining({ engine: 'piper' }), expect.anything());
  });

  it('a language the phone has no voice for still ends the speech (onDone), so a read-aloud chain goes on', async () => {
    (speech.getAvailableVoicesAsync as jest.Mock).mockResolvedValue([{ language: 'en-US' }]);
    await loadVoices();
    const onDone = jest.fn();
    speak('a kutya', 'hu-HU', { onDone });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('with no other engine loaded the slow engine hands straight to the phone', async () => {
    engineFor.mockReturnValue('kokoro');
    fallbackEngine.mockReturnValue(null);
    speakNeural.mockRejectedValue(Object.assign(new Error('x'), { name: 'NeuralSlowError' }));
    speak('Quiero otro café con leche.', 'es-MX');
    await flush();
    expect(speakNeural).toHaveBeenCalledTimes(1);
    expect(speech.speak).toHaveBeenCalledWith('Quiero otro café con leche.', expect.objectContaining({ language: 'es-MX' }));
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
    speak('Bonjour', 'fr-FR');
    expect(speech.speak).toHaveBeenCalledWith('Bonjour', expect.objectContaining({ language: 'fr-FR' }));
    expect(playPack).not.toHaveBeenCalled();
  });

  it('German speaks with the German Piper voice when it is installed', () => {
    engineFor.mockReturnValue('piper');
    speak('der Hund', 'de-DE');
    expect(engineFor).toHaveBeenCalledWith('de');
    expect(speakNeural).toHaveBeenCalledTimes(1);
    expect(speakNeural).toHaveBeenCalledWith('der Hund', 'de', expect.objectContaining({ id: expect.stringMatching(/^de_DE-(kerstin-low|thorsten-medium)$/), engine: 'piper' }), expect.anything());
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it('German falls back to the phone de-DE voice when the German voice is not installed', () => {
    engineFor.mockReturnValue(null);
    packFile.mockReturnValue(null);
    speak('der Hund', 'de-DE');
    expect(speakNeural).not.toHaveBeenCalled();
    expect(speech.speak).toHaveBeenCalledWith('der Hund', expect.objectContaining({ language: 'de-DE' }));
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
    // "el perro": hash even = ef_dora, a woman; the pack has the recording of the sex that is asked for (v2: the man too, see
    // the recordings below), so this stands for a pack that lacks the man's
    packFile.mockImplementation((_lang: string, _text: string, g?: string) => (g === 'f' ? '/files/tts/pack/es/27956ac4.mp3' : null));
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
    expect(onStopped).toHaveBeenCalledTimes(1); // starting this recording stopped the previous one
    speakNeural.mock.calls[speakNeural.mock.calls.length - 1][3].onStopped();
    expect(onStopped).toHaveBeenCalledTimes(2);
    speakNeural.mock.calls[speakNeural.mock.calls.length - 1][3].onStopped();
    expect(onStopped).toHaveBeenCalledTimes(2);
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
    packFile.mockImplementation((_lang: string, text: string) => (text === WORD ? '/files/tts/pack/es/x.mp3' : null));
    engineFor.mockReturnValue('piper');
    const sentence = pick('es', WORD, true, ES_SENTENCES);
    speakSequence([{ text: WORD, locale: 'es-MX' }, { text: sentence, locale: 'es-MX' }]);
    expect(playPack).toHaveBeenCalledTimes(1); // the word, its own voice
    playPack.mock.calls[0][1].onDone();
    expect(playPack).toHaveBeenCalledTimes(1); // the sentence recording is of the other sex: the engine speaks it
    expect(speakNeural).toHaveBeenCalledWith(sentence, 'es', expect.anything(), expect.anything());
  });
});

describe('speak(): the sentence pack (Audio round B)', () => {
  const SENTENCE = 'El perro duerme en el sofá.';

  it('a sentence of the pack plays its file after the word pack missed; the word pack is asked first', () => {
    sentenceFile.mockReturnValue('/files/tts/sentences/es/f/abc.mp3');
    engineFor.mockReturnValue('piper');
    const onDone = jest.fn();
    speak(SENTENCE, 'es-MX', { rate: 0.9, onDone });
    expect(packFile).toHaveBeenCalledWith('es', SENTENCE, undefined);
    expect(sentenceFile).toHaveBeenCalledWith('es', SENTENCE, undefined); // no gender: the pack uses the text's own hash gender
    expect(playPack).toHaveBeenCalledWith('/files/tts/sentences/es/f/abc.mp3', expect.objectContaining({ rate: 0.9, onDone: expect.any(Function) }));
    playPack.mock.calls[0][1].onDone();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(speakNeural).not.toHaveBeenCalled();
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it('the word pack wins: a card word never asks the sentence pack', () => {
    packFile.mockReturnValue('/files/tts/pack/es/27956ac4.mp3');
    sentenceFile.mockReturnValue('/files/tts/sentences/es/f/abc.mp3');
    speak('el perro', 'es-MX');
    expect(playPack).toHaveBeenCalledWith('/files/tts/pack/es/27956ac4.mp3', expect.anything());
    expect(sentenceFile).not.toHaveBeenCalled();
  });

  it('the explicit gender goes to the lookup, and a word recording of the other sex is skipped for it', () => {
    const ownGender = voiceFor('es', 'kokoro', SENTENCE).gender;
    const other = ownGender === 'f' ? 'm' : 'f';
    packFile.mockImplementation((_lang: string, _text: string, g?: string) => (g === ownGender ? '/files/tts/pack/es/x.mp3' : null)); // a recording of the sentence's own voice only
    sentenceFile.mockReturnValue('/files/tts/sentences/es/other/y.mp3');
    engineFor.mockReturnValue('piper');
    speak(SENTENCE, 'es-MX', { gender: other });
    expect(sentenceFile).toHaveBeenCalledWith('es', SENTENCE, other);
    expect(playPack).toHaveBeenCalledWith('/files/tts/sentences/es/other/y.mp3', expect.anything());
  });

  it('a sentence that is not in the pack goes to the engine, as before', () => {
    engineFor.mockReturnValue('piper');
    speak(SENTENCE, 'es-MX');
    expect(sentenceFile).toHaveBeenCalled();
    expect(playPack).not.toHaveBeenCalled();
    expect(speakNeural).toHaveBeenCalledWith(SENTENCE, 'es', expect.anything(), expect.anything());
  });

  it('a sentence-pack file that cannot be played falls to the engine, and an engine that fails to the phone', async () => {
    sentenceFile.mockReturnValue('/files/tts/sentences/es/f/broken.mp3');
    engineFor.mockReturnValue('piper');
    speakNeural.mockRejectedValue(new Error('engine down'));
    speak(SENTENCE, 'es-MX');
    playPack.mock.calls[0][1].onFail();
    expect(speakNeural).toHaveBeenCalledTimes(1);
    expect(speakNeural).toHaveBeenCalledWith(SENTENCE, 'es', expect.anything(), expect.anything());
    await flush();
    expect(speech.speak).toHaveBeenCalledWith(SENTENCE, expect.objectContaining({ language: 'es-MX' }));
  });

  it('the sentence pack alone (no engine installed) still speaks; without both the phone speaks', () => {
    sentenceFile.mockReturnValue('/files/tts/sentences/es/f/abc.mp3');
    speak(SENTENCE, 'es-MX');
    expect(playPack).toHaveBeenCalledTimes(1);
    sentenceFile.mockReturnValue(null);
    speak(SENTENCE, 'es-MX');
    expect(speech.speak).toHaveBeenCalledWith(SENTENCE, expect.objectContaining({ language: 'es-MX' }));
  });

  it('a sequence looks each segment up with its speaker: the first segment decides, an explicit gender stays', () => {
    sentenceFile.mockReturnValue('/files/tts/sentences/es/f/abc.mp3');
    engineFor.mockReturnValue('piper');
    const first = voiceFor('es', 'kokoro', 'la casa').gender;
    const forced = first === 'f' ? 'm' : 'f';
    speakSequence([
      { text: 'la casa', locale: 'es-MX' },
      { text: SENTENCE, locale: 'es-MX' },
      { text: 'Otra oración.', locale: 'es-MX', gender: forced },
    ]);
    playPack.mock.calls[0][1].onDone();
    playPack.mock.calls[1][1].onDone();
    expect(sentenceFile).toHaveBeenNthCalledWith(1, 'es', 'la casa', first);
    expect(sentenceFile).toHaveBeenNthCalledWith(2, 'es', SENTENCE, first);
    expect(sentenceFile).toHaveBeenNthCalledWith(3, 'es', 'Otra oración.', forced);
  });
});
