import {
  isLearnedCard,
  isSentenceKnown,
  knownTokens,
  resolvedTensesFromLessons,
  sentenceTokens,
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

  it.each([
    ['ir', 'la tienda', 'Voy a la tienda.'],
    ['pedir', 'el agua', 'Pido agua.'],
    ['jugar', 'el parque', 'Juego en el parque.'],
    ['llover', 'hoy', 'Hoy llueve.'],
  ])('opens the presente of %s once it is learned and the presente is unlocked', (verb, noun, sentence) => {
    const tenses = resolvedTensesFromLessons(['presente-regular', 'presente-irregular']);
    expect(isSentenceKnown(sentence, 'es', { learned: [verb, noun], tenses })).toBe(true);
    expect(isSentenceKnown(sentence, 'es', { learned: [noun], tenses })).toBe(false);
    expect(isSentenceKnown(sentence, 'es', { learned: [verb, noun] })).toBe(false);
  });

  it('gives ir and the stem-changing verbs exactly their presente forms', () => {
    const tenses = resolvedTensesFromLessons(['presente-regular']);
    const tokens = (verb: string) => knownTokens('es', { learned: [{ text: verb, pos: 'verb' }], tenses });
    for (const f of ['voy', 'vas', 'va', 'vamos', 'van']) expect(tokens('ir').has(f)).toBe(true);
    for (const f of ['pido', 'pides', 'pide', 'pedimos', 'piden']) expect(tokens('pedir').has(f)).toBe(true);
    for (const f of ['juego', 'juegas', 'juega', 'jugamos', 'juegan']) expect(tokens('jugar').has(f)).toBe(true);
    expect(tokens('llover').has('llueve')).toBe(true);
    // not loosened: no wrong stem variants, no other persons of the impersonal llover, no other tenses
    for (const f of ['pedo', 'jugo', 'piedo', 'fui', 'iba', 'pidió', 'jugué']) {
      expect([tokens('ir'), tokens('pedir'), tokens('jugar')].some((t) => t.has(f))).toBe(false);
    }
    expect(tokens('llover').has('llueven')).toBe(false);
  });

  it('keeps the other tenses of ir behind their lessons', () => {
    const learned = ['ir', 'la tienda'];
    expect(isSentenceKnown('Fui a la tienda.', 'es', { learned, tenses: PRESENTE })).toBe(false);
    const both = resolvedTensesFromLessons(['presente-irregular', 'indefinido-regular']);
    expect(isSentenceKnown('Fui a la tienda.', 'es', { learned, tenses: both })).toBe(true);
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

  it('recognises the irregular past and participle of a learned verb', () => {
    const ctx = { learned: ['he', 'to become', 'teacher'] };
    expect(isSentenceKnown('He became a teacher.', 'en', ctx)).toBe(true);
    expect(isSentenceKnown('She began and built it.', 'en', { learned: ['she', 'it', 'to begin', 'to build'] })).toBe(true);
    expect(isSentenceKnown('He heard it and knew it.', 'en', { learned: ['he', 'it', 'to hear', 'to know'] })).toBe(true);
    expect(isSentenceKnown('They rebuilt it.', 'en', { learned: ['they', 'it', 'to rebuild'] })).toBe(true);
    expect(isSentenceKnown('He became a teacher.', 'en', { learned: ['he', 'teacher'] })).toBe(false);
  });

  it('recognises the spelling changes of the regular forms', () => {
    expect(isSentenceKnown('The bus stopped.', 'en', { learned: ['bus', 'stop'] })).toBe(true);
    expect(isSentenceKnown('He clapped.', 'en', { learned: ['he', 'clap'] })).toBe(true);
    expect(isSentenceKnown('She applied.', 'en', { learned: ['she', 'apply'] })).toBe(true);
    expect(isSentenceKnown('The families and the stories.', 'en', { learned: ['family', 'story'] })).toBe(true);
    expect(isSentenceKnown('He is making it.', 'en', { learned: ['he', 'it', 'make', 'to be'] })).toBe(true);
  });

  it('adds no doubled consonant where the rule has none', () => {
    expect(isSentenceKnown('He visitted it.', 'en', { learned: ['he', 'it', 'visit'] })).toBe(false);
    expect(isSentenceKnown('He visited it.', 'en', { learned: ['he', 'it', 'visit'] })).toBe(true);
    expect(isSentenceKnown('He openned it.', 'en', { learned: ['he', 'it', 'open'] })).toBe(false);
  });

  it('keeps the blind endings of before: "ban" + d still opens "band"', () => {
    expect(isSentenceKnown('The band.', 'en', { learned: ['ban'] })).toBe(true);
  });

  it('recognises the irregular plurals', () => {
    expect(isSentenceKnown('The children and the women.', 'en', { learned: ['child', 'woman'] })).toBe(true);
    expect(isSentenceKnown('The mice and the lives.', 'en', { learned: ['mouse', 'life'] })).toBe(true);
  });

  it('inflects every alternative of an item, and the verb of "to X ..."', () => {
    const ctx = { learned: ['to speak / to talk', 'to take part', 'to love (someone)'] };
    expect(isSentenceKnown('She spoke and talked.', 'en', { learned: ['she', ...ctx.learned] })).toBe(true);
    expect(isSentenceKnown('They took part.', 'en', { learned: ['they', ...ctx.learned] })).toBe(true);
    expect(isSentenceKnown('They loved her.', 'en', { learned: ['they', 'her', ...ctx.learned] })).toBe(true);
  });

  it('gives a closed word class and a non-"to" phrase no endings', () => {
    expect(isSentenceKnown('A thing.', 'en', { learned: [{ text: 'the', pos: 'det' }] })).toBe(false);
    expect(isSentenceKnown('He works.', 'en', { learned: ['he work'] })).toBe(false);
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

describe('knownSentence, Hungarian', () => {
  it('keeps the Hungarian letters inside a token (ő ű ö ü á é í ó ú)', () => {
    expect(sentenceTokens('Az őszi főzőkanál nagyon szűk, és kék.', 'hu')).toEqual(['az', 'őszi', 'főzőkanál', 'nagyon', 'szűk', 'és', 'kék']);
  });

  it('a sentence is known when every token is a learned form or a free word', () => {
    const ctx = { learned: ['a fű', 'zöld'] };
    expect(isSentenceKnown('A fű zöld.', 'hu', ctx)).toBe(true);
    expect(unknownTokens('A fű kék.', 'hu', ctx)).toEqual(['kék']);
  });
});