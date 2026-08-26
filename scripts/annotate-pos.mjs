// GAMES.md F-1 (K6 DÖNTÉS, 2026-08-26): heuristic pos+gender annotation for the
// shared Spanish word set (data/words/a0.json .. c1.json) and the two live
// branches (data/words/en/*.json, data/words/hu/*.json). Four future games
// (bubble-pop, odd-one-out, conjugation-slot, grammar-choice) need to group
// vocabulary by part of speech and grammatical gender, and that metadata does
// not exist on WordEntry today.
//
// `data/words/c2.json` is INTENTIONALLY EXCLUDED (frozen corpus, per the task).
//
// The heuristic classifies every entry from its `es` field (all branches carry
// a Spanish headword, even the en/hu tracks, see data/words.ts), because gender
// is a Spanish-grammar property and conjugation-slot/grammar-choice are
// Spanish-only games (GAMES.md K15/K20).
//
// Usage: node scripts/annotate-pos.mjs [--write]
//   default: dry run, prints a per-file / per-pos / per-gender summary, writes nothing
//   --write: writes `pos` (and `gender` for nouns) into every entry, in place

import { readFileSync, writeFileSync } from 'node:fs';

const WRITE = process.argv.includes('--write');

const FILES = [
  'data/words/a0.json',
  'data/words/a1.json',
  'data/words/a2.json',
  'data/words/b1.json',
  'data/words/b2.json',
  'data/words/c1.json',
  'data/words/en/a0.json',
  'data/words/en/a1.json',
  'data/words/en/a2.json',
  'data/words/hu/a0.json',
  'data/words/hu/a1.json',
];

// ---------------------------------------------------------------------------
// Word lists. Kept short and curated (not scraped), refined by the mandatory
// 40+-card manual sample (GAMES.md F-1 instructions) rather than by guessing
// every possible Spanish word ahead of time. When the sample review finds a
// wrong class, the fix goes HERE (a new entry in a list/override), never as a
// one-off hand-edit of the JSON.
// ---------------------------------------------------------------------------

const ARTICLES = ['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas'];
const ARTICLE_GENDER = { el: 'm', los: 'm', un: 'm', unos: 'm', la: 'f', las: 'f', una: 'f', unas: 'f' };

const SUBJECT_PRONOUNS = [
  'yo', 'tú', 'tu', 'él', 'ella', 'usted',
  'nosotros', 'nosotras', 'vosotros', 'vosotras', 'ellos', 'ellas', 'ustedes',
];

// NOTE: "bajo" is deliberately absent, every bare occurrence in this corpus
// means the adjective "short/low" (see the F-1 sample review), never the
// preposition "under" (which only ever appears inside a longer phrase like
// "bajo la mesa", already routed to 'phrase' regardless of this list).
const PREPOSITIONS = [
  'a', 'de', 'en', 'con', 'por', 'para', 'entre', 'sin', 'sobre',
  'hasta', 'desde', 'hacia', 'ante', 'tras', 'según', 'durante', 'mediante', 'contra', 'excepto',
];

const NUMBERS = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
  'once', 'doce', 'trece', 'catorce', 'quince',
  'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco',
  'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
  'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa',
  'cien', 'ciento', 'doscientos', 'doscientas', 'trescientos', 'trescientas',
  'cuatrocientos', 'cuatrocientas', 'quinientos', 'quinientas', 'seiscientos', 'seiscientas',
  'setecientos', 'setecientas', 'ochocientos', 'ochocientas', 'novecientos', 'novecientas',
  'mil', 'millón', 'millones',
  'primero', 'primer', 'segundo', 'tercero', 'tercer', 'cuarto', 'quinto',
  'sexto', 'séptimo', 'octavo', 'noveno', 'décimo',
];

const PRONOUNS = [
  'yo', 'tú', 'tu', 'él', 'ella', 'ello', 'usted', 'nosotros', 'nosotras', 'vosotros', 'vosotras', 'ellos', 'ellas', 'ustedes',
  'me', 'te', 'se', 'nos', 'os', 'le', 'les', 'lo', 'la', 'los', 'las',
  // NOTE: "sí" (reflexive "himself/herself") is deliberately absent, every
  // bare occurrence in this corpus means the affirmation "yes" (kept in
  // ADVERBS below), the reflexive sense never appears standalone.
  'mí', 'ti', 'conmigo', 'contigo', 'consigo',
  'mi', 'mis', 'su', 'sus', 'nuestro', 'nuestra', 'nuestros', 'nuestras',
  'vuestro', 'vuestra', 'vuestros', 'vuestras',
  'mío', 'mía', 'míos', 'mías', 'tuyo', 'tuya', 'tuyos', 'tuyas', 'suyo', 'suya', 'suyos', 'suyas',
  'este', 'esta', 'estos', 'estas', 'esto', 'ese', 'esa', 'esos', 'esas', 'eso',
  'aquel', 'aquella', 'aquellos', 'aquellas', 'aquello',
  'quién', 'quiénes', 'quien', 'quienes', 'qué', 'que', 'cuál', 'cuáles', 'cual', 'cuales',
  'cuánto', 'cuánta', 'cuántos', 'cuántas', 'cuándo', 'dónde', 'cómo',
  'cuyo', 'cuya', 'cuyos', 'cuyas',
  'alguien', 'nadie', 'algo', 'nada', 'alguno', 'alguna', 'algunos', 'algunas', 'algún',
  'ninguno', 'ninguna', 'ningún',
  'cada', 'todo', 'toda', 'todos', 'todas', 'otro', 'otra', 'otros', 'otras',
  'varios', 'varias', 'cualquiera', 'ambos', 'ambas',
];

const ADVERBS = [
  'bien', 'mal', 'muy', 'mucho', 'mucha', 'muchos', 'muchas',
  'poco', 'poca', 'pocos', 'pocas', 'bastante', 'bastantes',
  'demasiado', 'demasiada', 'demasiados', 'demasiadas',
  'más', 'menos', 'tan', 'tanto', 'tanta', 'tantos', 'tantas', 'también', 'tampoco',
  'siempre', 'nunca', 'jamás', 'todavía', 'ya', 'aún',
  'ahora', 'hoy', 'mañana', 'ayer', 'anoche', 'anteayer',
  'luego', 'después', 'antes', 'pronto', 'tarde', 'temprano',
  'aquí', 'acá', 'allí', 'allá', 'ahí', 'cerca', 'lejos',
  'arriba', 'abajo', 'adelante', 'atrás', 'delante', 'detrás', 'encima', 'debajo', 'dentro', 'fuera',
  // NOTE: unaccented "solo" is deliberately absent, every bare occurrence in
  // this corpus means the adjective "alone/lonely", never the adverb "only"
  // (that sense is "sólo", kept below, orthographically distinct).
  'así', 'despacio', 'rápido', 'deprisa', 'casi', 'sólo',
  'quizás', 'quizá', 'además', 'incluso', 'apenas', 'recién', 'realmente', 'solamente', 'únicamente',
  'no', 'sí',
];

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const DAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

// Explicit reclassification for single words that would otherwise be
// misread by the generic rules below (mostly: looks like an -ar/-er/-ir verb
// infinitive but isn't one). Found by scanning the actual corpus, refined by
// the mandatory manual sample (GAMES.md F-1: 40+ hand-reviewed cards).
const WORD_OVERRIDES = {
  // -ar/-er/-ir false positives (adjectives/adverbs/numbers, not verbs)
  ayer: { pos: 'adv' },
  escolar: { pos: 'adj' },
  familiar: { pos: 'adj' },
  nuclear: { pos: 'adj' },
  particular: { pos: 'adj' },
  popular: { pos: 'adj' },
  similar: { pos: 'adj' },
  solar: { pos: 'adj' },
  súper: { pos: 'adj' },
  tercer: { pos: 'num' },
  primer: { pos: 'num' },
  // short noun that happens to end in "ar"
  par: { pos: 'noun', gender: 'm' },
  // the shortest Spanish verb infinitive, too short for the length>=3 rule
  ir: { pos: 'verb' },
  // very short/irregular conjugated verb forms, too short for the length>=3
  // -ar/-er/-ir rule or not ending in the infinitive suffix at all
  es: { pos: 'verb' },
  hay: { pos: 'verb' },
  // family terms conventionally used without an article
  mamá: { pos: 'noun', gender: 'f' },
  papá: { pos: 'noun', gender: 'm' },
  // greetings/discourse particles: no dedicated category in GAMES.md K6,
  // bucketed with 'adv' (closest fit, and never a gender/agreement concern)
  hola: { pos: 'adv' },
  adiós: { pos: 'adv' },
  chao: { pos: 'adv' },
  gracias: { pos: 'adv' },
  perdón: { pos: 'adv' },
  vale: { pos: 'adv' },
  ojalá: { pos: 'adv' },
  salud: { pos: 'adv' },
  // "frío" is ambiguous (adj "cold" vs. the rare verb form "I fry"); every use
  // in this corpus is the adjective, and the accented-vowel verb rule below
  // would otherwise misread it.
  frío: { pos: 'adj' },
  // bare plural noun (see the F-1 sample review, id 6888 "años (de edad)")
  años: { pos: 'noun', gender: 'm' },
  // irregular preterite/present forms too short or too irregular for any
  // suffix rule to catch, found while reviewing the parenthetical-gloss
  // entries (they recurse through classify() on their stripped base)
  fue: { pos: 'verb' },
  fui: { pos: 'verb' },
  dio: { pos: 'verb' },
  vio: { pos: 'verb' },
  vi: { pos: 'verb' },
  tiene: { pos: 'verb' },
  había: { pos: 'verb' },
  leo: { pos: 'verb' },
  espero: { pos: 'verb' },
  quedo: { pos: 'verb' },
  busco: { pos: 'verb' },
  recuerdo: { pos: 'verb' },
};

// A bare single word ending in a WRITTEN-ACCENTED vowel (á/é/í/ó/ú) is, in
// standard Spanish orthography, essentially always a conjugated verb form
// (preterite 3rd sg. -ó/-ió, 1st sg. preterite -é/-í, future -é/-á, …), 
// adjectives/nouns almost never end in a stressed vowel. Found via the
// mandatory manual sample: 70+ entries like "trabajó", "compré", "iré" had
// fallen through to the 'adj' default. WORD_OVERRIDES (checked first) carries
// the real exceptions (mamá, papá, ojalá, …).
const ACCENTED_VOWEL_ENDING = /[áéíóú]$/i;

function looksLikeConjugatedVerb(word) {
  const lower = word.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(WORD_OVERRIDES, lower)) return false;
  return ACCENTED_VOWEL_ENDING.test(lower);
}

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

function stripParenGloss(value) {
  return value.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function isSentence(value) {
  return /[.?!]$/.test(value) || /^[¿¡]/.test(value);
}

function containsAny(list, value) {
  return list.includes(value.toLowerCase());
}

/**
 * @param {{ es: string, en?: string }} entry
 * @returns {{ pos: string, gender?: string }}
 */
function classify(entry) {
  const original = String(entry.es ?? '').trim();

  // 1. Full sentences (grammar-topic example sentences like "Soy alto.",
  //    "¿Qué haces?") are not vocabulary items, never guess a pos for them.
  if (isSentence(original)) return { pos: 'phrase' };

  // 2. Parenthetical annotation ("ver (veremos)", "su (de él)", "largo
  //    (larga)") is a disambiguation hint, not part of the headword. Most are
  //    verb-conjugation hints, but the manual sample also found adjectives,
  //    pronouns and adverbs this way ("allí (dirección)" is an adverb, not a
  //    verb), classify the base word alone instead of assuming 'verb'.
  const paren = original.match(/^(\S+)\s*\([^)]*\)$/);
  if (paren) return classify({ es: paren[1], en: entry.en });

  // 3. Bare slash-pair with no spaces ("apropiado/apropiada", "será/estará").
  //    A half that looks like a conjugated verb form wins first (fixes
  //    "será/estará"), otherwise it's a masculine/feminine adjective pair,
  //    unless both halves are pronouns ("él/ella", never standalone today
  //    but guarded anyway).
  if (!original.includes(' ') && original.includes('/')) {
    const halves = original.toLowerCase().split('/');
    if (halves.some((h) => looksLikeConjugatedVerb(h))) return { pos: 'verb' };
    if (halves.every((h) => SUBJECT_PRONOUNS.includes(h) || PRONOUNS.includes(h))) {
      return { pos: 'pron' };
    }
    return { pos: 'adj' };
  }

  const parts = original.split(/\s+/);

  if (parts.length > 1) {
    const first = parts[0].toLowerCase();
    const firstSlashParts = first.split('/');
    if (firstSlashParts.some((p) => SUBJECT_PRONOUNS.includes(p))) return { pos: 'verb' };
    if (ARTICLES.includes(first)) return { pos: 'noun', gender: ARTICLE_GENDER[first] };
    // Prepositional/idiomatic/negation/possessive/full-clause phrases: no
    // single reliable pos, and guessing wrong is worse than 'phrase' for the
    // games that consume this (they simply skip the phrase bucket).
    return { pos: 'phrase' };
  }

  // 4. Single bare token (no article, Spanish vocabulary headwords almost
  //    always carry one when they are nouns, see the DÖNTÉS comment above).
  const word = parts[0];
  const lower = word.toLowerCase();

  if (containsAny(NUMBERS, lower)) return { pos: 'num' };
  if (containsAny(PRONOUNS, lower)) return { pos: 'pron' };
  if (containsAny(PREPOSITIONS, lower)) return { pos: 'prep' };
  if (Object.prototype.hasOwnProperty.call(WORD_OVERRIDES, lower)) return { ...WORD_OVERRIDES[lower] };
  if (lower.length > 6 && lower.endsWith('mente')) return { pos: 'adv' };
  if (containsAny(ADVERBS, lower)) return { pos: 'adv' };
  // "ír" (oír, reír, freír, sonreír): the accented í is a different Unicode
  // character than plain "i", so it needs its own branch of the suffix check.
  if (lower.length >= 3 && /(ar|er|ir|ír)$/.test(lower)) return { pos: 'verb' };
  // reflexive infinitive ("irse", "dormirse", "referirse"): the -ar/-er/-ir
  // is followed by "se", so the plain suffix check above never fires.
  if (lower.length >= 5 && /(ar|er|ir)se$/.test(lower)) return { pos: 'verb' };
  if (containsAny(MONTHS, lower)) return { pos: 'noun', gender: 'm' };
  if (containsAny(DAYS, lower)) return { pos: 'noun', gender: 'm' };
  if (looksLikeConjugatedVerb(lower)) return { pos: 'verb' };

  // 5. Last resort before the default: the English gloss of a bare,
  //    subject-dropped conjugated verb reads as a first-person clause
  //    ("I clean the flat", "I download") even when the Spanish form itself
  //    (e.g. "limpio", "descargo") is indistinguishable in shape from a noun
  //    or adjective. Found via the manual sample (id 9748 "limpio" = "I clean
  //    the flat" vs id 1426 "limpio" = "clean", same surface form).
  if (/^I\s/.test(String(entry.en ?? ''))) return { pos: 'verb' };

  // 6. Fallback. A bare single word that matched none of the above is, in
  //    this corpus, overwhelmingly an adjective (colors, qualities, past
  //    participles used adjectivally), true bare nouns are rare because the
  //    corpus authors article every noun headword (see the article-count
  //    stats in the F-1 commit notes). ~90% heuristic per GAMES.md K6.
  return { pos: 'adj' };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const VALID_POS = new Set(['noun', 'verb', 'adj', 'adv', 'pron', 'prep', 'num', 'phrase']);
const VALID_GENDER = new Set(['m', 'f', 'mf', '-']);

const totals = { pos: {}, gender: {} };

for (const path of FILES) {
  const raw = readFileSync(path, 'utf8');
  const trailingNewline = raw.endsWith('\n');
  const entries = JSON.parse(raw);

  for (const entry of entries) {
    const { pos, gender } = classify(entry);
    if (!VALID_POS.has(pos)) throw new Error(`${path} id ${entry.id}: invalid pos "${pos}"`);
    if (gender && !VALID_GENDER.has(gender)) throw new Error(`${path} id ${entry.id}: invalid gender "${gender}"`);

    entry.pos = pos;
    if (pos === 'noun') {
      entry.gender = gender ?? '-';
    } else {
      delete entry.gender;
    }

    totals.pos[pos] = (totals.pos[pos] ?? 0) + 1;
    if (entry.gender) totals.gender[entry.gender] = (totals.gender[entry.gender] ?? 0) + 1;
  }

  if (WRITE) {
    writeFileSync(path, JSON.stringify(entries, null, 2) + (trailingNewline ? '\n' : ''));
  }
}

console.log(`${WRITE ? 'WROTE' : 'DRY RUN'}, ${FILES.length} files, c2.json excluded (frozen)\n`);
console.log('pos:', totals.pos);
console.log('gender (nouns only):', totals.gender);
if (!WRITE) console.log('\n(dry run, nothing written, add --write to persist)');
