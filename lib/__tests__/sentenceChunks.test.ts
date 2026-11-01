// The shorter sentences a long example sentence is built up from (lib/sentenceChunks.ts, FB524, FB538): only for the
// Spanish direction and only while every one of them still fits the sentence (its words, fewer of them). The data
// (data/sentences/chunks.json) is checked on its own in data/__tests__, so this test runs on a fixture.

import type { PcicItem } from '@/data/pcic';
import { chunksFor, partFitsSentence } from '../sentenceChunks';
import { buildSentenceQueue } from '../sentenceTab';
import { sm2NewCard, type Sm2Card } from '../sm2';

jest.mock('@/data/sentences/chunks.json', () => ({
  o1113: [{ es: 'Cambio las sábanas.', en: 'I change the sheets.' }],
  o2: [],
}));

const SENTENCE = 'Cambio las sábanas cada semana.';

describe('chunksFor', () => {
  it('Spanish direction: the shorter sentences, English as the prompt and Spanish as the target', () => {
    expect(chunksFor('o1113', 'es', SENTENCE)).toEqual([{ source: 'I change the sheets.', target: 'Cambio las sábanas.' }]);
  });

  it('the English direction has none', () => {
    expect(chunksFor('o1113', 'en', SENTENCE)).toBeUndefined();
  });

  it('a sentence the data no longer fits (rewritten, or no longer longer) has none; surrounding spaces do not matter', () => {
    expect(chunksFor('o1113', 'es', 'Cambio la cama cada día.')).toBeUndefined();
    expect(chunksFor('o1113', 'es', 'Cambio las sábanas.')).toBeUndefined();
    expect(chunksFor('o1113', 'es', `  ${SENTENCE} `)).toHaveLength(1);
  });

  it('an item with no entry, or an empty one (no natural shorter sentence), has none', () => {
    expect(chunksFor('no-such-item', 'es', SENTENCE)).toBeUndefined();
    expect(chunksFor('o2', 'es', SENTENCE)).toBeUndefined();
  });
});

describe('partFitsSentence', () => {
  it('only words of the sentence, each at most as often, fewer of them; capitals and punctuation do not count', () => {
    expect(partFitsSentence('Mi madre plancha.', 'Mi madre plancha mi camisa.')).toBe(true);
    expect(partFitsSentence('Como con mi familia.', 'El domingo como con mi familia.')).toBe(true);
    expect(partFitsSentence('Mi madre plancha mi ropa.', 'Mi madre plancha mi camisa.')).toBe(false); // a new word
    expect(partFitsSentence('Mi mi madre.', 'Mi madre plancha.')).toBe(false); // "mi" twice
    expect(partFitsSentence('Mi madre plancha mi camisa.', 'Mi madre plancha mi camisa.')).toBe(false); // not shorter
    expect(partFitsSentence('', 'Mi madre plancha.')).toBe(false);
  });
});

describe('buildSentenceQueue carries the shorter sentences', () => {
  const mk = (id: string, es: string, exampleEs: string, exampleEn: string): PcicItem => ({ id, es, en: es, kind: 'word', section: 'Test', order: 1, exampleEs, exampleEn });
  const sheets = mk('o1113', 'cambio las sábanas cada semana', SENTENCE, 'I change the sheets every week.');
  const plain = mk('a1-plain', 'el gato', 'El gato.', 'The cat.');
  const items = [sheets, plain];
  const findItem = (id: string) => items.find((i) => i.id === id);
  const learned = (item: PcicItem): Sm2Card => ({ ...sm2NewCard(item.id), state: 'review', interval: 3, reps: 2, due: '2026-10-20', lastReview: '2026-10-09', introducedAt: '2026-10-09' });

  it('an entry with written steps has them; one without has no `chunks` key; the English direction has none', () => {
    const q = buildSentenceQueue({ target: 'es', cards: items.map(learned), items, findItem, today: '2026-10-12' });
    const byId = new Map(q.map((e) => [e.itemId, e]));
    expect(byId.get('o1113')?.chunks).toEqual([{ source: 'I change the sheets.', target: 'Cambio las sábanas.' }]);
    expect(byId.has('a1-plain')).toBe(true);
    expect('chunks' in byId.get('a1-plain')!).toBe(false);
    const en = buildSentenceQueue({ target: 'en', cards: items.map(learned), items, findItem, today: '2026-10-12' });
    expect(en.every((e) => !('chunks' in e))).toBe(true);
  });
});
