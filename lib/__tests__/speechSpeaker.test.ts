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
import { setSpeakerChoice, setSpeakerChoices } from '../voicePreference';

const packFile = models.neuralPackFile as jest.Mock;
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
  packFile.mockReturnValue(null);
  sentenceFile.mockReturnValue(null);
  engineFor.mockReturnValue('piper');
  speakNeural.mockResolvedValue({ firstChunkMs: 1, generatedMs: 2, audioMs: 3, peak: 0.5 });
});
afterAll(() => setSpeakerChoices({ ...DEFAULT_SPEAKERS }));

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
    packFile.mockReturnValue('/files/tts/pack/es/x.mp3');
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
