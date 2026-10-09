// Pure helper for the LessonBody's
// table block. It decides whether a `table` block is a conjugation table
// (cells 2..n of the header are all infinitives, the row labels are personal pronouns),
// and if so, splits a form into stem and ending (the stem is faint, the
// ending is bold and colored by verb class in the LessonBody).
// For non-conjugation (reference) tables the old grid view stays.

import type { Lang4 } from './lessonTypes';

type VerbClass = 'ar' | 'er' | 'ir';

// The six persons + the split and merged variants that actually occur in
// data/games/grammar/es/*.json (usted/ustedes also separately). The keys here
// also feed isConjugationTable's person detection, so the two places do not
// drift apart.
const PERSON_GLOSS: Record<string, Lang4> = {
  yo: { hu: 'én', en: 'I', es: 'yo', de: 'ich' },
  'tú': { hu: 'te', en: 'you', es: 'tú', de: 'du' },
  usted: { hu: 'Ön', en: 'you (formal)', es: 'usted', de: 'Sie' },
  ustedes: { hu: 'Önök', en: 'you all', es: 'ustedes', de: 'Sie' },
  'él/ella': { hu: 'ő', en: 'he / she', es: 'él/ella', de: 'er / sie' },
  'él/ella/usted': { hu: 'ő / Ön', en: 'he / she / you (formal)', es: 'él/ella/usted', de: 'er / sie / Sie' },
  nosotros: { hu: 'mi', en: 'we', es: 'nosotros', de: 'wir' },
  'nosotros/nosotras': { hu: 'mi', en: 'we', es: 'nosotros/nosotras', de: 'wir' },
  vosotros: { hu: 'ti (Spanyolország)', en: 'you all (Spain)', es: 'vosotros', de: 'ihr (Spanien)' },
  'vosotros/vosotras': { hu: 'ti (Spanyolország)', en: 'you all (Spain)', es: 'vosotros/vosotras', de: 'ihr (Spanien)' },
  'ellos/ellas': { hu: 'ők', en: 'they', es: 'ellos/ellas', de: 'sie' },
  'ellos/ellas/ustedes': { hu: 'ők / Önök', en: 'they / you all', es: 'ellos/ellas/ustedes', de: 'sie / Sie' },
};

function normalizePerson(label: string): string {
  return label.trim().toLowerCase();
}

// A faint gloss next to the person, in the learner's language (contentLang). '' for an unknown
// label (no gloss line), we do not guess.
export function personGloss(label: string, contentLang: 'hu' | 'en' | 'es' | 'de'): string {
  const entry = PERSON_GLOSS[normalizePerson(label)];
  return entry ? entry[contentLang] : '';
}

function isPersonLabel(label: string): boolean {
  return normalizePerson(label) in PERSON_GLOSS;
}

// One word, an infinitive ending in -ar/-er/-ir, with an optional reflexive "se" suffix
// (levantarse). The stem part is `*`, because "ir" (to go) is an infinitive on its own
// (stem of length 0). A space or "+" in the cell (e.g. "ir a + infinitivo") rules it out.
const INFINITIVE_RE = /^[a-zàáâäèéêëìíîïòóôöùúûüñç]*(ar|er|ir)(se)?$/i;

// exported, the table card uses it to know that the label is an infinitive
// (that stays hidden, shown via the hint button), not a column header (that is visible).
export function isInfinitive(word: string): boolean {
  return INFINITIVE_RE.test(word.trim());
}

// True if the `es` values of cells 2..n of the header are all infinitives AND the label of
// every row is a personal pronoun. False for reference tables (hay/estar, pronoun tables,
// "ir a + infinitivo"), because their header is not all infinitives or their
// row labels are not the six above (possibly without being recognised).
export function isConjugationTable(header: Lang4[], rows: string[][]): boolean {
  if (header.length < 2 || rows.length === 0) return false;
  const verbHeaders = header.slice(1);
  if (!verbHeaders.every((h) => isInfinitive(h.es))) return false;
  return rows.every((row) => isPersonLabel(row[0]));
}

// person table = the label of every row is a personal pronoun
// (yo, tú, él/ella/usted...), but cells 2..n of the header are NOT all infinitives
// (e.g. "Sujeto -> pronombre de objeto indirecto", "Persona -> ir a + infinitivo",
// "Persona -> Masculino singular | ..."). Such a table can be quizzed unambiguously
// (person x column -> the cell), so the table deck serves it, not the word-deck
// fallback (glossary + sentence words), which showed "unnecessary words".
export function isPersonTable(header: Lang4[], rows: string[][]): boolean {
  if (header.length < 2 || rows.length === 0) return false;
  if (isConjugationTable(header, rows)) return false;
  return rows.every((row) => isPersonLabel(row[0]));
}

// a reference table shaped like interrogativos.json's overview (row[0]
// = an English meaning, e.g. "what"/"who"; row[1] = the single Spanish term
// that means it, e.g. "qué"; further columns are extra reference context,
// e.g. an example question, not part of the quiz). Detected by the author's
// OWN English column label ("Meaning"), not by guessing from the row text,
// so it only ever fires where the lesson explicitly framed the table this
// way (interrogativos today; any future lesson with the same header wins
// the same treatment automatically). Deliberately narrow: a table with a
// different header (Person, Singular, Infinitive, ...) stays reference-only
// and falls back to the word-deck, per the spec ("if a table cannot
// be quizzed, don't force it").
export function isMeaningTable(header: Lang4[], rows: string[][]): boolean {
  if (header.length < 2 || rows.length === 0) return false;
  if (header[0].en.trim().toLowerCase() !== 'meaning') return false;
  return !isConjugationTable(header, rows);
}

// The verb class (ar/er/ir) from the last 2 letters of the infinitive;
// for a reflexive verb the "se" comes off first (levantarse -> levantar -> ar).
export function verbClassOf(infinitive: string): VerbClass | null {
  const base = infinitive.toLowerCase().endsWith('se') ? infinitive.slice(0, -2) : infinitive;
  const end = base.slice(-2).toLowerCase();
  if (end === 'ar' || end === 'er' || end === 'ir') return end;
  return null;
}

// The regular present-tense endings per verb class (all six persons).
// splitStemEnding only splits on an ending that belongs here, otherwise null (soy,
// tengo, voy: the stem would fit, but the remainder is not a regular ending).
const REGULAR_ENDINGS: Record<VerbClass, string[]> = {
  ar: ['o', 'as', 'a', 'amos', 'áis', 'an'],
  er: ['o', 'es', 'e', 'emos', 'éis', 'en'],
  ir: ['o', 'es', 'e', 'imos', 'ís', 'en'],
};

// The stem = the infinitive minus its last 2 letters (hablar -> habl; reflexive
// levantarse -> levant). If the form (case-insensitively) starts with the stem
// AND the remainder is a regular ending, it splits (hablamos -> habl + amos).
// If not, null (irregular: soy, tengo, voy), the UI shows the whole form
// in bold. For a multi-word cell (me levanto) the leading word(s) (the pronoun) go
// before the stem in the returned stem field: "me levant" + "o".
export function splitStemEnding(form: string, infinitive: string): { stem: string; ending: string } | null {
  const verbClass = verbClassOf(infinitive);
  if (!verbClass) return null;

  const words = form.trim().split(/\s+/);
  const lastWord = words[words.length - 1];
  const lead = words.slice(0, -1).join(' ');

  const base = infinitive.toLowerCase().endsWith('se') ? infinitive.slice(0, -2) : infinitive;
  const rawStem = base.slice(0, -2);
  if (!lastWord.toLowerCase().startsWith(rawStem.toLowerCase())) return null;

  const ending = lastWord.slice(rawStem.length);
  if (!REGULAR_ENDINGS[verbClass].includes(ending.toLowerCase())) return null;

  const stem = lead ? `${lead} ${lastWord.slice(0, rawStem.length)}` : lastWord.slice(0, rawStem.length);
  return { stem, ending };
}

// every VERB (column) gets its own color by its column index,
// not by its verb class (hablar/comer/vivir used to be 3 separate colors
// by accident, but among tener/estar/poder/hacer, tener and poder and hacer are all
// -er class, so the same color went to 3 different verbs). At least 5
// colors, light/dark pairs, good contrast on the card background; the old 3 colors
// (ar/er/ir) are the first 3 indexes, so the feel of the existing tables does not change.
const VERB_COLUMN_COLORS: { light: string; dark: string }[] = [
  { light: '#1D4ED8', dark: '#7FA3FF' }, // blue
  { light: '#0F766E', dark: '#4FD1B9' }, // teal
  { light: '#7C3AED', dark: '#B899FF' }, // purple
  { light: '#B45309', dark: '#FBBF24' }, // amber
  { light: '#BE185D', dark: '#F472B6' }, // pink
  { light: '#4D7C0F', dark: '#A3E635' }, // lime
];

export function verbColumnColor(index: number, isDark: boolean): string {
  const pair = VERB_COLUMN_COLORS[index % VERB_COLUMN_COLORS.length];
  return isDark ? pair.dark : pair.light;
}
