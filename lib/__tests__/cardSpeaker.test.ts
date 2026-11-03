// Audio round B: the speaker of a deck card's sentences is the sex of the word-pack voice of the card's WHOLE
// answer field (alternatives included), the rule scripts/tts-pack.py collects the sentence-tab and reading
// sentences under.

import type { PcicItem } from '@/data/pcic';
import { wordSpeakerGender } from '../cardSpeaker';
import { DEFAULT_SPEAKERS, voiceFor } from '../neuralVoices';
import { setSpeakerChoice, setSpeakerChoices } from '../voicePreference';

const item = (over: Partial<PcicItem>): PcicItem => ({ id: 'o1', es: 'casa', en: 'house', kind: 'word', section: '', order: 1, ...over });

describe('wordSpeakerGender', () => {
  it('is the sex of the word voice of the full field in the target language', () => {
    for (const es of ['casa', 'el carro / el coche', 'estar']) {
      expect(wordSpeakerGender(item({ es }), 'es')).toBe(voiceFor('es', 'kokoro', es).gender);
    }
    expect(wordSpeakerGender(item({ en: 'the dog' }), 'en')).toBe(voiceFor('en', 'kokoro', 'the dog').gender);
  });

  it('the whole field decides, not its first alternative', () => {
    const whole = 'el carro / el coche';
    expect(wordSpeakerGender(item({ es: whole }), 'es')).toBe(voiceFor('es', 'kokoro', whole).gender);
  });

  it('is undefined without an item, without a word, and for a language the packs do not cover', () => {
    expect(wordSpeakerGender(undefined, 'es')).toBeUndefined();
    expect(wordSpeakerGender(item({ es: '' }), 'es')).toBeUndefined();
    expect(wordSpeakerGender(item({ hu: 'ház' }), 'hu')).toBeUndefined();
  });
});

describe('wordSpeakerGender with a person chosen in Settings -> Voice', () => {
  afterEach(() => setSpeakerChoices({ ...DEFAULT_SPEAKERS }));

  it("is the chosen person of the target language, whatever the word's own voice", () => {
    setSpeakerChoice('es', 'm');
    for (const es of ['casa', 'el carro / el coche', 'estar']) expect(wordSpeakerGender(item({ es }), 'es')).toBe('m');
    setSpeakerChoice('es', 'f');
    expect(wordSpeakerGender(item({ es: 'perro' }), 'es')).toBe('f');
  });

  it("is per language: Spanish chosen leaves English on the word's own voice", () => {
    setSpeakerChoice('es', 'm');
    expect(wordSpeakerGender(item({ en: 'the dog' }), 'en')).toBe(voiceFor('en', 'kokoro', 'the dog').gender);
  });

  it("Automatic again is the word's own voice", () => {
    setSpeakerChoice('en', 'm');
    setSpeakerChoice('en', 'auto');
    expect(wordSpeakerGender(item({ en: 'the dog' }), 'en')).toBe(voiceFor('en', 'kokoro', 'the dog').gender);
  });
});
