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

  it.each([
    ['demonstratives', 'Esta casa, esos libros, eso y aquellas casas.'],
    ['possessives', 'Mi casa, tus libros, su casa, la nuestra y los míos.'],
    ['quantifiers', 'Muchas casas, pocos libros, toda la casa, otra casa, varios libros, cada casa, algún libro y ningún libro.'],
    ['pronouns', 'Yo, tú, él, ella, nosotros, ellos, usted, me, te, se, nos, lo, le, mí, ti, conmigo y contigo.'],
    ['conjunctions and prepositions', 'Pero si la casa, porque sin ella, hasta el libro, e incluso según él, mientras.'],
    ['degree words', 'Muy más menos tan.'],
  ])('lets the closed class through with nothing but the nouns learned (%s)', (_name, sentence) => {
    const ctx = { learned: ['la casa', 'el libro', 'incluso'] };
    expect(unknownTokens(sentence, 'es', ctx)).toEqual([]);
    expect(isSentenceKnown(sentence, 'es', ctx)).toBe(true);
  });

  it('still blocks the content words around the closed class (noun, verb, adjective, -mente adverb)', () => {
    const ctx = { learned: ['la casa'] };
    expect(unknownTokens('Esta casa tiene un jardín muy bonito y rápidamente.', 'es', ctx)).toEqual([
      'tiene',
      'jardín',
      'bonito',
      'rápidamente',
    ]);
    expect(unknownTokens('Vosotros y vuestros libros.', 'es', ctx)).toEqual(['vosotros', 'vuestros', 'libros']);
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

  it.each([
    ['pronouns', 'I and you, he and she, we and they, me, him, us, them, my dog, your dog, his dog, its dog, ours, myself.'],
    ['determiners', 'This dog, those dogs, some dogs, any dog, no dog, every dog, each dog, all dogs, both dogs, many dogs, few dogs, another dog.'],
    ['prepositions', 'At the dog, by the dog, from a dog, with a dog, without a dog, about a dog, between dogs, through the dog, up, down, out, off.'],
    ['conjunctions', 'A dog but not a dog, if a dog, because a dog, so a dog, when a dog, while a dog, than a dog, as a dog, though a dog.'],
    ['modals and degree words', 'Will, would, can, could, shall, should, may, might, must, not, very, too, also a dog.'],
  ])('lets the closed class through with only the noun learned (%s)', (_name, sentence) => {
    const ctx = { learned: ['dog'] };
    expect(unknownTokens(sentence, 'en', ctx)).toEqual([]);
    expect(isSentenceKnown(sentence, 'en', ctx)).toBe(true);
  });

  it('still blocks the content words around the closed class', () => {
    expect(unknownTokens('She and I will see them at home.', 'en', { learned: [] })).toEqual(['see', 'home']);
    expect(unknownTokens('He is very happy.', 'en', { learned: ['to be'] })).toEqual(['happy']);
  });

  it('reads a contraction as its stem + clitic, known when the stem is', () => {
    // pronouns and modals are free words
    expect(isSentenceKnown("I'm, it's, we're, they've, you'll, she'd, he's. I can't and we won't.", 'en', { learned: [] })).toBe(true);
    // a learned word's own clitic forms: don't / isn't need do / be
    expect(isSentenceKnown("I don't, it isn't, he doesn't, we weren't.", 'en', { learned: ['to do', 'to be'] })).toBe(true);
    expect(unknownTokens("I don't know.", 'en', { learned: ['to know'] })).toEqual(["don't"]);
    expect(isSentenceKnown("The dog's bone.", 'en', { learned: ['dog', 'bone'] })).toBe(true);
    expect(unknownTokens("The cat's dog.", 'en', { learned: ['dog'] })).toEqual(["cat's"]);
    expect(unknownTokens("Ain't it, o'clock.", 'en', { learned: [] })).toEqual(["ain't", "o'clock"]);
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

  it('a suffixed form of a learned word is known (lib/huForms.ts), a wrong-harmony one is not', () => {
    const ctx = {
      learned: [
        { text: 'az iroda', pos: 'noun' },
        { text: 'az anya', pos: 'noun' },
        { text: 'a kert', pos: 'noun' },
        { text: 'eszem', pos: 'verb' },
        { text: 'én vagyok', pos: 'verb' },
      ],
    };
    expect(unknownTokens('Anyám az irodában volt.', 'hu', ctx)).toEqual([]);
    expect(unknownTokens('Az anyám ezt a kertet eszi.', 'hu', ctx)).toEqual([]);
    expect(unknownTokens('Anyám a kertban volt.', 'hu', ctx)).toEqual(['kertban']);
    expect(unknownTokens('Az irodaban van.', 'hu', ctx)).toEqual(['irodaban']);
  });

  it('the closed classes (demonstratives, postpositions, preverbs, quantity words) never block a sentence', () => {
    expect(isSentenceKnown('Ez miatt fel kell sok.', 'hu', { learned: ['kell'] })).toBe(true);
  });

  it('the suffixed forms of a learned card come from stem keys that no token can equal', () => {
    const tokens = knownTokens('hu', { learned: [{ text: 'a ház', pos: 'noun' }] });
    expect(tokens.has('ház')).toBe(true);
    expect(tokens.has('házat')).toBe(false);
    expect([...tokens].filter((t) => t.startsWith('#')).length).toBeGreaterThan(0);
    expect(sentenceTokens('# házat', 'hu')).toEqual(['házat']);
  });
});

describe('knownSentence, Spanish irregular verb forms', () => {
  const ALL: ReadonlySet<ResolvedTense> = new Set<ResolvedTense>([
    'presente',
    'indefinido',
    'imperfecto',
    'futuro',
    'condicional',
    'subjuntivo_presente',
    'subjuntivo_imperfecto',
  ]);
  const verb = (text: string) => ({ text, pos: 'verb' });
  const known = (sentence: string, learned: Array<string | { text: string; pos: string }>, tenses: ReadonlySet<ResolvedTense> = ALL) =>
    isSentenceKnown(sentence, 'es', { learned, tenses });

  it('recognises the forms that stories failed on (stem changes, spelling, irregular stems)', () => {
    expect(known('Envió una carta.', [verb('enviar'), 'la carta'])).toBe(true);
    expect(known('Empezó la clase.', [verb('empezar'), 'la clase'])).toBe(true);
    expect(known('Encontramos la casa.', [verb('encontrar'), 'la casa'])).toBe(true);
    expect(known('Corregimos el libro.', [verb('corregir'), 'el libro'])).toBe(true);
    expect(known('Pidieron la mesa.', [verb('pedir'), 'la mesa'])).toBe(true);
    expect(known('Apareció la luna.', [verb('aparecer'), 'la luna'])).toBe(true);
    expect(known('Mostré la casa.', [verb('mostrar'), 'la casa'])).toBe(true);
    expect(known('Sintió la luna.', [verb('sentir'), 'la luna'])).toBe(true);
    expect(known('Dormía en la casa y dormí en la mesa.', [verb('dormir'), 'la casa', 'la mesa'])).toBe(true);
    expect(known('Volvimos a la casa.', [verb('volver'), 'la casa'])).toBe(true);
    expect(known('Subí a la casa.', [verb('subir'), 'la casa'])).toBe(true);
    expect(known('Jugó y jugaron en la casa.', [verb('jugar'), 'la casa'])).toBe(true);
    expect(known('Pensaba en la casa.', [verb('pensar'), 'la casa'])).toBe(true);
    expect(known('Hay una mesa.', [verb('haber'), 'la mesa'])).toBe(true);
    expect(known('Tuve una mesa y hice la casa.', [verb('tener'), verb('hacer'), 'la mesa', 'la casa'])).toBe(true);
    expect(known('Tuvieron la mesa y obtuvieron la casa.', [verb('tener'), verb('obtener'), 'la mesa', 'la casa'])).toBe(true);
  });

  it('keeps the tense gate: a form counts only in an unlocked tense', () => {
    const learned = [verb('pedir'), 'la mesa'];
    const presente: ReadonlySet<ResolvedTense> = new Set<ResolvedTense>(['presente']);
    const withIndefinido: ReadonlySet<ResolvedTense> = new Set<ResolvedTense>(['presente', 'indefinido']);
    expect(known('Pide la mesa.', learned, presente)).toBe(true);
    expect(known('Pidió la mesa.', learned, presente)).toBe(false);
    expect(known('Pidió la mesa.', learned, withIndefinido)).toBe(true);
    expect(known('Pidiera la mesa.', learned, withIndefinido)).toBe(false);
    expect(known('Pidiera la mesa.', learned, ALL)).toBe(true);
    expect(known('Pide la mesa.', learned, new Set<ResolvedTense>())).toBe(false);
  });

  it('a form of a verb that is not learned stays unknown', () => {
    expect(known('Dormí en la casa.', [verb('pedir'), 'la casa'])).toBe(false);
  });

  it('takes both words of "responder / contestar" and the base of a reflexive verb', () => {
    expect(known('Respondí a la casa.', [verb('responder / contestar'), 'la casa'])).toBe(true);
    expect(known('Contesté a la casa.', [verb('responder / contestar'), 'la casa'])).toBe(true);
    expect(known('Me acuesto en la casa.', ['me', verb('acostarse'), 'la casa'])).toBe(true);
    expect(known('Se bañó en la casa.', ['se', verb('bañarse'), 'la casa'])).toBe(true);
  });

  it('recognises an infinitive with an object pronoun attached (quedarme, verlo)', () => {
    expect(known('Quiero quedarme en la casa.', [verb('querer'), verb('quedar'), 'la casa'])).toBe(true);
    expect(known('Quiero verlo.', [verb('querer'), verb('ver')])).toBe(true);
    expect(known('Quiero levantarme.', [verb('querer'), verb('levantarse')])).toBe(true);
    expect(known('Quiero comprarlas.', [verb('querer'), verb('comprar')])).toBe(true);
  });

  it('recognises the verbs written with an accented -ír (oír, reír)', () => {
    expect(known('Oí la luna y reí.', [verb('oír'), verb('reír'), 'la luna'])).toBe(true);
  });

  it('knows the plurals that need an accent or an extra syllable (jóvenes, meses, países)', () => {
    expect(known('Los meses y los países.', ['el mes', 'el país'])).toBe(true);
    expect(known('Los jóvenes y los exámenes.', [{ text: 'joven', pos: 'adj' }, 'el examen'])).toBe(true);
  });

  it('gives an adjective its short form before a noun (buen, mal, gran, primer, tercer)', () => {
    const adj = (text: string) => ({ text, pos: 'adj' });
    expect(known('Un buen día, un mal día, un gran día.', [adj('bueno'), adj('malo'), adj('grande'), 'el día'])).toBe(true);
    expect(known('El primer día y el tercer día.', [adj('primero'), adj('tercero'), 'el día'])).toBe(true);
  });

  it('gives the short form only when the full adjective is learned', () => {
    expect(known('Un buen día.', ['el día'])).toBe(false);
    expect(known('Un buen día.', [{ text: 'malo', pos: 'adj' }, 'el día'])).toBe(false);
    expect(known('Un gran día.', [{ text: 'grande', pos: 'noun' }, 'el día'])).toBe(false);
  });

  it('a sentence starting with "Una" is not an imperative', () => {
    expect(known('Una mesa.', ['la mesa'])).toBe(true);
    expect(known('Y una mesa.', ['la mesa'])).toBe(true);
  });
});

describe('knownSentence, proper names', () => {
  const es = (sentence: string, learned: string[]) => isSentenceKnown(sentence, 'es', { learned });
  const en = (sentence: string, learned: string[]) => isSentenceKnown(sentence, 'en', { learned });
  const hu = (sentence: string, learned: string[]) => isSentenceKnown(sentence, 'hu', { learned });

  it('takes a capitalised word inside the sentence as a name', () => {
    expect(es('La casa de Pedro.', ['la casa'])).toBe(true);
    expect(en('The dog likes Zorblax.', ['dog', 'like'])).toBe(true);
    expect(hu('A kutya Zorblaxban van.', ['kutya', 'van'])).toBe(true);
  });

  it('does not take a lowercase word inside the sentence as a name', () => {
    expect(es('La casa de pedro.', ['la casa'])).toBe(false);
    expect(en('The dog likes zorblax.', ['dog', 'like'])).toBe(false);
  });

  it('takes a sentence-initial word as a name only when the corpus writes it with a capital inside a sentence', () => {
    expect(es('Tom y la mesa.', ['la mesa'])).toBe(true);
    expect(en('Tom likes the dog.', ['dog', 'like'])).toBe(true);
    expect(hu('Anna és a kutya.', ['kutya'])).toBe(true);
    expect(es('Zorblax y la mesa.', ['la mesa'])).toBe(false);
    expect(en('Zorblax likes the dog.', ['dog', 'like'])).toBe(false);
  });

  it('keeps an ordinary capitalised first word unknown', () => {
    expect(es('Perro y la mesa.', ['la mesa'])).toBe(false);
    expect(en('Cat and the dog.', ['dog'])).toBe(false);
    expect(en('Cat and the dog.', ['dog', 'cat'])).toBe(true);
  });

  it("reads an English possessive of a name (Tom's)", () => {
    expect(en("Tom's dog runs.", ['dog', 'run'])).toBe(true);
    expect(en("The dog is Zorblax's.", ['dog', 'to be'])).toBe(true);
    expect(en("The dog is zorblax's.", ['dog', 'to be'])).toBe(false);
  });

  it('treats the word after a quotation mark or a question mark as a sentence start', () => {
    expect(en('"Zorblax" is here.', ['to be', 'here'])).toBe(false);
    expect(es('¿Dónde? Zorblax y la mesa.', ['la mesa', 'dónde'])).toBe(false);
  });

  it('lists the unknown words but not the names', () => {
    expect(unknownTokens('The dog likes Zorblax and cats.', 'en', { learned: ['dog', 'like'] })).toEqual(['cats']);
  });
});

describe('knownSentence, Spanish past participles', () => {
  const verb = (text: string) => ({ text, pos: 'verb' });
  const known = (sentence: string, learned: Array<string | { text: string; pos: string }>, tenses: ReadonlySet<ResolvedTense> = new Set()) =>
    isSentenceKnown(sentence, 'es', { learned, tenses });

  it('gives a learned verb its participle in gender and number, with no tense unlocked', () => {
    expect(known('El libro cerrado.', ['el libro', verb('cerrar')])).toBe(true);
    expect(known('La puerta cerrada.', ['la puerta', verb('cerrar')])).toBe(true);
    expect(known('Los libros cerrados.', ['los libros', verb('cerrar')])).toBe(true);
    expect(known('Las puertas cerradas.', ['las puertas', verb('cerrar')])).toBe(true);
    expect(known('El libro terminado.', ['el libro', verb('terminar')])).toBe(true);
  });

  it('writes the accent of -er / -ir stems that end in a vowel (leído, oído, caído, creído)', () => {
    expect(known('El libro leído.', ['el libro', verb('leer')])).toBe(true);
    expect(known('El libro oído.', ['el libro', verb('oír')])).toBe(true);
    expect(known('El libro caído.', ['el libro', verb('caer')])).toBe(true);
    expect(known('El libro creído.', ['el libro', verb('creer')])).toBe(true);
    expect(known('La puerta leída.', ['la puerta', verb('leer')])).toBe(true);
    expect(known('El libro leido.', ['el libro', verb('leer')])).toBe(false);
    expect(known('El libro vendido.', ['el libro', verb('vender')])).toBe(true);
  });

  it('gives the irregular participles, also of the compounds', () => {
    const cases: Array<[string, string]> = [
      ['hacer', 'hecho'], ['decir', 'dicho'], ['escribir', 'escrito'], ['ver', 'visto'], ['poner', 'puesto'],
      ['volver', 'vuelto'], ['abrir', 'abierto'], ['romper', 'roto'], ['morir', 'muerto'], ['cubrir', 'cubierto'],
      ['descubrir', 'descubierto'], ['resolver', 'resuelto'], ['devolver', 'devuelto'], ['imprimir', 'impreso'],
      ['freír', 'frito'], ['satisfacer', 'satisfecho'], ['deshacer', 'deshecho'], ['suponer', 'supuesto'],
    ];
    for (const [inf, participle] of cases) {
      expect(known(`El libro ${participle}.`, ['el libro', verb(inf)])).toBe(true);
      expect(known(`Los libros ${participle.slice(0, -1)}as.`, ['los libros', verb(inf)])).toBe(true);
    }
  });

  it('does not give the regular participle of a verb whose participle is irregular, nor of "mover" the irregular one', () => {
    expect(known('El libro hacido.', ['el libro', verb('hacer')])).toBe(false);
    expect(known('El libro escribido.', ['el libro', verb('escribir')])).toBe(false);
    expect(known('El libro movido.', ['el libro', verb('mover')])).toBe(true);
    expect(known('El libro muesto.', ['el libro', verb('mover')])).toBe(false);
  });

  it('reads the reflexive and the alternative infinitives of an entry', () => {
    expect(known('El libro puesto.', ['el libro', verb('ponerse')])).toBe(true);
    expect(known('El libro vuelto.', ['el libro', verb('volver / regresar')])).toBe(true);
    expect(known('El libro regresado.', ['el libro', verb('volver / regresar')])).toBe(true);
  });

  it('keeps the participle of a verb that is not learned unknown', () => {
    expect(known('El libro cerrado.', ['el libro', verb('abrir')])).toBe(false);
    expect(known('El libro hecho.', ['el libro', verb('decir')])).toBe(false);
    expect(known('El libro cerrado.', ['el libro'])).toBe(false);
  });

  it('gives a participle only to a verb, not to a noun with the same infinitive-like text', () => {
    expect(known('El libro cerrado.', ['el libro', { text: 'cerrar', pos: 'noun' }])).toBe(false);
  });

  it('keeps the compound tenses blocked even with the participle known', () => {
    expect(known('He terminado el libro.', ['el libro', verb('terminar')], new Set<ResolvedTense>(['presente']))).toBe(false);
    expect(known('Había abierto el libro.', ['el libro', verb('abrir')], new Set<ResolvedTense>(['presente', 'imperfecto']))).toBe(false);
  });
});