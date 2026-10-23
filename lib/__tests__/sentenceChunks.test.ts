// The parts of a long example sentence (lib/sentenceChunks.ts, FB524): only for the Spanish direction and only while the
// written parts still add up to the sentence. The data (data/sentences/chunks.json) grows, so the test runs on its own
// fixture, not on the file.

import type { PcicItem } from '@/data/pcic';
import { chunksFor } from '../sentenceChunks';
import { buildSentenceQueue } from '../sentenceTab';
import { sm2NewCard, type Sm2Card } from '../sm2';

jest.mock('@/data/sentences/chunks.json', () => ({
  o1113: [
    { es: 'Cambio las sábanas', en: 'I change the sheets' },
    { es: 'cada semana.', en: 'every week' },
  ],
}));

const SENTENCE = 'Cambio las sábanas cada semana.';

describe('chunksFor', () => {
  it('Spanish direction: the parts, English as the prompt and Spanish as the target', () => {
    expect(chunksFor('o1113', 'es', SENTENCE)).toEqual([
      { source: 'I change the sheets', target: 'Cambio las sábanas' },
      { source: 'every week', target: 'cada semana.' },
    ]);
  });

  it('the English direction has no parts', () => {
    expect(chunksFor('o1113', 'en', SENTENCE)).toBeUndefined();
  });

  it('a sentence that no longer matches the parts (the data slipped) has none; surrounding spaces do not matter', () => {
    expect(chunksFor('o1113', 'es', 'Cambio las sábanas cada día.')).toBeUndefined();
    expect(chunksFor('o1113', 'es', 'Cambio las sábanas.')).toBeUndefined();
    expect(chunksFor('o1113', 'es', `  ${SENTENCE} `)).toHaveLength(2);
  });

  it('an item with no entry has none', () => {
    expect(chunksFor('no-such-item', 'es', SENTENCE)).toBeUndefined();
  });
});

describe('buildSentenceQueue carries the parts', () => {
  const mk = (id: string, es: string, exampleEs: string, exampleEn: string): PcicItem => ({ id, es, en: es, kind: 'word', section: 'Test', order: 1, exampleEs, exampleEn });
  const sheets = mk('o1113', 'cambio las sábanas cada semana', SENTENCE, 'I change the sheets every week.');
  const plain = mk('a1-plain', 'el gato', 'El gato.', 'The cat.');
  const items = [sheets, plain];
  const findItem = (id: string) => items.find((i) => i.id === id);
  const learned = (item: PcicItem): Sm2Card => ({ ...sm2NewCard(item.id), state: 'review', interval: 3, reps: 2, due: '2026-10-20', lastReview: '2026-10-09', introducedAt: '2026-10-09' });

  it('an entry with written parts has them; one without has no `chunks` key; the English direction has none', () => {
    const q = buildSentenceQueue({ target: 'es', cards: items.map(learned), items, findItem, today: '2026-10-12' });
    const byId = new Map(q.map((e) => [e.itemId, e]));
    expect(byId.get('o1113')?.chunks).toEqual([
      { source: 'I change the sheets', target: 'Cambio las sábanas' },
      { source: 'every week', target: 'cada semana.' },
    ]);
    expect(byId.has('a1-plain')).toBe(true);
    expect('chunks' in byId.get('a1-plain')!).toBe(false);
    const en = buildSentenceQueue({ target: 'en', cards: items.map(learned), items, findItem, today: '2026-10-12' });
    expect(en.every((e) => !('chunks' in e))).toBe(true);
  });
});
