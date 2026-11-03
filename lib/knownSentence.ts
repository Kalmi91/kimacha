// the "learned words only" gate. A sentence can become a
// sentence card only if EVERY one of its words is known: a learned word (the target-language
// form of an item answered correctly at least once in the deck), its plural/gender
// form, a learned verb conjugated in an unlocked tense, or a free word (article,
// preposition, conjunction). A pure module: no database, no corpus import.

import { CORPUS_NAMES } from '@/lib/corpusNames';
import { deTokenize, germanEntryForms } from '@/lib/deEntryForms';
import { deCompoundNumber, type DeLevel } from '@/lib/deForms';
import { enDegreeForms, enForms, enPlurals } from '@/lib/enForms';
import { gerundForms } from '@/lib/esGerunds';
import { esFeminine, esPlural, esSuperlativeForms } from '@/lib/esInflect';
import { irregularForms, type IrregularTense } from '@/lib/esIrregularForms';
import { occupationFeminine } from '@/lib/esOccupations';
import { participleForms } from '@/lib/esParticiples';
import { HU_CLOSED_CLASS, huRecognises, huStemKeys } from '@/lib/huForms';
import { conjugate, TENSES, type Tense } from '@/lib/games/conjugate';
import { deStructuresAbove } from '@/lib/grammar/deTenseGate';
import { detectStructures, tokenize, type Structure } from '@/lib/grammar/tenseGate';
import { capitalizedWords } from '@/lib/properNames';
import type { Sm2Card } from '@/lib/sm2';

export type KnownLang = 'es' | 'en' | 'hu' | 'de';

/** The unlockable tenses: the six tenses of `conjugate` + the subjunctive imperfecto. */
export type ResolvedTense = Tense | 'subjuntivo_imperfecto';

export interface LearnedEntry {
  /** The target-language form of the item as it stands in the deck ("el libro", "yo hablo", "to be"). */
  text: string;
  /** The item's part of speech, if known (the gender form only affects adjectives, the conjugation only verbs). */
  pos?: string;
}

interface KnownContext {
  learned: Iterable<string | LearnedEntry>;
  /** Spanish only: the tenses unlocked by the grammar lessons. */
  tenses?: ReadonlySet<ResolvedTense>;
  /** German only: the level whose grammar the learner has reached (no German grammar lesson unlocks tenses). Default A1. */
  level?: DeLevel;
}

// Closed word classes (2026-11-02): determiners, pronouns, prepositions, conjunctions, modal verbs and
// the degree words take no new members and carry no content of their own, so a sentence is not blocked by
// them. Each class is listed with ALL its forms (gender, number, case). A content word never goes here
// (noun, verb, adjective, -mente/-ly adverb: those are learned one by one), and neither does a word the
// app leaves out on purpose (Spanish vosotros, see lib/grammar/vosotros.ts).
const ES_CLOSED_CLASS = [
  // demonstratives
  'este', 'esta', 'estos', 'estas', 'esto', 'ese', 'esa', 'esos', 'esas', 'eso',
  'aquel', 'aquella', 'aquellos', 'aquellas', 'aquello',
  // possessives, before the noun and after it
  'mi', 'mis', 'tu', 'tus', 'su', 'sus', 'nuestro', 'nuestra', 'nuestros', 'nuestras',
  'mío', 'mía', 'míos', 'mías', 'tuyo', 'tuya', 'tuyos', 'tuyas', 'suyo', 'suya', 'suyos', 'suyas',
  // indefinite and quantifying determiners (algún / ningún are the short forms of alguno / ninguno)
  'mucho', 'mucha', 'muchos', 'muchas', 'muchísimo', 'muchísima', 'muchísimos', 'muchísimas', 'poco', 'poca', 'pocos', 'pocas',
  'demasiado', 'demasiada', 'demasiados', 'demasiadas', 'bastante', 'bastantes',
  'todo', 'toda', 'todos', 'todas', 'otro', 'otra', 'otros', 'otras', 'varios', 'varias', 'cada',
  'alguno', 'alguna', 'algunos', 'algunas', 'algún', 'ninguno', 'ninguna', 'ningunos', 'ningunas', 'ningún',
  // personal and object pronouns
  'yo', 'tú', 'él', 'ella', 'nosotros', 'nosotras', 'ellos', 'ellas', 'usted', 'ustedes',
  'me', 'te', 'se', 'nos', 'lo', 'le', 'les', 'mí', 'ti', 'conmigo', 'contigo',
  // conjunctions, prepositions, degree words
  'pero', 'si', 'porque', 'cuando', 'como', 'e', 'u', 'ni', 'aunque', 'mientras',
  'sin', 'sobre', 'entre', 'hasta', 'desde', 'hacia', 'según', 'contra', 'durante',
  'muy', 'más', 'menos', 'tan',
];
const EN_CLOSED_CLASS = [
  // personal, object and possessive pronouns
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs',
  'myself', 'yourself', 'himself', 'herself', 'itself', 'ourselves', 'yourselves', 'themselves',
  // determiners
  'this', 'that', 'these', 'those', 'some', 'any', 'no', 'every', 'each', 'all', 'both',
  'many', 'much', 'few', 'other', 'another',
  // prepositions
  'at', 'by', 'for', 'from', 'with', 'without', 'about', 'after', 'before', 'between', 'into',
  'over', 'under', 'through', 'during', 'until', 'up', 'down', 'out', 'off', 'against',
  // conjunctions, modal verbs, degree words
  'but', 'if', 'because', 'so', 'when', 'while', 'than', 'as', 'although', 'though',
  'will', 'would', 'can', 'could', 'shall', 'should', 'may', 'might', 'must',
  'not', 'very', 'too', 'also',
  // question words and the two place words
  'what', 'who', 'whom', 'whose', 'which', 'where', 'why', 'how', 'there', 'here', 'yes',
];

// German closed classes (2026-11-02): articles, personal / possessive / demonstrative / indefinite / interrogative
// pronouns and determiners, prepositions with their contractions, the da- / wo- compounds, conjunctions and the degree words
// sehr / mehr / weniger / so. All case, gender and number forms are listed; a content word (noun, verb, adjective,
// adverb) never goes here: those are learned one by one (lib/deForms.ts derives their forms).
function withEndings(stems: string[], endings: string[]): string[] {
  return stems.flatMap((stem) => endings.map((end) => `${stem}${end}`));
}
const DE_CLOSED_CLASS: string[] = [
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'eines',
  // personal and reflexive pronouns, indefinite pronouns
  'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mich', 'dich', 'ihn', 'uns', 'euch', 'mir', 'dir', 'ihm', 'ihnen', 'sich',
  'man', 'selbst', 'etwas', 'nichts', 'jemand', 'niemand', 'jemanden', 'niemanden', 'jemandem', 'niemandem',
  // possessives, kein, demonstratives, quantifiers (every gender, case and number)
  ...withEndings(['mein', 'dein', 'sein', 'ihr', 'unser', 'euer', 'kein'], ['', 'e', 'en', 'em', 'er', 'es']),
  'eure', 'euren', 'eurem', 'eurer', 'eures',
  ...withEndings(['dies', 'jed', 'welch', 'manch', 'solch', 'jen', 'all', 'ander', 'einig', 'beid'], ['er', 'e', 'es', 'en', 'em']),
  'dies', 'alles', 'viel', 'viele', 'vielen', 'vieler', 'vielem', 'wenig', 'wenige', 'wenigen', 'weniger', 'mehrere', 'mehreren', 'mehrerer',
  'andere', 'beide', 'beiden',
  // question words
  'wer', 'wen', 'wem', 'wessen', 'was', 'wo', 'wohin', 'woher', 'wann', 'wie', 'warum', 'wieso', 'weshalb', 'wozu',
  // prepositions and their contractions
  'ab', 'an', 'auf', 'aus', 'außer', 'bei', 'bis', 'durch', 'entlang', 'für', 'gegen', 'gegenüber', 'hinter', 'in', 'innerhalb',
  'außerhalb', 'mit', 'nach', 'neben', 'ohne', 'seit', 'statt', 'anstatt', 'trotz', 'über', 'um', 'unter', 'von', 'vor', 'während',
  'wegen', 'zu', 'zwischen', 'gemäß', 'laut', 'per', 'pro',
  'im', 'am', 'zum', 'zur', 'vom', 'beim', 'ins', 'ans', 'aufs', 'ums', 'fürs', 'durchs', 'übers', 'vors', 'hinters', 'vorm', 'hinterm',
  'überm', 'unterm', 'übern', 'untern',
  // da- / wo- compounds
  ...withEndings(['da', 'wo'], ['ran', 'rauf', 'raus', 'rin', 'rüber', 'rum', 'runter', 'von', 'vor', 'zu', 'gegen', 'durch', 'mit', 'für', 'bei', 'nach', 'zwischen', 'hinter', 'neben']),
  'hierbei', 'hierfür', 'hiermit', 'hierzu', 'deshalb', 'deswegen',
  // conjunctions and the negation
  'und', 'oder', 'aber', 'denn', 'sondern', 'dass', 'ob', 'weil', 'wenn', 'als', 'obwohl', 'bevor', 'nachdem', 'damit', 'sobald',
  'falls', 'solange', 'sodass', 'indem', 'sowie', 'sowohl', 'weder', 'entweder', 'nicht',
  // degree words
  'sehr', 'mehr', 'so', 'plus', 'minus',
  // possessive pronouns on their own
  'meins', 'deins', 'seins', 'ihrs', 'unsers', 'eures',
];

// Free words: contain no verb, the learner does not have to learn them separately.
const FREE_WORDS: Record<KnownLang, ReadonlySet<string>> = {
  es: new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
    'de', 'del', 'al', 'a', 'en', 'y', 'o', 'que', 'no', 'con', 'por', 'para',
    ...ES_CLOSED_CLASS,
  ]),
  en: new Set(['the', 'a', 'an', 'of', 'to', 'in', 'on', 'and', 'or', ...EN_CLOSED_CLASS]),
  hu: new Set(['a', 'az', 'egy', 'és', 'is', 'de', 'vagy', 'hogy', 'nem', 'meg', 'el', 'ki', 'be', ...HU_CLOSED_CLASS]),
  de: new Set(DE_CLOSED_CLASS),
};

// What tenseGate recognises but the unlocked tenses (ResolvedTense) do not cover:
// compound tenses and the imperative. Such a structure must not land on a sentence card.
const UNMODELED_STRUCTURES: ReadonlySet<Structure> = new Set<Structure>([
  'perfecto',
  'pluscuamperfecto',
  'futuro_perfecto',
  'condicional_perfecto',
  'imperativo',
]);

// `ir` is the one infinitive without a letter before the ending.
const ES_INFINITIVE = /^(?:[a-záéíóúñü]+(?:ar|er|ir|ír)|ir)$/;

// The verbs `conjugate` refuses on purpose (it only teaches forms it is sure of) are recognised by
// `lib/esIrregularForms.ts`, tense by tense, so the same unlock gate applies to them.
const IRREGULAR_TENSES: IrregularTense[] = [...TENSES, 'subjuntivo_imperfecto'];
// An infinitive takes the object pronouns (quedarme, verlo): not a conjugated form, so no tense gate.
const CLITICS = ['me', 'te', 'se', 'nos', 'lo', 'la', 'los', 'las', 'le', 'les'];
const ACCENT_ADD: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };
// The short form an adjective takes before a noun (un buen día, el primer día); alguno / ninguno are free words.
const ES_APOCOPE = new Map([['bueno', 'buen'], ['malo', 'mal'], ['grande', 'gran'], ['primero', 'primer'], ['tercero', 'tercer']]);

/**
 * Whether a card is "learned": it has been answered correctly at least once (it reached the
 * review state, or already had a lapse, i.e. fell back from review), or
 * the learner marked it as known by hand.
 */
export function isLearnedCard(card: Sm2Card): boolean {
  return card.known === true || card.state === 'review' || card.lapses > 0;
}

/**
 * The unlocked tenses, from the completion of the grammar lessons (the keys of `doneGrammarTopicProgress`).
 * presente ← presente-regular/presente-irregular,
 * indefinido ← indefinido-*, imperfecto ← imperfecto,
 * futuro ← futuro-simple, condicional ← condicional-simple,
 * subjunctive presente ← subjuntivo-presente-forma, subjunctive imperfecto ← subjuntivo-imperfecto.
 */
export function resolvedTensesFromLessons(doneTopicIds: Iterable<string>): Set<ResolvedTense> {
  const done = new Set(doneTopicIds);
  const out = new Set<ResolvedTense>();
  if (done.has('presente-regular') || done.has('presente-irregular')) out.add('presente');
  if ([...done].some((id) => id.startsWith('indefinido-'))) out.add('indefinido');
  if (done.has('imperfecto')) out.add('imperfecto');
  if (done.has('futuro-simple')) out.add('futuro');
  if (done.has('condicional-simple')) out.add('condicional');
  if (done.has('subjuntivo-presente-forma')) out.add('subjuntivo_presente');
  if (done.has('subjuntivo-imperfecto')) out.add('subjuntivo_imperfecto');
  return out;
}

function entryOf(raw: string | LearnedEntry): LearnedEntry {
  return typeof raw === 'string' ? { text: raw } : raw;
}

function esEntryTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[¿?¡!.,;:()"«»/]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function enEntryTokens(text: string): string[] {
  return enTokenize(text.toLowerCase().replace(/^to\s+/, ''));
}

function enTokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

// Hungarian: the letters with an accent or a double acute (á é í ó ö ő ú ü ű) and the ñ of piñata are part of a
// word, so a token keeps them. The suffixed forms of a learned word are recognised by lib/huForms.ts (stem keys in the set).
function huTokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9áéíóöőúüűñ\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// Subjunctive imperfecto: from the stem of the 3rd person plural indefinido (-ra instead of -ron…).
function subjuntivoImperfecto(infinitive: string): string[] | null {
  const ellos = conjugate(infinitive, 'indefinido')?.[4]?.form;
  if (!ellos || !ellos.endsWith('ron')) return null;
  const base = ellos.slice(0, -3);
  const accented = base.replace(/[aeiou]$/, (v) => ACCENT_ADD[v]);
  return [`${base}ra`, `${base}ras`, `${base}ra`, `${accented}ramos`, `${base}ran`];
}

// The infinitives a dictionary entry stands for: every alternative of "volver / regresar", and a
// reflexive one ("acostarse") by its base verb (me acuesto, se baña).
function esInfinitives(text: string): string[] {
  const out: string[] = [];
  for (const alt of text.split(' / ')) {
    const trimmed = alt.trim();
    const reflexive = trimmed.match(/^(.+r)se$/);
    const inf = reflexive ? reflexive[1] : trimmed;
    if (ES_INFINITIVE.test(inf)) out.push(inf);
  }
  return out;
}

function addSpanish(known: Set<string>, entry: LearnedEntry, tenses: ReadonlySet<ResolvedTense>) {
  const text = entry.text.trim().toLowerCase();
  const isVerb = entry.pos === undefined || entry.pos === 'verb';
  for (const token of esEntryTokens(text)) {
    known.add(token);
    if (entry.pos !== 'verb') {
      const plural = esPlural(token);
      if (plural) known.add(plural);
    }
    if (entry.pos === 'adj') {
      const fem = esFeminine(token);
      if (fem) {
        known.add(fem);
        const femPlural = esPlural(fem);
        if (femPlural) known.add(femPlural);
      }
      const short = ES_APOCOPE.get(token);
      if (short) known.add(short);
      for (const form of esSuperlativeForms(token)) known.add(form);
    }
    if (entry.pos === 'noun') {
      const fem = occupationFeminine(token);
      if (fem) {
        known.add(fem);
        const femPlural = esPlural(fem);
        if (femPlural) known.add(femPlural);
      }
    }
  }
  if (!isVerb) return;
  for (const inf of esInfinitives(text)) {
    // The participle stands as an adjective (cerrada), in no tense; the compound tense (he cerrado) stays blocked by the structure gate.
    for (const form of participleForms(inf)) known.add(form);
    // The gerundio stands in no tense either (estar + gerundio is not a structure of the tense gate); the -ir stem change comes from the indefinido.
    const ellos = irregularForms(inf, 'indefinido')[4] ?? conjugate(inf, 'indefinido')?.[4]?.form;
    for (const form of gerundForms(inf, ellos)) known.add(form);
    for (const tense of TENSES) {
      if (!tenses.has(tense)) continue;
      for (const f of conjugate(inf, tense) ?? []) known.add(f.form);
    }
    for (const tense of IRREGULAR_TENSES) {
      if (!tenses.has(tense)) continue;
      for (const form of irregularForms(inf, tense)) known.add(form);
    }
    if (tenses.has('subjuntivo_imperfecto')) {
      for (const form of subjuntivoImperfecto(inf) ?? []) known.add(form);
    }
    for (const clitic of CLITICS) known.add(`${inf}${clitic}`);
  }
}

// Closed word classes never inflect: an "ending" on them is only a wrong word (the -ing of "the" is "thing").
const EN_NO_INFLECTION: ReadonlySet<string> = new Set(['pron', 'det', 'prep', 'conj']);

// The word that takes the endings, from one alternative of an item ("a / b" lists several): a one-word item,
// or the verb of "to X ..." ("to walk (a dog)", "to take part"). The words of any other phrase
// ("good morning") do not get an -ing/-ed form.
function enInflectedWord(alternative: string): string | null {
  const text = alternative.trim().toLowerCase();
  if (/^to\s/.test(text)) {
    return enTokenize(text.replace(/^to\s+/, '').replace(/\([^)]*\)/g, ' '))[0] ?? null;
  }
  const tokens = enTokenize(text);
  return tokens.length === 1 ? tokens[0] : null;
}

// The plural of the noun a card stands for: the noun of "an apple" / "a machine" (the article does not stop the
// plural), and the head of a noun phrase ("bus stop" → stops, "phone number" → numbers: its last word). Only a card
// that is a noun for sure (pos noun, or an article in front and no pos); a phrase with a preposition or a conjunction
// ("cup of tea") or a hyphen ("father-in-law") has its head elsewhere, so it gives nothing.
const EN_NOT_NOUN_PHRASE: ReadonlySet<string> = new Set([
  'of', 'in', 'on', 'at', 'to', 'for', 'from', 'with', 'by', 'and', 'or', 'a', 'an', 'the',
]);

function enNounPlurals(alternative: string, pos?: string): string[] {
  const text = alternative.trim().toLowerCase().replace(/\([^)]*\)/g, ' ');
  if (text.includes('-')) return [];
  const article = /^(?:a|an|the)\s/.test(text);
  if (pos !== 'noun' && !(article && pos === undefined)) return [];
  const words = enTokenize(text.replace(/^(?:a|an|the)\s+/, ''));
  if (!words.length || words.some((w) => EN_NOT_NOUN_PHRASE.has(w))) return [];
  const head = words[words.length - 1];
  return /[^su]s$/.test(head) ? [] : enPlurals(head); // already a plural (birds, books): no "birdses"
}

// The base verb inside a phrase card: after a modal ("you cannot smoke", "I can swim"), after "do not" / "don't",
// and after the infinitive "to" of going / have / need / want / nice ("I am going to travel", "nice to meet you"). It
// is a verb for sure, so its -s / -ed / -ing forms count. Not the "to" of a place ("go to school"), and not a pronoun
// or an article after the modal ("can you help").
const EN_MODAL: ReadonlySet<string> = new Set([
  'can', 'cannot', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must',
  "can't", "couldn't", "won't", "wouldn't", "shan't", "shouldn't", "mustn't", "don't", "doesn't", "didn't",
]);
const EN_DO: ReadonlySet<string> = new Set(['do', 'does', 'did']);
const EN_TO_BEFORE_VERB: ReadonlySet<string> = new Set(['going', 'have', 'has', 'had', 'need', 'needs', 'nice', 'want', 'wants', 'how']);

function enPhraseVerbs(alternative: string, pos?: string): string[] {
  if (pos !== undefined && pos !== 'phrase' && pos !== 'verb') return [];
  const words = enTokenize(alternative.trim().toLowerCase().replace(/\([^)]*\)/g, ' '));
  const verbs: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    const word = words[i];
    const before = words[i - 1];
    const trigger =
      EN_MODAL.has(word) ||
      (word === 'not' && before !== undefined && (EN_MODAL.has(before) || EN_DO.has(before))) ||
      (word === 'to' && before !== undefined && EN_TO_BEFORE_VERB.has(before));
    if (trigger && !FREE_WORDS.en.has(words[i + 1])) verbs.push(words[i + 1]);
  }
  return verbs;
}

function addEnglish(known: Set<string>, entry: LearnedEntry) {
  const text = entry.text.trim();
  const tokens = enEntryTokens(text);
  for (const token of tokens) known.add(token);
  // The old blind endings stay, so that nothing known before becomes unknown: the B2 story "rehearsal" is
  // written with "band", which only the blind "ban" + d gives (the deck has no "band" item).
  if (tokens.length === 1) {
    for (const suffix of ['s', 'es', 'ed', 'ing', 'd']) known.add(`${tokens[0]}${suffix}`);
  }
  if (entry.pos && EN_NO_INFLECTION.has(entry.pos)) return;
  for (const alternative of text.split('/')) {
    const word = enInflectedWord(alternative);
    if (word) for (const form of enForms(word)) known.add(form);
    if (word && entry.pos === 'adj') for (const form of enDegreeForms(word)) known.add(form);
    for (const form of enNounPlurals(alternative, entry.pos)) known.add(form);
    for (const verb of enPhraseVerbs(alternative, entry.pos)) {
      for (const form of enForms(verb)) known.add(form);
    }
  }
}

function addHungarian(known: Set<string>, entry: LearnedEntry) {
  for (const token of huTokenize(entry.text)) known.add(token);
  for (const key of huStemKeys(entry.text, entry.pos)) known.add(key);
}

function addGerman(known: Set<string>, entry: LearnedEntry, level: DeLevel) {
  for (const token of deTokenize(entry.text.trim())) known.add(token);
  const { plain, split } = germanEntryForms(entry, level);
  for (const form of plain) known.add(form);
  // a finite form that stands apart from its detached prefix: only together with that prefix in the sentence
  for (const { form, prefix } of split) {
    known.add(`${form}>${prefix}`);
    known.add(prefix);
  }
}

/** All accepted (lowercase) tokens from the learned words. */
export function knownTokens(lang: KnownLang, ctx: KnownContext): Set<string> {
  const known = new Set<string>(FREE_WORDS[lang]);
  const tenses = ctx.tenses ?? new Set<ResolvedTense>();
  const level = ctx.level ?? 'A1';
  for (const raw of ctx.learned) {
    const entry = entryOf(raw);
    if (lang === 'es') addSpanish(known, entry, tenses);
    else if (lang === 'hu') addHungarian(known, entry);
    else if (lang === 'de') addGerman(known, entry, level);
    else addEnglish(known, entry);
  }
  return known;
}

/** The (lowercase) tokens of a sentence, the way the gate reads it. */
export function sentenceTokens(sentence: string, lang: KnownLang): string[] {
  if (lang === 'hu') return huTokenize(sentence);
  if (lang === 'de') return deTokenize(sentence);
  return lang === 'es' ? tokenize(sentence) : enTokenize(sentence);
}

// An English contraction is its stem + a clitic ("it's" = it + 's, "don't" = do + n't): known when the stem is
// (the clitics are one closed class). can't / won't / shan't do not strip cleanly, so they name their stem.
const EN_CLITIC = /^(.+?)(?:'s|'ll|'re|'ve|'d|'m|n't)$/;
const EN_NT_STEM = new Map([["can't", 'can'], ["won't", 'will'], ["shan't", 'shall']]);

function enStem(token: string): string | undefined {
  return EN_NT_STEM.get(token) ?? EN_CLITIC.exec(token)?.[1];
}

// Proper names (2026-11-02): a capitalised word INSIDE a sentence is a name (Tom, Spain, Budapesten) and counts as
// known without being learned. At the start of a sentence every word is capitalised, so there a word is a name only
// when the corpus writes it with a capital inside a sentence somewhere else and never in lowercase (lib/corpusNames.ts,
// generated by scripts/gen-corpus-names.mjs); any other capitalised first word must be known as before.
const listedNameTokens: Partial<Record<KnownLang, ReadonlySet<string>>> = {};
function listedNames(lang: KnownLang): ReadonlySet<string> {
  return (listedNameTokens[lang] ??= new Set(CORPUS_NAMES[lang].flatMap((name) => sentenceTokens(name, lang))));
}

/** The (lowercase) tokens of a sentence that are proper names. */
function nameTokens(sentence: string, lang: KnownLang): Set<string> {
  const names = new Set<string>();
  const listed = listedNames(lang);
  // German capitalises every noun: a capital says nothing about a name. Only the listed names (the words the German and the
  // English sentence of a card write the same, scripts/gen-corpus-names.mjs) are free, at the start of a sentence as well.
  if (lang === 'de') {
    for (const { word } of capitalizedWords(sentence)) for (const token of sentenceTokens(word, lang)) if (listed.has(token)) names.add(token);
    return names;
  }
  for (const { word, initial } of capitalizedWords(sentence)) {
    for (const token of sentenceTokens(word, lang)) {
      const stem = lang === 'en' ? enStem(token) : undefined;
      if (!initial || listed.has(token) || (stem !== undefined && listed.has(stem))) names.add(token);
    }
  }
  return names;
}

function isKnownToken(token: string, lang: KnownLang, known: ReadonlySet<string>, names: ReadonlySet<string>, prefixes: ReadonlySet<string> = NO_PREFIXES): boolean {
  if (known.has(token) || names.has(token)) return true;
  if (lang === 'hu') return huRecognises(token, known);
  if (lang === 'de') {
    // a number, or a finite form of a separable verb together with its detached prefix ("stehe ... auf")
    if (/^\d+$/.test(token) || [...prefixes].some((prefix) => prefix !== token && known.has(`${token}>${prefix}`))) return true;
    const number = deCompoundNumber(token);
    return number !== null && (number[0] === 'ein' || known.has(number[0])) && known.has(number[1]);
  }
  if (lang !== 'en') return false;
  const stem = enStem(token);
  return stem !== undefined && (known.has(stem) || names.has(stem));
}

const NO_PREFIXES: ReadonlySet<string> = new Set();
// What may close a German clause besides its end: a detached prefix stands last ("Ich stehe auf und gehe...", "Ich fange an zu arbeiten").
const DE_CLAUSE_JOINERS: ReadonlySet<string> = new Set(['und', 'oder', 'aber', 'denn', 'sondern', 'zu']);

/**
 * The words of a German sentence that can be a detached verb prefix: the ones that close a clause (before a comma, a full stop, the
 * end, or a joining word). "steht auf dem Tisch" has none ("auf" is followed by "dem"), "Ich stehe um sieben Uhr auf." has "auf".
 */
export function detachedPrefixes(sentence: string): Set<string> {
  const out = new Set<string>();
  const chunks = sentence.split(/\s+/).filter(Boolean);
  chunks.forEach((chunk, i) => {
    const word = deTokenize(chunk).pop();
    if (!word) return;
    const next = chunks[i + 1] ? deTokenize(chunks[i + 1])[0] : undefined;
    if (/[,;:.!?]["”»)]*$/.test(chunk) || i === chunks.length - 1 || (next !== undefined && DE_CLAUSE_JOINERS.has(next))) out.add(word);
  });
  return out;
}

/** The keys under which the owners of a sentence token are stored: the token itself, and (German) each "form>prefix" pair it can make. */
export function ownerKeys(token: string, lang: KnownLang, prefixes: ReadonlySet<string>): string[] {
  return lang === 'de' ? [token, ...[...prefixes].filter((p) => p !== token).map((p) => `${token}>${p}`)] : [token];
}

/** The tokens of the sentence that the gate does not accept. Empty = every word is known. */
export function unknownTokens(sentence: string, lang: KnownLang, ctx: KnownContext): string[] {
  return unknownTokensIn(sentence, lang, knownTokens(lang, ctx));
}

/** The same over an already built `knownTokens` set. */
export function unknownTokensIn(sentence: string, lang: KnownLang, known: ReadonlySet<string>): string[] {
  const names = nameTokens(sentence, lang);
  const prefixes = lang === 'de' ? detachedPrefixes(sentence) : NO_PREFIXES;
  return sentenceTokens(sentence, lang).filter((token) => !isKnownToken(token, lang, known, names, prefixes));
}

/**
 * The same gate over an already built `knownTokens` set (many sentences against one learned
 * vocabulary: the Sentences tab checks the whole corpus without rebuilding the set each time).
 */
export function isSentenceKnownIn(sentence: string, lang: KnownLang, known: ReadonlySet<string>, level: DeLevel = 'A1'): boolean {
  if (!sentence.trim()) return false;
  if (lang === 'es') {
    for (const structure of detectStructures(sentence)) {
      if (UNMODELED_STRUCTURES.has(structure)) return false;
    }
  }
  const names = nameTokens(sentence, lang);
  const prefixes = lang === 'de' ? detachedPrefixes(sentence) : NO_PREFIXES;
  if (!sentenceTokens(sentence, lang).every((token) => isKnownToken(token, lang, known, names, prefixes))) return false;
  // German has no grammar lesson that unlocks a tense: the learner's level decides (never a tense above it)
  return lang !== 'de' || deStructuresAbove(sentence, level).length === 0;
}

/**
 * Only a sentence whose every word is learned or free may land on a sentence card,
 * and (for Spanish) which does not use a structure the grammar has not yet taught:
 * a compound tense or an imperative. German: no tense or structure above `ctx.level`.
 */
export function isSentenceKnown(sentence: string, lang: KnownLang, ctx: KnownContext): boolean {
  return isSentenceKnownIn(sentence, lang, knownTokens(lang, ctx), ctx.level ?? 'A1');
}

