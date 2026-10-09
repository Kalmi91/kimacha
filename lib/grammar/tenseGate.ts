// User feedback (easy:The clients have): "you are putting in the 'have arrived' sentence again,
// even though you have not taught this grammatical structure yet, this mistake has occurred
// several times, watch out for this, solve it so that it does not happen again. let there be a way
// where we unlock certain grammatical structures, and then it is possible to go to the exam too,
// and then give the sentences in there as well".
//
// The corpus audit used to guard only the VOCABULARY: every word must be learned. Nothing
// guarded the GRAMMAR, so the example sentence of an A1 word could freely use an A2
// compound past ("han llegado" = have arrived). This module closes that gap.
//
// The detection is not a heuristic: the conjugation engine `lib/games/conjugate.ts` already
// generates the inflected forms from the corpus verbs, so we build a form → structure
// map and simply look up the words of the sentence. What is not on the
// map does not count, so no false alarm can arise.
// The compound tenses (haber + participio) are caught by a separate pattern, because they
// consist of two words, and these are exactly the most common level overshoots.

import { LEVELS, type Level } from '@/data/words';
import { openWords } from '@/data/openWords';
import { TENSES, conjugate, type Tense as SimpleTense } from '@/lib/games/conjugate';

export type Structure =
  | SimpleTense
  | 'perfecto'
  | 'pluscuamperfecto'
  | 'futuro_perfecto'
  | 'condicional_perfecto'
  | 'imperativo';

/** At which level we TEACH the structure (the order of lib/grammar/syllabus.ts). */
const STRUCTURE_LEVEL: Record<Structure, Level> = {
  // The present tense is the default: even the A0 sentences are in it, the syllabus's
  // A1 `presente-regular` topic describes the rule, it does not introduce its use.
  presente: 'A0',
  indefinido: 'A2',
  imperfecto: 'A2',
  futuro: 'A2',
  perfecto: 'A2',
  condicional: 'B1',
  subjuntivo_presente: 'B1',
  pluscuamperfecto: 'B1',
  futuro_perfecto: 'C1',
  condicional_perfecto: 'C1',
  // The usted form of the imperative and the prohibition are subjunctive in FORM (tome, no seas),
  // but the syllabus teaches them at A2, and they are not a subjunctive subordinate clause. A
  // separate structure, so that an A2 "Tome asiento" does not fail the B1 subjunctive gate.
  imperativo: 'A2',
};

const HABER_PRESENT = new Set(['he', 'has', 'ha', 'hemos', 'habeis', 'habéis', 'han']);
const HABER_IMPERFECT = new Set(['habia', 'había', 'habias', 'habías', 'habiamos', 'habíamos', 'habiais', 'habíais', 'habian', 'habían']);
const HABER_FUTURE = new Set(['habre', 'habré', 'habras', 'habrás', 'habra', 'habrá', 'habremos', 'habreis', 'habréis', 'habran', 'habrán']);
const HABER_CONDITIONAL = new Set(['habria', 'habría', 'habrias', 'habrías', 'habriamos', 'habríamos', 'habriais', 'habríais', 'habrian', 'habrían']);

// The irregular participles that the -ado/-ido pattern does not catch.
const IRREGULAR_PARTICIPLES = new Set([
  'visto', 'hecho', 'dicho', 'escrito', 'puesto', 'vuelto', 'abierto', 'muerto',
  'roto', 'cubierto', 'descrito', 'devuelto', 'resuelto', 'satisfecho', 'impreso',
]);

function isParticiple(token: string): boolean {
  return /(?:ado|ados|ada|adas|ido|idos|ida|idas)$/.test(token) || IRREGULAR_PARTICIPLES.has(token);
}

// `que` is deliberately NOT here: "que + subjunctive" is exactly the subordinate-clause
// subjunctive, not an imperative.
const COMMAND_LEAD_INS = new Set(['no', 'nunca', 'jamas', 'jamás', 'y', 'pero']);

// In Spanish a trigger word calls out the subjunctive. Without a trigger a word of subjunctive
// FORM is almost certainly a noun (tema, salga as "outcome"), so we count it as subjunctive only
// when a trigger is present. This gate errs on the permissive side.
const SUBJUNCTIVE_TRIGGERS = new Set([
  'que', 'ojala', 'ojalá', 'quiza', 'quizá', 'quizas', 'quizás', 'acaso',
  'cuando', 'aunque', 'mientras', 'hasta', 'antes', 'despues', 'después', 'sin',
  'para', 'como', 'donde', 'dónde', 'tal',
]);

/** Imperative position: start of a clause, after a prohibition, or with an attached pronoun. */
function isCommandPosition(tokens: string[], i: number): boolean {
  if (/(?:me|te|se|nos|le|les|lo|la|los|las)$/.test(tokens[i]) && tokens[i].length > 5) return true;
  if (i === 0) return true;
  const prev = tokens[i - 1];
  return COMMAND_LEAD_INS.has(prev) && i <= 2;
}

export function tokenize(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .replace(/[¿?¡!.,;:()"«»]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// Form → structure. On a collision (e.g. the `hablamos` form of -ar verbs is both present AND
// preterite) the EARLIER-taught structure wins, so a regular
// A1 sentence never fails the gate.
let formIndex: Map<string, Structure> | null = null;

function levelRank(level: Level): number {
  return LEVELS.indexOf(level);
}

function buildFormIndex(): Map<string, Structure> {
  const index = new Map<string, Structure>();
  const infinitives = new Set<string>();
  // the verbs of words-open; every alternative of a slash form ("volver / regresar")
  // is a separate infinitive.
  for (const w of openWords) {
    if (w.pos !== 'verb') continue;
    for (const alt of String(w.es ?? '').split(' / ')) {
      const es = alt.trim().toLowerCase();
      // Among the dictionary forms there is also a conjugated entry ("yo hablo"), it
      // cannot be conjugated; only the infinitives are needed.
      if (/^[a-záéíóúñü]+(ar|er|ir)$/.test(es)) infinitives.add(es);
    }
  }
  for (const inf of infinitives) {
    for (const tense of TENSES) {
      const forms = conjugate(inf, tense);
      if (!forms) continue;
      for (const { form } of forms) {
        const key = form.toLowerCase();
        const seen = index.get(key);
        if (seen && levelRank(STRUCTURE_LEVEL[seen]) <= levelRank(STRUCTURE_LEVEL[tense])) continue;
        index.set(key, tense);
      }
    }
  }
  return index;
}

function getFormIndex(): Map<string, Structure> {
  if (!formIndex) formIndex = buildFormIndex();
  return formIndex;
}

// Homographs. Half of the inflected forms are also a noun or a preposition: `vino`
// (wine / preterite of venir), `entre` (between / subjunctive of entrar), `viaje` (trip /
// subjunctive of viajar), `tema` (topic / subjunctive of temer). If the word occurs in the
// corpus as NOT a verb, we do not take it as a verb form: the gate should rather let a
// suspicious sentence through than force regular sentences to be rewritten.
let nonVerbForms: Set<string> | null = null;

function getNonVerbForms(): Set<string> {
  if (nonVerbForms) return nonVerbForms;
  const set = new Set<string>();
  for (const w of openWords) {
    if (w.pos === 'verb') continue;
    // The `phrase` entries consist of several words ("no hablo español"), and among
    // their words there are also VERB FORMS. If we included them, we would knock out our own
    // form map: "hablo" would become a non-verb. So we leave the phrases out.
    if (w.pos === 'phrase') continue;
    const es = String(w.es ?? '').trim().toLowerCase();
    if (!es) continue;
    // The dictionary form comes with an article ("el vino"), in the sentence it stands without one.
    for (const part of es.split(/\s+/)) {
      if (['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas'].includes(part)) continue;
      set.add(part);
      // The dictionary form is singular, in the sentence it can be plural: "viajes".
      set.add(`${part}s`);
      if (/[^aeiouáéíóú]$/.test(part)) set.add(`${part}es`);
    }
  }
  nonVerbForms = set;
  return set;
}

/** For tests: forget the generated form map. */
export function resetFormIndex(): void {
  formIndex = null;
  nonVerbForms = null;
}

/** Which tenses the sentence uses. An unknown form is not included. */
export function detectStructures(sentence: string): Set<Structure> {
  const tokens = tokenize(sentence);
  const found = new Set<Structure>();
  const consumed = new Set<number>();

  // Compound tenses: haber + participio. These two together are unambiguous, and
  // this was exactly the faulty case ("han llegado" in an A1 sentence).
  for (let i = 0; i < tokens.length - 1; i++) {
    const aux = tokens[i];
    if (!isParticiple(tokens[i + 1])) continue;
    let structure: Structure | null = null;
    if (HABER_PRESENT.has(aux)) structure = 'perfecto';
    else if (HABER_IMPERFECT.has(aux)) structure = 'pluscuamperfecto';
    else if (HABER_FUTURE.has(aux)) structure = 'futuro_perfecto';
    else if (HABER_CONDITIONAL.has(aux)) structure = 'condicional_perfecto';
    if (!structure) continue;
    found.add(structure);
    consumed.add(i);
    consumed.add(i + 1);
  }

  const index = getFormIndex();
  const nonVerbs = getNonVerbForms();
  tokens.forEach((token, i) => {
    if (consumed.has(i)) return;
    if (nonVerbs.has(token)) return;
    const structure = index.get(token);
    if (!structure) return;
    // A subjunctive FORM also stands as an imperative: "Tome asiento", "No seas tonto",
    // "Avísame". In that case the syllabus's imperative topic is the yardstick (A2), not
    // that of the subjunctive subordinate clause (B1). We take it as an imperative if it
    // stands at the head of the clause, if a prohibition word precedes it, or if a pronoun is attached.
    if (structure === 'subjuntivo_presente') {
      if (isCommandPosition(tokens, i)) {
        found.add('imperativo');
        return;
      }
      if (!tokens.slice(0, i).some((t) => SUBJUNCTIVE_TRIGGERS.has(t))) return;
    }
    found.add(structure);
  });

  return found;
}
