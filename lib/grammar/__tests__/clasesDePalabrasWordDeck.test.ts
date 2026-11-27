// FB762: the "Practice the words" deck of clases-de-palabras had 10 words (adjectives and one adverb).
// It now covers every word class the lesson teaches: at least 30 words, at least 4 per class.

import { lessonFor } from '../syllabus';
import { wordCellsForLesson } from '../tableDeck';

const lesson = lessonFor('es', 'clases-de-palabras');
if (!lesson) throw new Error('clases-de-palabras must exist');

const CLASSES: Record<string, string[]> = {
  noun: ['casa', 'perro', 'mesa', 'libro', 'ciudad', 'amigo'],
  verb: ['hablar', 'comer', 'vivir', 'trabajar', 'estudiar', 'escribir'],
  adjective: ['rápido', 'feliz', 'tranquilo', 'fácil', 'lento', 'fuerte', 'triste', 'difícil', 'amable'],
  adverb: ['rápidamente', 'bien', 'hoy', 'aquí', 'mucho', 'poco', 'siempre'],
  pronoun: ['él', 'ella', 'mía', 'mío'],
  preposition: ['en', 'de', 'a', 'con'],
  conjunction: ['y', 'pero', 'o', 'porque'],
};

describe('clases-de-palabras word deck', () => {
  const deck = wordCellsForLesson(lesson, 'es');
  // the deck shows nouns with their article ("la casa"): compare the bare word
  const words = deck.map((c) => c.es.toLowerCase().replace(/^(el|la|los|las) /, ''));

  it('has at least 30 words, each once, each with an English meaning', () => {
    expect(deck.length).toBeGreaterThanOrEqual(30);
    expect(new Set(deck.map((c) => c.id)).size).toBe(deck.length);
    expect(deck.every((c) => c.en.length > 0)).toBe(true);
  });

  it.each(Object.entries(CLASSES))('has at least 4 %s words', (_cls, expected) => {
    expect(expected.filter((w) => words.includes(w)).length).toBeGreaterThanOrEqual(4);
  });

  it('keeps the 10 words the deck had before', () => {
    const before = ['rápidamente', 'rápido', 'feliz', 'tranquilo', 'fácil', 'lento', 'fuerte', 'triste', 'difícil', 'amable'];
    for (const w of before) expect(words).toContain(w);
  });
});
