// Settings -> Voice: the person chosen per language (lib/voicePreference.ts) speaks every speech of that language
// that has no explicit gender: speak(), speakAuto(), the speakSequence segments, speakerGenderFor() and the card
// word's speaker (lib/cardSpeaker.ts). An explicit m / f (the practice exam's dialogue) stays; Automatic keeps
// today's behavior; the word pack is used only when its recording is the chosen person's.

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
  playPackFile: jest.fn(),
  stopPack: jest.fn(),
}));

import { speak, speakAuto, speakSequence, speakerGenderFor, preferredGenderFor, noteSpeechTouch, resetVoiceCache } from '@/lib/speech';
import * as models from '../neuralModels';
import * as engine from '../neuralTts';
import * as pack from '../packAudio';
import { DEFAULT_SPEAKERS, voiceFor, type NeuralLang } from '../neuralVoices';
import { setFastFallback, setSpeakerChoice, setSpeakerChoices } from '../voicePreference';

const packFile = models.neuralPackFile as jest.Mock;
// A pack that has each word in its own hash voice only (v1, or a v2 that lacks the other person): the file answers when the
// speaker asked for is that voice (no gender = the own one), never for the other sex (lib/neuralVoices.ts packFileFor).
const ownVoiceRecording = (file: string) =>
  packFile.mockImplementation((lang: 'es' | 'en', text: string, g?: string) => (!g || g === 'n' || voiceFor(lang, 'kokoro', text).gender === g ? file : null));
const sentenceFile = models.neuralSentenceFile as jest.Mock;
const engineFor = models.neuralEngineFor as jest.Mock;
const speakNeural = engine.speakNeural as jest.Mock;
const playPack = pack.playPackFile as jest.Mock;

const TEXTS = ['el perro', 'la casa', 'el gato', 'la mesa', 'el libro', 'la silla', 'el carro', 'la puerta', 'el sol', 'la luna'];
const esText = (gender: 'f' | 'm') => {
  const found = TEXTS.find(text => voiceFor('es', 'kokoro', text).gender === gender);
  if (!found) throw new Error('no candidate');
  return found;
};

beforeEach(() => {
  jest.clearAllMocks();
  resetVoiceCache();
  setSpeakerChoices({ ...DEFAULT_SPEAKERS });
  setFastFallback(false); // the tests above are the pure picked-person behavior; the fast fallback has its own block
  packFile.mockReturnValue(null);
  sentenceFile.mockReturnValue(null);
  engineFor.mockReturnValue('piper');
  speakNeural.mockResolvedValue({ firstChunkMs: 1, generatedMs: 2, audioMs: 3, peak: 0.5 });
});
afterAll(() => {
  setSpeakerChoices({ ...DEFAULT_SPEAKERS });
  setFastFallback(true);
});

describe('Automatic: today\'s behavior', () => {
  it('each text keeps its own hash voice and the packs are asked without a gender', () => {
    const word = esText('m');
    speak(word, 'es-MX');
    expect(speakNeural.mock.calls[0][2].gender).toBe('m');
    expect(sentenceFile).toHaveBeenCalledWith('es', word, undefined);
    expect(speakerGenderFor(word, 'es-MX')).toBe('m');
    expect(preferredGenderFor('es-MX')).toBeUndefined();
  });
});

describe('a chosen person speaks everything of the language that has no explicit gender', () => {
  it('speak(): the engine voice is the chosen person, whatever the text\'s hash voice', () => {
    setSpeakerChoice('es', 'm');
    speak(esText('f'), 'es-MX');
    expect(speakNeural.mock.calls[0][2].gender).toBe('m');
    setSpeakerChoice('es', 'f');
    speak(esText('m'), 'es-MX');
    expect(speakNeural.mock.calls[1][2].gender).toBe('f');
  });

  it('speakAuto() (the automatic reading) uses the chosen person too', () => {
    noteSpeechTouch();
    setSpeakerChoice('es', 'm');
    speakAuto(esText('f'), 'es-MX');
    expect(speakNeural.mock.calls[0][2].gender).toBe('m');
  });

  it('the sentence pack is asked for the chosen person\'s recording', () => {
    setSpeakerChoice('es', 'm');
    const text = esText('f');
    speak(text, 'es-MX');
    expect(sentenceFile).toHaveBeenCalledWith('es', text, 'm');
  });

  it('the word pack is used only when its recording is the chosen person\'s', () => {
    ownVoiceRecording('/files/tts/pack/es/x.mp3');
    setSpeakerChoice('es', 'f');
    speak(esText('m'), 'es-MX'); // the word's recording is the man: not the chosen woman
    expect(playPack).not.toHaveBeenCalled();
    expect(speakNeural.mock.calls[0][2].gender).toBe('f');
    speak(esText('f'), 'es-MX'); // the word's recording is the woman: it is used
    expect(playPack).toHaveBeenCalledTimes(1);
    expect(playPack.mock.calls[0][0]).toBe('/files/tts/pack/es/x.mp3');
  });

  it('an explicit m / f stays (the practice exam\'s speakers)', () => {
    setSpeakerChoice('es', 'm');
    speak(esText('m'), 'es-MX', { gender: 'f' });
    expect(speakNeural.mock.calls[0][2].gender).toBe('f');
    expect(sentenceFile).toHaveBeenLastCalledWith('es', esText('m'), 'f');
  });

  it('the choice is per language: Spanish chosen leaves English and Hungarian alone', () => {
    setSpeakerChoice('es', 'm');
    const en = ['the dog', 'the cat', 'the house', 'the table'];
    const enF = en.find(text => voiceFor('en', 'kokoro', text).gender === 'f') as string;
    speak(enF, 'en-US');
    expect(speakNeural.mock.calls[0][2].gender).toBe('f');
    expect(preferredGenderFor('en-US')).toBeUndefined();
    expect(preferredGenderFor('hu-HU')).toBeUndefined();
  });

  it.each([['hu' as NeuralLang, 'f', 'hu_HU-berta-medium'], ['hu' as NeuralLang, 'm', 'hu_HU-imre-medium']] as const)(
    'Hungarian (%s) chosen %s: %s speaks',
    (lang, gender, id) => {
      setSpeakerChoice(lang, gender);
      speak('Jó napot kívánok', 'hu-HU');
      expect(speakNeural.mock.calls[0][2].id).toBe(id);
    },
  );

  it('speakerGenderFor() and preferredGenderFor() name the chosen person; a language without the better voice has none', () => {
    setSpeakerChoice('es', 'm');
    expect(speakerGenderFor(esText('f'), 'es-MX')).toBe('m');
    expect(preferredGenderFor('es-MX')).toBe('m');
    expect(speakerGenderFor('hello', 'fr-FR')).toBeUndefined();
    expect(preferredGenderFor('fr-FR')).toBeUndefined();
  });
});

// Temporary until EJSZAKA E101 (both voices recorded), Kálmán 2026-11-03: with the "Fast fallback" switch on, a picked
// person with no recording of the text gets the existing recording of the other person instead of the engine.
describe('fast fallback: the picked person has no recording', () => {
  const OTHER = '/files/tts/sentences/es/other.mp3';
  beforeEach(() => setFastFallback(true));

  it('the word pack own-voice file plays at once, not the engine', () => {
    setSpeakerChoice('es', 'f');
    ownVoiceRecording('/files/tts/pack/es/x.mp3'); // the word's recording is the man
    speak(esText('m'), 'es-MX');
    expect(playPack).toHaveBeenCalledTimes(1);
    expect(playPack.mock.calls[0][0]).toBe('/files/tts/pack/es/x.mp3');
    expect(speakNeural).not.toHaveBeenCalled();
  });

  it('else the sentence pack other speaker plays, asked after the picked one', () => {
    setSpeakerChoice('es', 'f');
    const text = esText('f');
    sentenceFile.mockImplementation((_lang: string, _text: string, g?: string) => (g === 'm' ? OTHER : null));
    speak(text, 'es-MX');
    expect(sentenceFile.mock.calls.map(call => call[2])).toEqual(['f', 'm']);
    expect(playPack.mock.calls[0][0]).toBe(OTHER);
    expect(speakNeural).not.toHaveBeenCalled();
  });

  it('else the sentence pack own-hash recording (asked without a gender) plays', () => {
    setSpeakerChoice('es', 'm');
    sentenceFile.mockImplementation((_lang: string, _text: string, g?: string) => (g === undefined ? OTHER : null));
    speak('Tengo un perro negro.', 'es-MX');
    expect(sentenceFile.mock.calls.map(call => call[2])).toEqual(['m', 'f', undefined]);
    expect(playPack.mock.calls[0][0]).toBe(OTHER);
  });

  it('no recording of either person: the engine speaks, as the picked person', () => {
    setSpeakerChoice('es', 'm');
    speak(esText('f'), 'es-MX');
    expect(playPack).not.toHaveBeenCalled();
    expect(speakNeural.mock.calls[0][2].gender).toBe('m');
  });

  it('the own recording of the picked person wins: the other one is not even asked for', () => {
    setSpeakerChoice('es', 'f');
    sentenceFile.mockImplementation((_lang: string, _text: string, g?: string) => (g === 'f' ? '/files/tts/sentences/es/picked.mp3' : OTHER));
    speak('Tengo un perro negro.', 'es-MX');
    expect(playPack.mock.calls[0][0]).toBe('/files/tts/sentences/es/picked.mp3');
    expect(sentenceFile).toHaveBeenCalledTimes(1);
  });

  it('a file that fails to play hands the text to the engine, still as the picked person', () => {
    setSpeakerChoice('es', 'f');
    ownVoiceRecording('/files/tts/pack/es/x.mp3');
    speak(esText('m'), 'es-MX');
    expect(speakNeural).not.toHaveBeenCalled();
    playPack.mock.calls[0][1].onFail();
    expect(speakNeural.mock.calls[0][2].gender).toBe('f');
  });

  it('switch off: the engine speaks as before, the other recording is not used', () => {
    setFastFallback(false);
    setSpeakerChoice('es', 'f');
    ownVoiceRecording('/files/tts/pack/es/x.mp3');
    sentenceFile.mockReturnValue(null);
    speak(esText('m'), 'es-MX');
    expect(playPack).not.toHaveBeenCalled();
    expect(speakNeural.mock.calls[0][2].gender).toBe('f');
  });

  it('an explicit exam sex never takes the other sex: the engine speaks, only that sex is asked for', () => {
    setSpeakerChoice('es', 'm');
    ownVoiceRecording('/files/tts/pack/es/x.mp3');
    sentenceFile.mockImplementation((_lang: string, _text: string, g?: string) => (g === 'f' ? null : OTHER));
    speak(esText('m'), 'es-MX', { gender: 'f' }); // the word pack's file is the man, the exam line is a woman
    expect(playPack).not.toHaveBeenCalled();
    expect(speakNeural.mock.calls[0][2].gender).toBe('f');
    expect(sentenceFile.mock.calls.map(call => call[2])).toEqual(['f']);
  });

  it('Automatic is untouched: no picked person, no fallback', () => {
    sentenceFile.mockImplementation((_lang: string, _text: string, g?: string) => (g === undefined ? null : OTHER));
    speak(esText('f'), 'es-MX');
    expect(playPack).not.toHaveBeenCalled();
    expect(sentenceFile.mock.calls.map(call => call[2])).toEqual([undefined]);
  });

  // withSharedSpeaker / wordSpeakerGender hand the picked person in as an explicit gender: the fallback still applies.
  const otherSex = (text: string, g?: string) => (g === 'f' ? `/files/tts/sentences/es/${text.length}-f.mp3` : null);

  it('speakSequence [word, sentence]: both fall back to the other recording when the picked person has none', () => {
    setSpeakerChoice('es', 'm');
    sentenceFile.mockImplementation((_lang: string, text: string, g?: string) => otherSex(text, g));
    const word = esText('f');
    const sentence = 'Tengo un perro negro.';
    speakSequence([{ text: word, locale: 'es-MX' }, { text: sentence, locale: 'es-MX' }]);
    expect(playPack).toHaveBeenCalledTimes(1);
    expect(playPack.mock.calls[0][0]).toBe(`/files/tts/sentences/es/${word.length}-f.mp3`);
    playPack.mock.calls[0][1].onDone();
    expect(playPack).toHaveBeenCalledTimes(2);
    expect(playPack.mock.calls[1][0]).toBe(`/files/tts/sentences/es/${sentence.length}-f.mp3`);
    expect(speakNeural).not.toHaveBeenCalled();
  });

  it('speakSequence with strict lines (the exam\'s dialogue) goes to the engine, as the explicit sex', () => {
    setSpeakerChoice('es', 'm');
    sentenceFile.mockImplementation((_lang: string, text: string, g?: string) => otherSex(text, g));
    speakSequence([
      { text: 'Tengo un perro negro.', locale: 'es-MX', gender: 'm', strict: true },
      { text: 'Buenos días.', locale: 'es-MX', gender: 'm', strict: true },
    ]);
    expect(playPack).not.toHaveBeenCalled();
    expect(speakNeural.mock.calls[0][2].gender).toBe('m');
    speakNeural.mock.calls[0][3].onDone();
    expect(speakNeural).toHaveBeenCalledTimes(2);
    expect(playPack).not.toHaveBeenCalled();
    expect(sentenceFile.mock.calls.map(call => call[2])).toEqual(['m', 'm']);
  });

  it('speak() with the picked person as the gender (speakerGenderFor / wordSpeakerGender) falls back; strict does not', () => {
    setSpeakerChoice('es', 'f');
    const text = esText('m');
    const gender = speakerGenderFor(text, 'es-MX');
    expect(gender).toBe('f');
    ownVoiceRecording('/files/tts/pack/es/x.mp3'); // the word's recording is the man
    speak(text, 'es-MX', { gender });
    expect(playPack).toHaveBeenCalledTimes(1);
    expect(playPack.mock.calls[0][0]).toBe('/files/tts/pack/es/x.mp3');
    speak(text, 'es-MX', { gender, strict: true });
    expect(playPack).toHaveBeenCalledTimes(1);
    expect(speakNeural.mock.calls[0][2].gender).toBe('f');
  });
});

describe('speakSequence(): one chosen person for every segment of the language', () => {
  it('a word and its sentence are both spoken by the chosen person, not by the word\'s hash voice', () => {
    setSpeakerChoice('es', 'm');
    const word = esText('f');
    speakSequence([{ text: word, locale: 'es-MX' }, { text: 'Tengo un perro negro.', locale: 'es-MX' }]);
    expect(speakNeural.mock.calls[0][2].gender).toBe('m');
    speakNeural.mock.calls[0][3].onDone();
    expect(speakNeural).toHaveBeenCalledTimes(2);
    expect(speakNeural.mock.calls[1][2].gender).toBe('m');
    expect(sentenceFile).toHaveBeenLastCalledWith('es', 'Tengo un perro negro.', 'm');
  });

  it('the exam\'s dialogue speakers (m / f) stay, whatever is chosen', () => {
    setSpeakerChoice('es', 'm');
    speakSequence([
      { text: 'Hola.', locale: 'es-MX', gender: 'f' },
      { text: 'Buenos días.', locale: 'es-MX', gender: 'm' },
    ]);
    expect(speakNeural.mock.calls[0][2].gender).toBe('f');
    speakNeural.mock.calls[0][3].onDone();
    expect(speakNeural.mock.calls[1][2].gender).toBe('m');
  });

  it('the exam\'s narrator lines (n) take the chosen person', () => {
    setSpeakerChoice('es', 'f');
    speakSequence([
      { text: esText('m'), locale: 'es-MX', gender: 'n' },
      { text: `${esText('m')} otra vez`, locale: 'es-MX', gender: 'n' },
    ]);
    expect(speakNeural.mock.calls[0][2].gender).toBe('f');
    speakNeural.mock.calls[0][3].onDone();
    expect(speakNeural.mock.calls[1][2].gender).toBe('f');
  });

  it('without a chosen person a neutral (n) segment is left as it was', () => {
    speakSequence([{ text: esText('m'), locale: 'es-MX', gender: 'n' }]);
    expect(speakNeural.mock.calls[0][2].gender).toBe('m');
    expect(sentenceFile).toHaveBeenCalledWith('es', esText('m'), 'n');
  });
});
