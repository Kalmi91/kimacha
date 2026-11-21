// FB700 + FB705: a conjugation task of a tense lesson ("poder · ellos/ellas/ustedes", badge "presente -> preterite") did not say
// WHICH tense it asks for in a way the learner could read: the Spanish term alone was not clear. The template gives the target
// tense an everyday name in the interface language, and one Spanish sample sentence with a time adverb and a gap that
// shows the tense ("Ayer, ellos/ellas/ustedes ___ (poder)."). The time -> adverb map is here, in one place.
// Only the tenses taught by A2 are mapped (the adverbs are plain A1/A2 words, lib/grammar/tenseGate.ts has no structure
// in them); the other tenses (conditional, subjunctive ...) keep the old wording.

import type { FormItem, Lang4, TenseId } from '@/lib/grammar/lessonTypes';

/** The Spanish time adverb that opens the sample sentence of a tense (the comma is part of it where Spanish writes one). */
export const TENSE_ADVERB: Partial<Record<TenseId, string>> = {
  presente: 'Hoy,',
  indefinido: 'Ayer,',
  imperfecto: 'Antes,',
  perfecto: 'Hoy ya',
  'futuro-simple': 'Mañana,',
};

/** The everyday name of the target tense, in the interface language (the Spanish term is on the badge). */
export const TENSE_EVERYDAY: Partial<Record<TenseId, Lang4>> = {
  presente: { en: 'Present (now)', es: 'Presente (ahora)', hu: 'Jelen idő (most)', de: 'Gegenwart (jetzt)' },
  indefinido: {
    en: 'Past (finished action)',
    es: 'Pasado (acción terminada)',
    hu: 'Múlt (befejezett cselekvés)',
    de: 'Vergangenheit (abgeschlossene Handlung)',
  },
  imperfecto: {
    en: 'Past (used to / was doing)',
    es: 'Pasado (costumbre o acción en curso)',
    hu: 'Múlt (szokás vagy folyamatban lévő cselekvés)',
    de: 'Vergangenheit (Gewohnheit oder andauernde Handlung)',
  },
  perfecto: {
    en: 'Recent past (have done)',
    es: 'Pasado reciente (he hecho)',
    hu: 'Közelmúlt (már megtörtént, a mához kötődik)',
    de: 'Nahe Vergangenheit (hat getan)',
  },
  'futuro-simple': { en: 'Future (will do)', es: 'Futuro (haré)', hu: 'Jövő (megteszi)', de: 'Zukunft (wird tun)' },
};

// the persons that can stand as the subject of the sample sentence
const PRONOUN = /^(yo|tú|vos|él|ella|usted|ustedes|nosotros|nosotras|ellos|ellas|vosotros|vosotras|él\/ella|él\/ella\/usted|ellos\/ellas\/ustedes)$/i;

export interface FormTenseCue {
  /** The everyday name of the asked tense, in the interface language. */
  label: string;
  /** The Spanish sample sentence with the time adverb and the gap: "Ayer, ellos/ellas/ustedes ___ (poder)." */
  sentence: string;
}

/**
 * The cue of a tense form item: its everyday tense name and the sample sentence. null when the item has no tense, a hand-written
 * question (`q`), a person that is not a plain pronoun (a time cue or a trigger phrase is already the person) or a tense that
 * is not mapped: those keep their wording.
 */
export function formTenseCue(item: FormItem, pick: (l: Record<string, string>) => string): FormTenseCue | null {
  if (!item.tense || item.q) return null;
  const adverb = TENSE_ADVERB[item.tense.to];
  const everyday = TENSE_EVERYDAY[item.tense.to];
  if (!adverb || !everyday) return null;
  const person = item.person.trim();
  if (!PRONOUN.test(person)) return null;
  return { label: pick(everyday), sentence: `${adverb} ${person} ___ (${item.verb}).` };
}
