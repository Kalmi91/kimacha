// Audio round B: the speaker of a deck card's sentences is the sex of the word-pack voice of the card's WHOLE
// answer field (alternatives included), the rule scripts/tts-pack.py collects the sentence-tab and reading
// sentences under.

import type { PcicItem } from '@/data/pcic';
import { wordSpeakerGender } from '../cardSpeaker';
import { voiceFor } from '../neuralVoices';

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
