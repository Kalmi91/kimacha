import type { PcicItem } from '@/data/pcic';
import {
  learnedEntries,
  stripSentencePunct,
  tileWords,
} from '../sentenceCards';
import type { Sm2Card } from '../sm2';

function card(itemId: string, over: Partial<Sm2Card> = {}): Sm2Card {
  return {
    itemId,
    state: 'review',
    step: 0,
    ease: 2.5,
    interval: 1,
    reps: 1,
    lapses: 0,
    due: '',
    lastReview: null,
    introducedAt: null,
    ...over,
  };
}

function item(id: string, es: string, en: string, exampleEs?: string, exampleEn?: string): PcicItem {
  return { id, es, en, kind: 'word', section: 'test', order: 0, exampleEs, exampleEn };
}

const ITEMS: PcicItem[] = [
  item('w1', 'el libro', 'the book', 'El libro y la mesa.', 'The book and the table.'),
  item('w2', 'la mesa', 'the table', 'La mesa y el libro.', 'The table and the book.'),
  item('w3', 'el gato', 'the cat', 'El gato y el perro.', 'The cat and the dog.'),
  item('w4', 'la casa', 'the house', 'La casa y la mesa.', 'The house and the table.'),
  item('w5', 'el perro', 'the dog'),
  item('w6', 'la silla', 'the chair', 'La silla y la mesa.', 'The chair and the table.'),
  item('w7', 'el vaso', 'the glass', 'El vaso y la casa.', 'The glass and the house.'),
  item('w8', 'la luz', 'the light', 'La luz y el vaso.', 'The light and the glass.'),
];
const BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

describe('stripSentencePunct / tileWords', () => {
  it('strips punctuation and collapses spaces', () => {
    expect(stripSentencePunct('¿Dónde  está el libro?')).toBe('Dónde está el libro');
  });

  it('lowercases only the first tile and drops punctuation', () => {
    expect(tileWords('El libro, Ana.')).toEqual(['el', 'libro', 'Ana']);
  });
});

describe('learnedEntries', () => {
  it('keeps only learned cards whose item exists, with the target-language form', () => {
    const entries = learnedEntries(
      [card('w1'), card('w2', { state: 'new' }), card('w3', { state: 'learning', lapses: 1 }), card('nope')],
      'es',
      (id) => BY_ID.get(id),
    );
    expect(entries.map((e) => e.text)).toEqual(['el libro', 'el gato']);
  });

  it('uses the English form for the es to en direction', () => {
    const entries = learnedEntries([card('w1')], 'en', (id) => BY_ID.get(id));
    expect(entries.map((e) => e.text)).toEqual(['the book']);
  });
});
