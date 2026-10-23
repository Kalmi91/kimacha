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

import { getGrammarTopic, getGrammarTopicIds, grammarKindCounts, type GrammarKind, type GrammarTopicData } from '@/lib/games/content';
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
  'tu-usted': 'core',
  posesivos: 'core',
  demostrativos: 'exam',
  interrogativos: 'core',
  negacion: 'core',
  'conectores-basicos': 'core',
  gustar: 'core-plus',
  'ir-a-infinitivo': 'core-plus',
  'perifrasis-modales': 'core-plus',
  'tener-expresiones': 'core',
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

interface SyllabusData {
  units: SyllabusUnit[];
  topics: SyllabusTopic[];
}

let syllabusData: SyllabusData | null = null;

/**
 * The Spanish syllabus text (unit and topic titles, blurbs) lives in data/grammar/syllabus.json, in
 * teaching order. The file is required on the first call (not at import time), like the words-open
 * files, so a module or test that never needs the syllabus never parses it.
 *
 * User feedback: "an important part of grammar is the distinction of the parts of speech, put
 * emphasis on this too." The developer asked for it ALONGSIDE the game in the course material as
 * well, so the part-of-speech overview ('clases-de-palabras') is the very first topic of the
 * syllabus: every later rule ("the adjective comes after the noun", "the verb is conjugated")
 * assumes that the learner can tell these apart at the word level.
 */
function spanishSyllabus(): SyllabusData {
  if (!syllabusData) {
    const data: SyllabusData = require('@/data/grammar/syllabus.json');
    syllabusData = data;
  }
  return syllabusData;
}

export function getGrammarUnits(): SyllabusUnit[] {
  return spanishSyllabus().units;
}

export function getGrammarSyllabus(): SyllabusTopic[] {
  return spanishSyllabus().topics;
}

export const SYLLABUS_LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

/**
 * game_progress key for the course. Deliberately NOT 'grammar-choice': the
 * Game tab's drill and the course are different activities, and a topic
 * played as a game should not tick itself off the syllabus.
 */
export const GRAMMAR_PROGRESS_KEY = 'grammar-course';

// Language key: 'es' (default) = the Spanish syllabus (data/grammar/syllabus.json), byte-for-byte unchanged;
// 'en' = the English syllabus from the English topic tree (lib/grammar/syllabusEn.ts);
// 'hu' = no Hungarian grammar course yet: an empty syllabus (the course tab says it is coming).
const EN_SYLLABUS_LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

function syllabusOf(lang: string): SyllabusTopic[] {
  if (lang === 'hu') return [];
  return lang === 'en' ? EN_SYLLABUS : getGrammarSyllabus();
}

function unitsOf(lang: string): SyllabusUnit[] {
  if (lang === 'hu') return [];
  return lang === 'en' ? EN_UNITS : getGrammarUnits();
}

export function syllabusLevels(lang = 'es'): Level[] {
  if (lang === 'hu') return [];
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
    const required = lesson ? lessonButtonKinds(lesson) : [];
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
 * (the "done" condition above requires all of them, including the trial
 * kinds): the lesson's % is the average of these, a kind not yet started counts as 0.
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
  return getGrammarTopicIds(lang).filter((id) => !ids.has(id));
}
