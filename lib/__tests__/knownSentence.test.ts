import {
  isLearnedCard,
  isSentenceKnown,
  knownTokens,
  resolvedTensesFromLessons,
  unknownTokens,
  type ResolvedTense,
} from '../knownSentence';
import { resetFormIndex } from '../grammar/tenseGate';
import type { Sm2Card } from '../sm2';

beforeEach(() => resetFormIndex());

const PRESENTE: ReadonlySet<ResolvedTense> = new Set<ResolvedTense>(['presente']);

function card(over: Partial<Sm2Card>): Sm2Card {
  return {
    itemId: 'a0-0001',
    state: 'new',
    step: 0,
    ease: 2.5,
    interval: 0,
    reps: 0,
    lapses: 0,
    due: '',
    lastReview: null,
    introducedAt: null,
    ...over,
  };
}

describe('isSentenceKnown (Spanish)', () => {
  it('accepts a sentence made only of learned words and free words', () => {
    expect(isSentenceKnown('El libro y la mesa.', 'es', { learned: ['el libro', 'la mesa'] })).toBe(true);
  });

  it('rejects a sentence with a noun that is not learned', () => {
    const ctx = { learned: ['el libro'] };
    expect(isSentenceKnown('El gato y el libro.', 'es', ctx)).toBe(false);
    expect(unknownTokens('El gato y el libro.', 'es', ctx)).toEqual(['gato']);
  });

  it('lets free words through with nothing learned', () => {
    expect(isSentenceKnown('El de la, y no.', 'es', { learned: [] })).toBe(true);
  });

  it('ignores case and Spanish punctuation', () => {
    expect(isSentenceKnown('¿EL LIBRO?', 'es', { learned: ['el libro'] })).toBe(true);
  });

  it('never accepts an empty sentence', () => {
    expect(isSentenceKnown('  ', 'es', { learned: [] })).toBe(false);
  });

  it('accepts the plural of a learned noun, with the accent dropped after -ón', () => {
    expect(isSentenceKnown('Los libros.', 'es', { learned: ['el libro'] })).toBe(true);
    expect(isSentenceKnown('Las canciones.', 'es', { learned: ['la canción'] })).toBe(true);
    expect(isSentenceKnown('Los lápices.', 'es', { learned: ['el lápiz'] })).toBe(true);
  });

  it('gives the feminine form only to an adjective', () => {
    const noun = { learned: ['la casa', 'blanco'] };
    expect(isSentenceKnown('La casa blanca.', 'es', noun)).toBe(false);
    const adj = { learned: ['la casa', { text: 'blanco', pos: 'adj' }] };
    expect(isSentenceKnown('La casa blanca.', 'es', adj)).toBe(true);
    expect(isSentenceKnown('Las casas blancas.', 'es', adj)).toBe(true);
  });

  it('accepts a conjugated verb only when the tense is resolved (tengo)', () => {
    const learned = ['tener', 'el libro'];
    expect(isSentenceKnown('Tengo el libro.', 'es', { learned, tenses: PRESENTE })).toBe(true);
    expect(isSentenceKnown('Tengo el libro.', 'es', { learned, tenses: new Set() })).toBe(false);
    expect(isSentenceKnown('Tengo el libro.', 'es', { learned })).toBe(false);
  });

  it('does not conjugate a verb that is not learned', () => {
    const ctx = { learned: ['el libro'], tenses: PRESENTE };
    expect(isSentenceKnown('Tengo el libro.', 'es', ctx)).toBe(false);
  });

  it('does not accept a tense that is still locked, even for a learned verb', () => {
    const ctx = { learned: ['tener', 'el libro'], tenses: PRESENTE };
    expect(isSentenceKnown('Tenía el libro.', 'es', ctx)).toBe(false);
    const both = { learned: ['tener', 'el libro'], tenses: new Set<ResolvedTense>(['presente', 'imperfecto']) };
    expect(isSentenceKnown('Tenía el libro.', 'es', both)).toBe(true);
  });

  it('derives the imperfect subjunctive from the preterite stem', () => {
    const tokens = knownTokens('es', {
      learned: ['hablar'],
      tenses: new Set<ResolvedTense>(['subjuntivo_imperfecto']),
    });
    expect(tokens.has('hablara')).toBe(true);
    expect(tokens.has('habláramos')).toBe(true);
    expect(tokens.has('hablo')).toBe(false);
  });

  it('blocks a compound tense even when every token is a learned word', () => {
    const ctx = { learned: ['he', 'comido', 'el pan'] };
    expect(unknownTokens('He comido el pan.', 'es', ctx)).toEqual([]);
    expect(isSentenceKnown('He comido el pan.', 'es', ctx)).toBe(false);
  });

  it('blocks a command form even when every token is a learned word', () => {
    const ctx = { learned: ['tome', 'asiento', 'por favor'] };
    expect(unknownTokens('Tome asiento, por favor.', 'es', ctx)).toEqual([]);
    expect(isSentenceKnown('Tome asiento, por favor.', 'es', ctx)).toBe(false);
  });
});

describe('isSentenceKnown (English)', () => {
  it('accepts learned words, free words and the -s/-ed/-ing forms of a learned single word', () => {
    expect(isSentenceKnown('The dog runs.', 'en', { learned: ['dog', 'run'] })).toBe(true);
    expect(isSentenceKnown('The dog is walking.', 'en', { learned: ['dog', 'walk', 'to be'] })).toBe(true);
  });

  it('rejects an unlearned word', () => {
    const ctx = { learned: ['dog'] };
    expect(isSentenceKnown('The cat and the dog.', 'en', ctx)).toBe(false);
    expect(unknownTokens('The cat and the dog.', 'en', ctx)).toEqual(['cat']);
  });

  it('opens be/have/do/go with the base verb, and strips a leading "to"', () => {
    const ctx = { learned: ['to be', 'to have', 'dog', 'here'] };
    expect(isSentenceKnown('The dog is here.', 'en', ctx)).toBe(true);
    expect(isSentenceKnown('The dogs were here.', 'en', ctx)).toBe(true);
    expect(isSentenceKnown('The dog has a dog.', 'en', ctx)).toBe(true);
    expect(isSentenceKnown('The dog went here.', 'en', ctx)).toBe(false);
  });

  it('keeps a phrase as its own words, without inflecting them', () => {
    const ctx = { learned: ['good morning'] };
    expect(isSentenceKnown('Good morning.', 'en', ctx)).toBe(true);
    expect(isSentenceKnown('Good morning', 'en', { learned: ['good'] })).toBe(false);
    expect(isSentenceKnown('Good mornings.', 'en', ctx)).toBe(false);
  });

  it('handles an apostrophe and mixed case', () => {
    expect(isSentenceKnown("It's the DOG.", 'en', { learned: ["it's", 'dog'] })).toBe(true);
  });

  it('does not use the Spanish structure guard', () => {
    expect(isSentenceKnown('He tome asiento', 'en', { learned: ['he', 'tome', 'asiento'] })).toBe(true);
  });
});

describe('isLearnedCard', () => {
  it('is false for a new or still-learning card', () => {
    expect(isLearnedCard(card({ state: 'new' }))).toBe(false);
    expect(isLearnedCard(card({ state: 'learning', step: 0 }))).toBe(false);
  });

  it('is true for a review card, a lapsed card and a hand-marked known card', () => {
    expect(isLearnedCard(card({ state: 'review', interval: 1, reps: 1 }))).toBe(true);
    expect(isLearnedCard(card({ state: 'learning', lapses: 1 }))).toBe(true);
    expect(isLearnedCard(card({ state: 'new', known: true }))).toBe(true);
  });
});

describe('resolvedTensesFromLessons', () => {
  it('maps the finished grammar lessons to the tenses they unlock', () => {
    expect([...resolvedTensesFromLessons([])]).toEqual([]);
    expect([...resolvedTensesFromLessons(['presente-regular'])]).toEqual(['presente']);
    const set = resolvedTensesFromLessons([
      'presente-irregular',
      'indefinido-regular',
      'imperfecto',
      'futuro-simple',
      'condicional-simple',
      'subjuntivo-presente-forma',
      'subjuntivo-imperfecto',
    ]);
    expect([...set].sort()).toEqual(
      ['condicional', 'futuro', 'imperfecto', 'indefinido', 'presente', 'subjuntivo_imperfecto', 'subjuntivo_presente'].sort(),
    );
  });

  it('does not unlock a tense from a lesson that only shares a prefix (indefinidos)', () => {
    expect(resolvedTensesFromLessons(['indefinidos']).size).toBe(0);
  });
});
