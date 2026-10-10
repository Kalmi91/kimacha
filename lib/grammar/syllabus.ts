// The grammar syllabus: every grammar point the course intends to teach from
// A1 to C1, in teaching order, grouped into units.
//
// User feedback: "every level has a grammar part too... put the
// grammar into the levels as well. and there should also be a separate grammar study section where it
// neatly takes over all the grammar... I want it to be comprehensive and
// to contain all the necessary grammar."
//
// This module is the MAP. The lessons themselves live in the authored corpus
// (data/games/grammar/<lang>/<topic>.json) which the drill game already uses,
// so a topic is written once and serves both the study screen and the game.
// A topic with no file yet is shown as planned-but-not-written; the screen
// never pretends an empty lesson exists.

import { getGrammarTopic, getGrammarTopics, grammarKindCounts, type GrammarKind, type GrammarTopicData } from '@/lib/games/content';
import type { Level } from '@/data/words';
import { EN_SYLLABUS, EN_UNITS } from './syllabusEn';

export interface SyllabusTopic {
  id: string;
  level: Level;
  unit: string; // unit id within the level
  title: Record<string, string>;
  /** One line on what it is for, shown under the title on the syllabus screen. */
  blurb: Record<string, string>;
}

export interface SyllabusUnit {
  id: string;
  level: Level;
  title: Record<string, string>;
}

/**
 * Depth band: how important a grammar point is, regardless of where it
 * comes from (PCIC, exam blueprint, textbook). The weight is made up of three signals:
 * how many sentences cannot be produced without it, how many later topics build on it, and
 * whether the exam asks for it. A topic has one band, the lowest where it is first needed, and
 * the bands are cumulative: whoever studies 'exam' gets 'core' too.
 *
 *   core+   (solid purple) the speech core: ser/estar, present, the two pasts and
 *                   their contrast, ir a + inf, modals, pronouns, conditional.
 *                   This is built FIRST, it fills the speech gap
 *   core    (purple)  you cannot speak without it, built first from A1 to C1
 *   exam    (blue)    needed for the exam and for correct speech, but does not block
 *   full    (green)   PCIC completeness, only for the sake of the inventory
 *   perfect (yellow)  100% spelling and grammatical finesse
 */
type GrammarTier = 'core-plus' | 'core' | 'exam' | 'full' | 'perfect';

/** Band per topic. Whatever is not on the list is 'full' (it is in the inventory but not urgent). */
const GRAMMAR_TIER: Record<string, GrammarTier> = {
  // --- A1 ---
  'clases-de-palabras': 'exam',
  'sustantivo-numero': 'core',
  'articulos-genero': 'exam',
  'adjetivo-concordancia': 'exam',
  'presente-regular': 'core-plus',
  'presente-irregular': 'core-plus',
  'verbos-diptongo': 'core-plus',
  'ser-estar': 'core-plus',
  'hay-estar': 'core-plus',
  posesivos: 'core',
  demostrativos: 'exam',
  interrogativos: 'core',
  negacion: 'core',
  gustar: 'core-plus',
  'ir-a-infinitivo': 'core-plus',
  'perifrasis-modales': 'core-plus',
  'pronombres-od': 'core-plus',
  'pronombres-oi': 'core-plus',
  'quien-a-quien': 'core-plus',
  'muy-mucho': 'exam',
  'numeros-hora-fecha': 'core',
  'preposiciones-basicas': 'core',
  // --- A2 ---
  'indefinido-regular': 'core-plus',
  'indefinido-irregular': 'core-plus',
  'indefinido-10-verbos': 'core-plus',
  imperfecto: 'core-plus',
  'indefinido-imperfecto': 'core-plus',
  // In Mexico the spoken language uses the preterite instead of the perfecto
  // (comí, not he comido), so it is not in the speech core.
  perfecto: 'exam',
  'perfecto-vs-indefinido': 'exam',
  'estar-gerundio': 'core-plus',
  'hace-desde-hace': 'exam',
  'futuro-simple': 'exam',
  'marcadores-temporales': 'core-plus',
  'imperativo-afirmativo': 'core',
  'imperativo-negativo': 'exam',
  'combinacion-pronombres': 'exam',
  'pronombres-preposicion': 'core',
  'verbos-reflexivos': 'core-plus',
  'verbos-como-gustar': 'exam',
  'imperativo-pronombres': 'exam',
  'comparativos-superlativos': 'core',
  indefinidos: 'core',
  'por-para': 'core',
  'saber-conocer': 'exam',
  'pedir-preguntar': 'exam',
  'llevar-traer-ir-venir': 'exam',
  diminutivos: 'full',
  'numerales-ordinales': 'full',
  // --- B1 ---
  'subjuntivo-presente-forma': 'core',
  'subjuntivo-disparadores': 'core',
  'ojala-quizas': 'exam',
  'temporales-subjuntivo': 'core',
  'subjuntivo-relativo': 'exam',
  'condicional-simple': 'core-plus',
  'condicionales-tipo1': 'core',
  pluscuamperfecto: 'exam',
  relativos: 'core',
  'se-impersonal-pasiva': 'exam',
  'se-accidental': 'full',
  perifrasis: 'exam',
  'por-para-avanzado': 'exam',
  'verbos-preposicion': 'exam',
  'estar-participio': 'exam',
  // --- B2 ---
  'subjuntivo-imperfecto': 'core',
  'subjuntivo-perfecto': 'exam',
  'condicionales-tipo2-3': 'core',
  'estilo-indirecto': 'core',
  'pasiva-ser-participio': 'exam',
  concesivas: 'exam',
  'finales-causales': 'core',
  'lo-neutro': 'exam',
  'gerundio-participio-construcciones': 'exam',
  'verbos-de-cambio': 'exam',
  'oraciones-consecutivas': 'full',
  // --- C1 ---
  'futuro-condicional-perfecto': 'exam',
  'probabilidad-con-tiempos': 'exam',
  'relativos-complejos': 'exam',
  'leismo-laismo': 'exam',
  'marcadores-discursivos': 'core',
};

export function getGrammarTier(topicId: string): GrammarTier {
  return GRAMMAR_TIER[topicId] ?? 'full';
}

export const GRAMMAR_UNITS: SyllabusUnit[] = [
  // --- A1 -----------------------------------------------------------------
  { id: 'a1-nombre', level: 'A1', title: { en: 'Nouns, articles, adjectives', es: 'Sustantivo, artículo, adjetivo' } },
  { id: 'a1-presente', level: 'A1', title: { en: 'The present tense', es: 'El presente' } },
  { id: 'a1-ser-estar', level: 'A1', title: { en: 'Ser, estar, hay', es: 'Ser, estar, hay' } },
  { id: 'a1-pronombres', level: 'A1', title: { en: 'Pronouns and demonstratives', es: 'Pronombres y demostrativos' } },
  { id: 'a1-frase', level: 'A1', title: { en: 'Questions, negation, liking', es: 'Preguntas, negación, gustar' } },
  { id: 'a1-cantidad', level: 'A1', title: { en: 'Quantity, time, prepositions', es: 'Cantidad, tiempo, preposiciones' } },
  // --- A2 -----------------------------------------------------------------
  { id: 'a2-pasado', level: 'A2', title: { en: 'The past tenses', es: 'Los tiempos del pasado' } },
  { id: 'a2-futuro', level: 'A2', title: { en: 'Future and imperative', es: 'Futuro e imperativo' } },
  { id: 'a2-pronombres', level: 'A2', title: { en: 'Object pronouns', es: 'Pronombres de objeto' } },
  { id: 'a2-verbos', level: 'A2', title: { en: 'Verb pairs that get mixed up', es: 'Verbos que se confunden' } },
  { id: 'a2-comparar', level: 'A2', title: { en: 'Comparison and quantity', es: 'Comparación y cantidad' } },
  // --- B1 -----------------------------------------------------------------
  { id: 'b1-subjuntivo', level: 'B1', title: { en: 'The subjunctive', es: 'El subjuntivo' } },
  { id: 'b1-condicional', level: 'B1', title: { en: 'Conditional and if-clauses', es: 'Condicional y condicionales' } },
  { id: 'b1-estructuras', level: 'B1', title: { en: 'Relatives, impersonal, verb phrases', es: 'Relativos, impersonal, perífrasis' } },
  // --- B2 -----------------------------------------------------------------
  { id: 'b2-subjuntivo', level: 'B2', title: { en: 'Advanced subjunctive', es: 'Subjuntivo avanzado' } },
  { id: 'b2-oraciones', level: 'B2', title: { en: 'Clause linking and the passive', es: 'Conexión de oraciones y pasiva' } },
  // --- C1 -----------------------------------------------------------------
  { id: 'c1-matices', level: 'C1', title: { en: 'Nuance and register', es: 'Matices y registro' } },
];

export const GRAMMAR_SYLLABUS: SyllabusTopic[] = [
  // ========================= A1 =========================
  // User feedback: "an important part of grammar is the
  // distinction of the parts of speech, put emphasis on this too." The developer asked for it ALONGSIDE the game
  // in the course material as well, so the part-of-speech overview is the very first topic of the syllabus:
  // every later rule ("the adjective comes after the noun", "the verb is conjugated")
  // assumes that the learner can tell these apart at the word level.
  {
    id: 'clases-de-palabras',
    level: 'A1',
    unit: 'a1-nombre',
    title: { en: 'Word classes: what is what', es: 'Clases de palabras' },
    blurb: { en: 'Noun, verb, adjective, adverb: how to spot each, and why it matters.', es: 'Sustantivo, verbo, adjetivo, adverbio: cómo reconocerlos y por qué importa.' },
  },
  {
    id: 'sustantivo-numero',
    level: 'A1',
    unit: 'a1-nombre',
    title: { en: 'Nouns: gender and plural', es: 'El sustantivo: género y número' },
    blurb: { en: '-o masculine, -a feminine, and how the plural is formed.', es: '-o masculino, -a femenino y cómo se forma el plural.' },
  },
  {
    id: 'articulos-genero',
    level: 'A1',
    unit: 'a1-nombre',
    title: { en: 'Articles: el, la, un, una', es: 'Artículos: el, la, un, una' },
    blurb: { en: 'Definite and indefinite articles, agreeing in gender.', es: 'Artículo determinado e indeterminado, con género.' },
  },
  {
    id: 'adjetivo-concordancia',
    level: 'A1',
    unit: 'a1-nombre',
    title: { en: 'Adjective agreement', es: 'Concordancia del adjetivo' },
    blurb: { en: 'The adjective takes the noun gender and number, and follows it.', es: 'El adjetivo concuerda en género y número y va detrás.' },
  },
  {
    id: 'presente-regular',
    level: 'A1',
    unit: 'a1-presente',
    title: { en: 'Present: regular verbs', es: 'Presente: verbos regulares' },
    blurb: { en: 'The -ar, -er, -ir endings in all six persons.', es: 'Las terminaciones -ar, -er, -ir en las seis personas.' },
  },
  {
    id: 'presente-irregular',
    level: 'A1',
    unit: 'a1-presente',
    title: { en: 'Present: irregular verbs', es: 'Presente: verbos irregulares' },
    blurb: { en: 'tener, venir, ir, hacer, salir, poner, decir, saber.', es: 'tener, venir, ir, hacer, salir, poner, decir, saber.' },
  },
  {
    id: 'verbos-diptongo',
    level: 'A1',
    unit: 'a1-presente',
    title: { en: 'Stem-changing verbs: e→ie, o→ue, e→i', es: 'Verbos con diptongo: e→ie, o→ue, e→i' },
    blurb: { en: 'querer, poder, pedir: the stem changes, the ending does not.', es: 'querer, poder, pedir: cambia la raíz, no la terminación.' },
  },
  {
    id: 'perifrasis-modales',
    level: 'A1',
    unit: 'a1-presente',
    title: { en: 'Tener que, poder, querer + infinitive', es: 'Tener que, poder, querer + infinitivo' },
    blurb: { en: 'Must, can, want: two verbs in a row, the second one unconjugated.', es: 'Tengo que, puedo, quiero: dos verbos seguidos, el segundo en infinitivo.' },
  },
  {
    id: 'ser-estar',
    level: 'A1',
    unit: 'a1-ser-estar',
    title: { en: 'Ser or estar?', es: '¿Ser o estar?' },
    blurb: { en: 'A lasting quality or a current state.', es: 'Cualidad estable o estado actual.' },
  },
  {
    id: 'hay-estar',
    level: 'A1',
    unit: 'a1-ser-estar',
    title: { en: 'Hay or está?', es: '¿Hay o está?' },
    blurb: { en: 'Something exists, or where a known thing is.', es: 'Algo existe, o dónde está algo conocido.' },
  },
  {
    id: 'posesivos',
    level: 'A1',
    unit: 'a1-pronombres',
    title: { en: 'Possessives: mi, tu, su, nuestro', es: 'Posesivos: mi, tu, su, nuestro' },
    blurb: { en: 'It agrees with the thing owned, not the owner.', es: 'Concuerda con lo poseído, no con el poseedor.' },
  },
  {
    id: 'demostrativos',
    level: 'A1',
    unit: 'a1-pronombres',
    title: { en: 'Demonstratives: este, ese, aquel', es: 'Demostrativos: este, ese, aquel' },
    blurb: { en: 'Three distances: here, there, over there.', es: 'Tres distancias: aquí, ahí, allí.' },
  },
  {
    id: 'pronombres-od',
    level: 'A1',
    unit: 'a1-pronombres',
    title: { en: 'Direct object: me, te, lo, la, nos, los, las', es: 'Objeto directo: me, te, lo, la, nos, los, las' },
    blurb: { en: 'The pronoun goes BEFORE the verb: Te amo. ¿El libro? Lo tengo.', es: 'El pronombre va ANTES del verbo: Te amo. ¿El libro? Lo tengo.' },
  },
  {
    id: 'pronombres-oi',
    level: 'A1',
    unit: 'a1-pronombres',
    title: { en: 'Indirect object: me, te, le, nos, les', es: 'Objeto indirecto: me, te, le, nos, les' },
    blurb: { en: 'Who you give or say it to: le doy el libro, te digo la verdad.', es: 'A quién se lo das o dices: le doy el libro, te digo la verdad.' },
  },
  {
    id: 'quien-a-quien',
    level: 'A1',
    unit: 'a1-pronombres',
    title: { en: 'Who does what to whom: te amo, me das', es: 'Quién a quién: te amo, me das' },
    blurb: { en: 'The ending says who acts, the pronoun says to whom.', es: 'La terminación dice quién actúa, el pronombre a quién.' },
  },
  {
    id: 'interrogativos',
    level: 'A1',
    unit: 'a1-frase',
    title: { en: 'Question words', es: 'Interrogativos' },
    blurb: { en: 'qué, quién, dónde, cuándo, cómo, cuánto, por qué.', es: 'qué, quién, dónde, cuándo, cómo, cuánto, por qué.' },
  },
  {
    id: 'negacion',
    level: 'A1',
    unit: 'a1-frase',
    title: { en: 'Negation: no, nada, nunca, nadie', es: 'Negación: no, nada, nunca, nadie' },
    blurb: { en: 'Spanish uses a double negative, and that is correct.', es: 'El español usa doble negación y es correcto.' },
  },
  {
    id: 'gustar',
    level: 'A1',
    unit: 'a1-frase',
    title: { en: 'The gustar structure', es: 'La estructura con gustar' },
    blurb: { en: 'Not "I like it" but "it pleases me".', es: 'No «yo quiero», sino «me gusta».' },
  },
  {
    id: 'ir-a-infinitivo',
    level: 'A1',
    unit: 'a1-cantidad',
    title: { en: 'Near future: ir a + infinitive', es: 'Futuro próximo: ir a + infinitivo' },
    blurb: { en: 'Voy a comer: the future people actually speak.', es: 'Voy a comer: el futuro más usado al hablar.' },
  },
  {
    id: 'muy-mucho',
    level: 'A1',
    unit: 'a1-cantidad',
    title: { en: 'Muy or mucho?', es: '¿Muy o mucho?' },
    blurb: { en: 'Muy before an adjective, mucho with a noun or after a verb.', es: 'Muy ante adjetivo, mucho con sustantivo o tras el verbo.' },
  },
  {
    id: 'numeros-hora-fecha',
    level: 'A1',
    unit: 'a1-cantidad',
    title: { en: 'Numbers, time, date', es: 'Números, hora y fecha' },
    blurb: { en: 'Son las tres, el 5 de mayo, a las ocho y media.', es: 'Son las tres, el 5 de mayo, a las ocho y media.' },
  },
  {
    id: 'preposiciones-basicas',
    level: 'A1',
    unit: 'a1-cantidad',
    title: { en: 'Basic prepositions: a, de, en, con, por', es: 'Preposiciones básicas: a, de, en, con, por' },
    blurb: { en: 'Including the contractions a + el = al and de + el = del.', es: 'Incluidas las contracciones al y del.' },
  },
  // ========================= A2 =========================
  {
    id: 'indefinido-regular',
    level: 'A2',
    unit: 'a2-pasado',
    title: { en: 'Preterite: regular verbs', es: 'Pretérito perfecto simple: regulares' },
    blurb: { en: 'Hablé, comí, viví: the finished past.', es: 'Hablé, comí, viví: el pasado terminado.' },
  },
  {
    id: 'indefinido-irregular',
    level: 'A2',
    unit: 'a2-pasado',
    title: { en: 'Preterite: irregular verbs', es: 'Pretérito perfecto simple: irregulares' },
    blurb: { en: 'fui, tuve, hice, dije, estuve, pude, quise.', es: 'fui, tuve, hice, dije, estuve, pude, quise.' },
  },
  {
    id: 'indefinido-10-verbos',
    level: 'A2',
    unit: 'a2-pasado',
    title: { en: 'Preterite, the 10 most frequent verbs', es: 'Pretérito perfecto simple, los 10 verbos más frecuentes' },
    blurb: { en: 'Present → preterite rewrite drill with the 10 most frequent verbs.', es: 'Reescritura presente → perfecto simple con los 10 verbos más frecuentes.' },
  },
  {
    id: 'imperfecto',
    level: 'A2',
    unit: 'a2-pasado',
    title: { en: 'The imperfect', es: 'El pretérito imperfecto' },
    blurb: { en: 'Hablaba, comía: habit, background, description.', es: 'Hablaba, comía: costumbre, fondo, descripción.' },
  },
  {
    id: 'indefinido-imperfecto',
    level: 'A2',
    unit: 'a2-pasado',
    title: { en: 'Preterite or imperfect?', es: '¿Pretérito perfecto simple o imperfecto?' },
    blurb: { en: 'Choosing between the two pasts, on contrast pairs.', es: 'La elección entre los dos pasados, con pares.' },
  },
  {
    id: 'perfecto',
    level: 'A2',
    unit: 'a2-pasado',
    title: { en: 'The present perfect', es: 'El pretérito perfecto compuesto' },
    blurb: { en: 'He comido: today, this week, not yet.', es: 'He comido: hoy, esta semana, todavía no.' },
  },
  {
    id: 'perfecto-vs-indefinido',
    level: 'A2',
    unit: 'a2-pasado',
    title: { en: 'Present perfect or preterite?', es: '¿Pretérito perfecto o indefinido?' },
    blurb: { en: 'Ayer comí, esta semana he comido: closed time or time that is still going.', es: 'Ayer comí, esta semana he comido: tiempo cerrado o tiempo abierto.' },
  },
  {
    id: 'estar-gerundio',
    level: 'A2',
    unit: 'a2-pasado',
    title: { en: 'Right now: estar + gerund', es: 'Ahora mismo: estar + gerundio' },
    blurb: { en: 'Estoy comiendo: what is happening right now.', es: 'Estoy comiendo: lo que pasa ahora.' },
  },
  {
    id: 'hace-desde-hace',
    level: 'A2',
    unit: 'a2-pasado',
    title: { en: 'How long: hace, desde hace, llevar', es: 'Cuánto tiempo: hace, desde hace, llevar' },
    blurb: { en: 'Hace dos años que vivo aquí, vivo aquí desde hace dos años: what began earlier and is still going.', es: 'Hace dos años que vivo aquí, vivo aquí desde hace dos años: lo que empezó antes y sigue.' },
  },
  {
    id: 'futuro-simple',
    level: 'A2',
    unit: 'a2-futuro',
    title: { en: 'The simple future', es: 'El futuro simple' },
    blurb: { en: 'Hablaré, comeré: promise, prediction, probability.', es: 'Hablaré, comeré: promesa, predicción, probabilidad.' },
  },
  {
    id: 'marcadores-temporales',
    level: 'A2',
    unit: 'a2-futuro',
    title: { en: 'Time markers: which word, which tense', es: 'Marcadores temporales: qué palabra, qué tiempo' },
    blurb: { en: 'Ayer, hace dos años, antes, esta semana, mañana: the word tells you the tense.', es: 'Ayer, hace dos años, antes, esta semana, mañana: la palabra dice el tiempo.' },
  },
  {
    id: 'imperativo-afirmativo',
    level: 'A2',
    unit: 'a2-futuro',
    title: { en: 'Imperative: affirmative', es: 'Imperativo afirmativo' },
    blurb: { en: 'Habla, come, ven, haz: asking and telling.', es: 'Habla, come, ven, haz: pedir y ordenar.' },
  },
  {
    id: 'imperativo-negativo',
    level: 'A2',
    unit: 'a2-futuro',
    title: { en: 'Imperative: negative', es: 'Imperativo negativo' },
    blurb: { en: 'No hables, no comas: the negative uses the subjunctive.', es: 'No hables, no comas: la prohibición usa subjuntivo.' },
  },
  {
    id: 'combinacion-pronombres',
    level: 'A2',
    unit: 'a2-pronombres',
    title: { en: 'Two pronouns together: se lo doy', es: 'Dos pronombres juntos: se lo doy' },
    blurb: { en: 'The order is fixed, and le turns into se.', es: 'El orden es fijo y le se convierte en se.' },
  },
  {
    id: 'pronombres-preposicion',
    level: 'A2',
    unit: 'a2-pronombres',
    title: { en: 'Pronouns after prepositions: para mí, contigo', es: 'Pronombres después de preposición: para mí, contigo' },
    blurb: { en: 'Para mí, contigo, entre tú y yo: after a preposition the pronoun has its own form.', es: 'Para mí, contigo, entre tú y yo: después de la preposición el pronombre tiene su propia forma.' },
  },
  {
    id: 'verbos-reflexivos',
    level: 'A2',
    unit: 'a2-pronombres',
    title: { en: 'Reflexive verbs', es: 'Verbos reflexivos' },
    blurb: { en: 'Me levanto, se llama: the pronoun points back at the doer.', es: 'Me levanto, se llama: el pronombre vuelve al sujeto.' },
  },
  {
    id: 'verbos-como-gustar',
    level: 'A2',
    unit: 'a2-pronombres',
    title: { en: 'Verbs like gustar: encantar, doler, faltar', es: 'Verbos como gustar: encantar, doler, faltar' },
    blurb: { en: 'Me encanta, me duele, me falta: the thing is the subject, the person is the pronoun.', es: 'Me encanta, me duele, me falta: la cosa es el sujeto, la persona es el pronombre.' },
  },
  {
    id: 'imperativo-pronombres',
    level: 'A2',
    unit: 'a2-pronombres',
    title: { en: 'Imperative with pronouns: dímelo, no me lo digas', es: 'Imperativo con pronombres: dímelo, no me lo digas' },
    blurb: { en: 'Dímelo, siéntate: in the affirmative the pronoun attaches, in the negative it goes before.', es: 'Dímelo, siéntate: en afirmativo el pronombre se pega, en negativo va delante.' },
  },
  {
    id: 'comparativos-superlativos',
    level: 'A2',
    unit: 'a2-comparar',
    title: { en: 'Comparatives and superlatives', es: 'Comparativos y superlativos' },
    blurb: { en: 'Más que, menos que, tan como, el más, -ísimo.', es: 'Más que, menos que, tan como, el más, -ísimo.' },
  },
  {
    id: 'indefinidos',
    level: 'A2',
    unit: 'a2-comparar',
    title: { en: 'Indefinites: algo, alguien, algún', es: 'Indefinidos: algo, alguien, algún' },
    blurb: { en: 'And their negative pairs: nada, nadie, ningún.', es: 'Y sus pares negativos: nada, nadie, ningún.' },
  },
  {
    id: 'por-para',
    level: 'A2',
    unit: 'a2-comparar',
    title: { en: 'Por or para?', es: '¿Por o para?' },
    blurb: { en: 'Cause or purpose, where English blurs them into "for".', es: 'Causa o finalidad.' },
  },
  {
    id: 'diminutivos',
    level: 'A2',
    unit: 'a2-comparar',
    title: { en: 'Diminutives: -ito, -cito, -ecito', es: 'Diminutivos: -ito, -cito, -ecito' },
    blurb: { en: 'Casita, cafecito, ahorita: small, warm, polite.', es: 'Casita, cafecito, ahorita: pequeño, cariñoso, cortés.' },
  },
  {
    id: 'numerales-ordinales',
    level: 'A2',
    unit: 'a2-comparar',
    title: { en: 'Ordinal numbers: primero, segundo, tercer', es: 'Los ordinales: primero, segundo, tercer' },
    blurb: { en: 'El primer piso, la tercera vez, el primero de mayo.', es: 'El primer piso, la tercera vez, el primero de mayo.' },
  },
  {
    id: 'saber-conocer',
    level: 'A2',
    unit: 'a2-verbos',
    title: { en: 'Saber or conocer?', es: '¿Saber o conocer?' },
    blurb: { en: 'Knowing a fact or being acquainted with someone.', es: 'Saber un dato o conocer a alguien.' },
  },
  {
    id: 'pedir-preguntar',
    level: 'A2',
    unit: 'a2-verbos',
    title: { en: 'Pedir or preguntar?', es: '¿Pedir o preguntar?' },
    blurb: { en: 'Asking FOR something or asking a question.', es: 'Pedir algo o hacer una pregunta.' },
  },
  {
    id: 'llevar-traer-ir-venir',
    level: 'A2',
    unit: 'a2-verbos',
    title: { en: 'Llevar, traer, ir, venir', es: 'Llevar, traer, ir, venir' },
    blurb: { en: 'The speaker\'s point of view decides which one.', es: 'El punto de vista del hablante decide.' },
  },
  // ========================= B1 =========================
  {
    id: 'subjuntivo-presente-forma',
    level: 'B1',
    unit: 'b1-subjuntivo',
    title: { en: 'Present subjunctive: the forms', es: 'Presente de subjuntivo: las formas' },
    blurb: { en: 'Hable, coma, viva: the swapped endings.', es: 'Hable, coma, viva: las terminaciones cambiadas.' },
  },
  {
    id: 'subjuntivo-disparadores',
    level: 'B1',
    unit: 'b1-subjuntivo',
    title: { en: 'What triggers the subjunctive', es: 'Qué exige subjuntivo' },
    blurb: { en: 'Wish, emotion, doubt, denied opinion.', es: 'Deseo, emoción, duda, opinión negada.' },
  },
  {
    id: 'ojala-quizas',
    level: 'B1',
    unit: 'b1-subjuntivo',
    title: { en: 'Ojalá, quizás, tal vez', es: 'Ojalá, quizás, tal vez' },
    blurb: { en: 'Expressing hope and uncertainty.', es: 'Expresar esperanza e incertidumbre.' },
  },
  {
    id: 'temporales-subjuntivo',
    level: 'B1',
    unit: 'b1-subjuntivo',
    title: { en: 'Cuando + subjunctive', es: 'Cuando + subjuntivo' },
    blurb: { en: 'Future time clauses: cuando llegues, not llegas.', es: 'Temporales de futuro: cuando llegues.' },
  },
  {
    id: 'subjuntivo-relativo',
    level: 'B1',
    unit: 'b1-subjuntivo',
    title: { en: 'Subjunctive in relative clauses', es: 'Subjuntivo en oraciones de relativo' },
    blurb: { en: 'Busco un departamento que tenga balcón: unknown antecedent, subjunctive.', es: 'Busco un departamento que tenga balcón: antecedente desconocido, subjuntivo.' },
  },
  {
    id: 'condicional-simple',
    level: 'B1',
    unit: 'b1-condicional',
    title: { en: 'The conditional', es: 'El condicional simple' },
    blurb: { en: 'Hablaría: politeness, advice, hypothesis.', es: 'Hablaría: cortesía, consejo, hipótesis.' },
  },
  {
    id: 'condicionales-tipo1',
    level: 'B1',
    unit: 'b1-condicional',
    title: { en: 'Si + present: real conditions', es: 'Si + presente: condicional real' },
    blurb: { en: 'Si tengo tiempo, voy: what can really happen.', es: 'Si tengo tiempo, voy: lo que puede pasar.' },
  },
  {
    id: 'pluscuamperfecto',
    level: 'B1',
    unit: 'b1-condicional',
    title: { en: 'The past perfect', es: 'El pluscuamperfecto' },
    blurb: { en: 'Había comido: what happened before another past.', es: 'Había comido: antes de otro pasado.' },
  },
  {
    id: 'relativos',
    level: 'B1',
    unit: 'b1-estructuras',
    title: { en: 'Relative pronouns: que, quien, donde', es: 'Relativos: que, quien, donde' },
    blurb: { en: 'Joining two sentences with one word.', es: 'Unir dos frases con una palabra.' },
  },
  {
    id: 'se-impersonal-pasiva',
    level: 'B1',
    unit: 'b1-estructuras',
    title: { en: 'Se: impersonal and passive', es: 'Se impersonal y pasiva refleja' },
    blurb: { en: 'Se habla español, se venden casas.', es: 'Se habla español, se venden casas.' },
  },
  {
    id: 'se-accidental',
    level: 'B1',
    unit: 'b1-estructuras',
    title: { en: 'Se me olvidó: the accidental se', es: 'Se involuntario: se me olvidó, se me cayó' },
    blurb: { en: 'Se me cayó, se nos acabó: the thing "did it", you just went through it.', es: 'Se me cayó, se nos acabó: la cosa "lo hizo", tú solo lo viviste.' },
  },
  {
    id: 'perifrasis',
    level: 'B1',
    unit: 'b1-estructuras',
    title: { en: 'Verb periphrases', es: 'Perífrasis verbales' },
    blurb: { en: 'Empezar a, acabar de, volver a, seguir + gerund.', es: 'Empezar a, acabar de, volver a, seguir + gerundio.' },
  },
  {
    id: 'por-para-avanzado',
    level: 'B1',
    unit: 'b1-estructuras',
    title: { en: 'Por and para: advanced uses', es: 'Por y para: usos avanzados' },
    blurb: { en: 'Set phrases and the genuinely hard cases.', es: 'Expresiones fijas y los casos difíciles.' },
  },
  {
    id: 'verbos-preposicion',
    level: 'B1',
    unit: 'b1-estructuras',
    title: { en: 'Verbs with fixed prepositions', es: 'Verbos con preposición' },
    blurb: { en: 'Pensar en, soñar con, depender de: the verb decides the preposition.', es: 'Pensar en, soñar con, depender de: el verbo decide la preposición.' },
  },
  {
    id: 'estar-participio',
    level: 'B1',
    unit: 'b1-estructuras',
    title: { en: 'Estar + participle: the resulting state', es: 'Estar + participio: el estado como resultado' },
    blurb: { en: 'La puerta está abierta: the resulting state, with the participle agreeing with the subject.', es: 'La puerta está abierta: el estado como resultado, con el participio concordando con el sujeto.' },
  },
  // ========================= B2 =========================
  {
    id: 'subjuntivo-imperfecto',
    level: 'B2',
    unit: 'b2-subjuntivo',
    title: { en: 'Imperfect subjunctive', es: 'Imperfecto de subjuntivo' },
    blurb: { en: 'Hablara / hablase: past wishes and conditions.', es: 'Hablara / hablase: deseos y condiciones en pasado.' },
  },
  {
    id: 'subjuntivo-perfecto',
    level: 'B2',
    unit: 'b2-subjuntivo',
    title: { en: 'Perfect subjunctive forms', es: 'Subjuntivo compuesto' },
    blurb: { en: 'Haya hablado, hubiera hablado.', es: 'Haya hablado, hubiera hablado.' },
  },
  {
    id: 'condicionales-tipo2-3',
    level: 'B2',
    unit: 'b2-subjuntivo',
    title: { en: 'Unreal conditions: si tuviera, si hubiera', es: 'Condicionales irreales' },
    blurb: { en: 'What is not true, and what can no longer be.', es: 'Lo que no es y lo que ya no puede ser.' },
  },
  {
    id: 'estilo-indirecto',
    level: 'B2',
    unit: 'b2-oraciones',
    title: { en: 'Reported speech', es: 'Estilo indirecto' },
    blurb: { en: 'Dijo que venía: the tense shift.', es: 'Dijo que venía: el cambio de tiempos.' },
  },
  {
    id: 'pasiva-ser-participio',
    level: 'B2',
    unit: 'b2-oraciones',
    title: { en: 'Passive: ser + participle', es: 'Pasiva con ser + participio' },
    blurb: { en: 'And why it is rarer in Spanish than in English.', es: 'Y por qué es menos frecuente que en inglés.' },
  },
  {
    id: 'concesivas',
    level: 'B2',
    unit: 'b2-oraciones',
    title: { en: 'Concession: aunque, a pesar de', es: 'Concesivas: aunque, a pesar de' },
    blurb: { en: 'Aunque with indicative or subjunctive, different meanings.', es: 'Aunque con indicativo o subjuntivo.' },
  },
  {
    id: 'finales-causales',
    level: 'B2',
    unit: 'b2-oraciones',
    title: { en: 'Purpose and cause: para que, porque, ya que', es: 'Finales y causales' },
    blurb: { en: 'Para que + subjunctive, porque + indicative.', es: 'Para que + subjuntivo, porque + indicativo.' },
  },
  {
    id: 'oraciones-consecutivas',
    level: 'B2',
    unit: 'b2-oraciones',
    title: { en: 'Result: tan ... que, así que, por eso', es: 'Consecutivas: tan ... que, así que, por eso' },
    blurb: { en: 'Tan cansado que, tanto trabajo que, así que: what came of it.', es: 'Tan cansado que, tanto trabajo que, así que: el resultado.' },
  },
  {
    id: 'lo-neutro',
    level: 'B2',
    unit: 'b2-oraciones',
    title: { en: 'The neuter lo', es: 'El lo neutro' },
    blurb: { en: 'Lo importante, lo que dijiste, lo bien que canta.', es: 'Lo importante, lo que dijiste, lo bien que canta.' },
  },
  {
    id: 'gerundio-participio-construcciones',
    level: 'B2',
    unit: 'b2-oraciones',
    title: { en: 'Gerund and participle constructions', es: 'Construcciones de gerundio y participio' },
    blurb: { en: 'Siendo, hecho esto, llevar + gerund.', es: 'Siendo, hecho esto, llevar + gerundio.' },
  },
  {
    id: 'verbos-de-cambio',
    level: 'B2',
    unit: 'b2-oraciones',
    title: { en: 'Verbs of change', es: 'Verbos de cambio' },
    blurb: { en: 'Ponerse, volverse, hacerse, quedarse, llegar a ser: how something becomes something else.', es: 'Ponerse, volverse, hacerse, quedarse, llegar a ser: cómo algo pasa a ser otra cosa.' },
  },
  // ========================= C1 =========================
  {
    id: 'futuro-condicional-perfecto',
    level: 'C1',
    unit: 'c1-matices',
    title: { en: 'Future and conditional perfect', es: 'Futuro compuesto y condicional compuesto' },
    blurb: { en: 'Habré terminado, habría dicho.', es: 'Habré terminado, habría dicho.' },
  },
  {
    id: 'probabilidad-con-tiempos',
    level: 'C1',
    unit: 'c1-matices',
    title: { en: 'Probability through tenses', es: 'La probabilidad con los tiempos' },
    blurb: { en: 'Serán las tres: the future used as a guess.', es: 'Serán las tres: el futuro como conjetura.' },
  },
  {
    id: 'relativos-complejos',
    level: 'C1',
    unit: 'c1-matices',
    title: { en: 'Complex relative clauses', es: 'Relativos complejos' },
    blurb: { en: 'El cual, cuyo, en el que: the written register.', es: 'El cual, cuyo, en el que: registro escrito.' },
  },
  {
    id: 'leismo-laismo',
    level: 'C1',
    unit: 'c1-matices',
    title: { en: 'Leísmo and laísmo', es: 'Leísmo y laísmo' },
    blurb: { en: 'What is accepted and what counts as an error.', es: 'Qué se acepta y qué es error.' },
  },
  {
    id: 'marcadores-discursivos',
    level: 'C1',
    unit: 'c1-matices',
    title: { en: 'Discourse markers', es: 'Marcadores discursivos' },
    blurb: { en: 'Sin embargo, por lo tanto, en cuanto a.', es: 'Sin embargo, por lo tanto, en cuanto a.' },
  },
];

export const SYLLABUS_LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

/**
 * game_progress key for the course. Deliberately NOT 'grammar-choice': the
 * Game tab's drill and the course are different activities, and a topic
 * played as a game should not tick itself off the syllabus.
 */
export const GRAMMAR_PROGRESS_KEY = 'grammar-course';

// Language key: 'es' (default) = the Spanish syllabus above, byte-for-byte unchanged;
// 'en' = the English syllabus from the English topic tree (lib/grammar/syllabusEn.ts).
const EN_SYLLABUS_LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

function syllabusOf(lang: string): SyllabusTopic[] {
  return lang === 'en' ? EN_SYLLABUS : GRAMMAR_SYLLABUS;
}

function unitsOf(lang: string): SyllabusUnit[] {
  return lang === 'en' ? EN_UNITS : GRAMMAR_UNITS;
}

export function syllabusLevels(lang = 'es'): Level[] {
  return lang === 'en' ? EN_SYLLABUS_LEVELS : SYLLABUS_LEVELS;
}

export function syllabusForLevel(level: Level, lang = 'es'): SyllabusTopic[] {
  return syllabusOf(lang).filter((t) => t.level === level);
}

export function unitsForLevel(level: Level, lang = 'es'): SyllabusUnit[] {
  return unitsOf(lang).filter((u) => u.level === level);
}

export function topicsForUnit(unitId: string, lang = 'es'): SyllabusTopic[] {
  return syllabusOf(lang).filter((t) => t.unit === unitId);
}

export function syllabusTopic(id: string, lang = 'es'): SyllabusTopic | undefined {
  return syllabusOf(lang).find((t) => t.id === id);
}

/**
 * User feedback (drill Done screen): "put in a button so that the
 * next topic can be studied". The next topic in syllabus order that
 * ALREADY HAS an authored lesson, so the button never leads to an empty screen. It does not
 * stop at the level boundary: the syllabus continues at the next level.
 */
export function nextWrittenTopic(lang: string, topicId: string): SyllabusTopic | undefined {
  const syllabus = syllabusOf(lang);
  const at = syllabus.findIndex((t) => t.id === topicId);
  if (at < 0) return undefined;
  return syllabus.slice(at + 1).find((t) => hasLesson(lang, t.id));
}

/** The authored lesson for a syllabus entry, if it has been written yet. */
export function lessonFor(lang: string, topicId: string): GrammarTopicData | undefined {
  return getGrammarTopic(lang, topicId);
}

export function hasLesson(lang: string, topicId: string): boolean {
  return getGrammarTopic(lang, topicId) !== undefined;
}

interface GrammarTopicProgress {
  state: 'done';
  correct: number;
  total: number;
}

const GRAMMAR_KINDS: GrammarKind[] = ['choice', 'match', 'form', 'transform'];

/**
 * The lesson's tasks can be started separately by kind, so the
 * game_progress itemId is a `${topicId}:${kind}` row (app/grammar/[topic]
 * writes only at >=80%). The old single-valued rows (itemId === topicId, from the era
 * before the split) mean every kind is done, so the already finished
 * lessons do not revert to open. A topic is done only if there is a done row for
 * ALL the kinds that EXIST in its lesson.
 */
export function doneGrammarTopicProgress(
  lang: string,
  rows: { itemId: string; state: string; data: unknown }[]
): Map<string, GrammarTopicProgress> {
  const legacy = new Map<string, GrammarTopicProgress>();
  const perKind = new Map<string, Map<GrammarKind, GrammarTopicProgress>>();

  for (const row of rows) {
    if (row.state !== 'done') continue;
    const data = (row.data ?? {}) as { correct?: number; total?: number };
    const progress: GrammarTopicProgress = { state: 'done', correct: data.correct ?? 0, total: data.total ?? 0 };
    const sep = row.itemId.indexOf(':');
    if (sep < 0) {
      legacy.set(row.itemId, progress);
      continue;
    }
    const topicId = row.itemId.slice(0, sep);
    const kind = row.itemId.slice(sep + 1) as GrammarKind;
    const kinds = perKind.get(topicId) ?? new Map<GrammarKind, GrammarTopicProgress>();
    kinds.set(kind, progress);
    perKind.set(topicId, kinds);
  }

  const result = new Map(legacy);
  for (const [topicId, kinds] of perKind) {
    if (result.has(topicId)) continue; // the old row already means every kind is done
    const lesson = lessonFor(lang, topicId);
    const required = lesson ? GRAMMAR_KINDS.filter((k) => grammarKindCounts(lesson)[k] > 0) : [];
    if (required.length === 0 || !required.every((k) => kinds.has(k))) continue;
    let correct = 0;
    let total = 0;
    for (const k of required) {
      const p = kinds.get(k)!;
      correct += p.correct;
      total += p.total;
    }
    result.set(topicId, { state: 'done', correct, total });
  }
  return result;
}

/**
 * The existing task kinds of the lesson in the order of the lesson page's buttons
 * (including "why", unlike the "done" condition above): the lesson's % is
 * the average of these, a kind not yet started counts as 0.
 */
const LESSON_KIND_ORDER: readonly GrammarKind[] = ['choice', 'article', 'match', 'form', 'why', 'transform', 'spot', 'order', 'dictation'];

// The button of the temporary (trial) kinds appears, but they do not
// pull down the lesson's % (until the developer approves them, they are not part of the lesson).
const TRIAL_KINDS: readonly GrammarKind[] = ['spot', 'order', 'dictation'];

/** The lesson's buttons: every kind that has items. */
function lessonButtonKinds(lesson: GrammarTopicData): GrammarKind[] {
  const counts = grammarKindCounts(lesson);
  return LESSON_KIND_ORDER.filter((k) => counts[k] > 0);
}

/** The kinds that count toward the lesson's %: the kinds of the buttons, without the temporary (all-trial-item) kinds. */
export function scoredKinds(lesson: GrammarTopicData): GrammarKind[] {
  return lessonButtonKinds(lesson).filter(
    (k) => !TRIAL_KINDS.includes(k) || lesson.items.some((it) => (it as { kind?: string; trial?: boolean }).kind === k && !(it as { trial?: boolean }).trial)
  );
}

export function lessonKinds(lang: string, topicId: string): GrammarKind[] {
  const lesson = lessonFor(lang, topicId);
  return lesson ? scoredKinds(lesson) : [];
}

/** How much of the syllabus is written, for the header line. */
export function lessonCoverage(lang: string): { written: number; planned: number } {
  const syllabus = syllabusOf(lang);
  const planned = syllabus.length;
  const written = syllabus.filter((t) => hasLesson(lang, t.id)).length;
  return { written, planned };
}

/**
 * Authored lessons that are NOT in the syllabus map. Any such topic would be
 * unreachable from the study screen, so the test suite fails on it rather than
 * letting the content go quietly missing.
 */
export function orphanLessons(lang: string): string[] {
  const ids = new Set(syllabusOf(lang).map((t) => t.id));
  return getGrammarTopics(lang)
    .map((t) => t.topic)
    .filter((id) => !ids.has(id));
}
