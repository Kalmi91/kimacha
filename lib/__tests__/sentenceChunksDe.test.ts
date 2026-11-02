// The German build-up steps of the Sentences tab (data/sentences/chunks-de.json): the prompt is in the learner's language, the
// target is the German shorter sentence, and the data must still fit the deck sentence. A fixture stands in for the data file.

import { setActiveSource } from '@/lib/languagePair';
import { chunksFor, partFitsSentence } from '@/lib/sentenceChunks';

jest.mock('@/data/sentences/chunks-de.json', () => ({
  d9001: [
    { de: 'Ich esse Brot.', en: 'I eat bread.', es: 'Como pan.', hu: 'Kenyeret eszem.' },
    { de: 'Ich esse Brot und Käse.', en: 'I eat bread and cheese.', es: 'Como pan y queso.', hu: 'Kenyeret és sajtot eszem.' },
  ],
  d9002: [{ de: 'Ich esse Brot.', en: '', es: 'Como pan.', hu: 'Kenyeret eszem.' }],
  d9003: [],
}));

beforeEach(() => setActiveSource('en'));
afterEach(() => setActiveSource(null));

describe('German build-up steps', () => {
  const SENTENCE = 'Ich esse Brot und Käse jeden Tag.';

  it('the prompt is in the learner\'s language, the target is German', () => {
    expect(chunksFor('d9001', 'de', SENTENCE)).toEqual([
      { source: 'I eat bread.', target: 'Ich esse Brot.' },
      { source: 'I eat bread and cheese.', target: 'Ich esse Brot und Käse.' },
    ]);
    setActiveSource('es');
    expect(chunksFor('d9001', 'de', SENTENCE)?.[0]).toEqual({ source: 'Como pan.', target: 'Ich esse Brot.' });
    setActiveSource('hu');
    expect(chunksFor('d9001', 'de', SENTENCE)?.[1].source).toBe('Kenyeret és sajtot eszem.');
  });

  it('none when the data no longer fits the sentence, has no prompt in the language, is empty or missing', () => {
    expect(chunksFor('d9001', 'de', 'Ich trinke Wasser und Tee jeden Tag.')).toBeUndefined();
    expect(chunksFor('d9002', 'de', SENTENCE)).toBeUndefined(); // no English prompt
    expect(chunksFor('d9003', 'de', SENTENCE)).toBeUndefined();
    expect(chunksFor('d0', 'de', SENTENCE)).toBeUndefined();
  });

  it('German is the source: the Spanish steps (English prompts) are not shown', () => {
    setActiveSource('de');
    expect(chunksFor('o1113', 'es', 'Cambio las sábanas cada semana.')).toBeUndefined();
  });

  it('a German step is a shorter sentence made of the sentence\'s own words', () => {
    expect(partFitsSentence('Ich esse Brot.', SENTENCE)).toBe(true);
    expect(partFitsSentence('Ich esse Fleisch.', SENTENCE)).toBe(false);
  });
});
