// The recognisable German word forms of one learned dictionary form, for the "learned words only" gate
// (`lib/knownSentence.ts`) and the tense gate (`lib/grammar/tenseGate.ts`). A pure module. It is for
// RECOGNITION, not teaching: a form that is wrong but does not exist as a German word is harmless, a form
// that is another word is not, so nothing is guessed that would spell another word. What it derives:
//   (a) verbs: infinitive, present (stem changes e>i/ie, a>ä, au>äu, e-insertion), imperative, preterite,
//       participle II (ge-, no ge- after be-/ver-/er-.../-ieren, ge- inside a separable verb), subjunctive I and II;
//       separable verbs come as a split finite form + its prefix, and as the joined form of a subordinate clause;
//   (b) nouns: the plural and the dative plural from the data table (data/de/plurals.json), the genitive (B1);
//   (c) adjectives: the endings -e -en -er -es -em, the comparative and the superlative (A2).
// Levels: the forms of a tense are returned only once the level teaches it (see `deTenseLevel`).

import {
  A1_PERFECT_VERBS,
  INSEPARABLE_PREFIXES,
  INSEPARABLE_VERBS,
  IRREGULAR_DEGREES,
  MODAL_VERBS,
  NOT_PREFIXED,
  SEIN_PERFECT_VERBS,
  SEPARABLE_PREFIXES,
  SPECIAL_VERBS,
  STRONG_VERBS,
  UMLAUT_ADJECTIVES,
} from '@/lib/deIrregularForms';

export type DeLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
const RANK: Record<DeLevel, number> = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4 };

export function deLevelRank(level: DeLevel): number {
  return RANK[level];
}

/** The lower of two levels. */
export function minDeLevel(a: DeLevel, b: DeLevel): DeLevel {
  return RANK[a] <= RANK[b] ? a : b;
}

/** Whether `level` has reached `needed`. */
export function atLeast(level: DeLevel, needed: DeLevel): boolean {
  return RANK[level] >= RANK[needed];
}

/** Whether a deck level string ("A1" ... "C1") is a German level. */
export function asDeLevel(level: string | undefined): DeLevel | undefined {
  return level !== undefined && level in RANK ? (level as DeLevel) : undefined;
}

export type DeTense = 'inf' | 'praes' | 'imp' | 'prat' | 'k2' | 'k1' | 'part';

export interface DeVerbForm {
  form: string;
  tense: DeTense;
  /** The separable prefix that stands apart from this finite form ("steht ... auf"); absent = a complete word. */
  prefix?: string;
}

export interface DeVerb {
  infinitive: string;
  /** The verb without its prefix ("stehen" for "aufstehen"). */
  base: string;
  /** The separable prefix ("auf"), '' = none. */
  separable: string;
  modal: boolean;
  /** haben, sein, werden and the modals: the verbs whose preterite is taught at A2. */
  basic: boolean;
  aux: 'haben' | 'sein' | 'both';
  forms: DeVerbForm[];
}

const VOWEL = /[aeiouäöüy]/;
const SUBJECT_PRONOUNS: ReadonlySet<string> = new Set(['ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'man']);

export function stemOf(infinitive: string): string {
  return /e[lr]n$/.test(infinitive) ? infinitive.slice(0, -1) : infinitive.slice(0, -2);
}

// Stems that take -e- before -st / -t / -te (arbeitest, atmet, öffnete).
export function needsE(stem: string): boolean {
  return /[dt]$/.test(stem) || /(?:[bcdfgkpt]|ch|ck|ff)[mn]$/.test(stem);
}

// Stems on s ß x z take -t instead of -st in the du form (du heißt, du tanzt), but not -sch (du wäschst).
export function sibilant(stem: string): boolean {
  return /[sßxz]$/.test(stem) && !/sch$/.test(stem);
}

export function umlautLast(stem: string): string {
  const at = Math.max(stem.lastIndexOf('a'), stem.lastIndexOf('o'), stem.lastIndexOf('u'));
  if (at < 0) return stem;
  if (stem[at] === 'u' && stem[at - 1] === 'a') return `${stem.slice(0, at - 1)}äu${stem.slice(at + 1)}`;
  return `${stem.slice(0, at)}${{ a: 'ä', o: 'ö', u: 'ü' }[stem[at] as 'a' | 'o' | 'u']}${stem.slice(at + 1)}`;
}

interface Paradigm {
  forms: DeVerbForm[];
  /** Participles as the plain verb has them (with ge- where the plain verb has it). */
  participles: string[];
  aux: 'haben' | 'sein' | 'both';
  modal: boolean;
  basic: boolean;
  /** The verb takes no ge- in the participle (-ieren). */
  noGe: boolean;
}

function add(forms: DeVerbForm[], list: string[], tense: DeTense): void {
  for (const form of list) if (form) forms.push({ form, tense });
}

function regularParadigm(infinitive: string): Paradigm {
  const stem = stemOf(infinitive);
  const e = needsE(stem);
  const forms: DeVerbForm[] = [{ form: infinitive, tense: 'inf' }];
  const ich = [`${stem}e`];
  if (infinitive.endsWith('eln')) ich.push(`${stem.slice(0, -2)}le`);
  if (infinitive.endsWith('ern')) ich.push(`${stem.slice(0, -2)}re`);
  const du = sibilant(stem) ? `${stem}t` : `${stem}${e ? 'est' : 'st'}`;
  const er = `${stem}${e ? 'et' : 't'}`;
  add(forms, [...ich, du, er, infinitive], 'praes');
  const root = `${stem}${e ? 'ete' : 'te'}`;
  add(forms, [root, `${root}st`, `${root}n`, `${root}t`], 'prat');
  add(forms, [`${stem}e`, `${stem}est`, `${stem}en`, `${stem}et`], 'k1');
  // imperative: du (stem, stem + e), ihr, Sie
  add(forms, [e ? `${stem}e` : stem, `${stem}e`], 'imp');
  const ieren = /ieren$/.test(infinitive);
  const participle = ieren ? `${stem}t` : `ge${stem}${e ? 'et' : 't'}`;
  return { forms, participles: [participle], aux: 'haben', modal: false, basic: false, noGe: ieren };
}

function strongParadigm(infinitive: string, strong: NonNullable<ReturnType<typeof STRONG_VERBS.get>>): Paradigm {
  const stem = stemOf(infinitive);
  const e = needsE(stem);
  const forms: DeVerbForm[] = [{ form: infinitive, tense: 'inf' }];
  const stem2 = strong.stem2;
  const duStem = stem2 || stem;
  const du = sibilant(duStem) ? `${duStem}t` : stem2 ? `${duStem}st` : `${duStem}${e ? 'est' : 'st'}`;
  const er = stem2 ? (stem2.endsWith('t') ? stem2 : `${stem2}t`) : `${stem}${e ? 'et' : 't'}`;
  add(forms, [`${stem}e`, du, er, infinitive, `${stem}${e ? 'et' : 't'}`], 'praes');
  // imperative: the e>i / e>ie stem keeps its change (gib, nimm, sieh), a>ä does not (fahr)
  const imperative = stem2 && /i/.test(stem2) && /e/.test(stem) ? stem2 : stem;
  add(forms, [imperative, stem, `${stem}e`, `${stem}${e ? 'et' : 't'}`], 'imp');
  for (const prat of strong.prat) {
    if (prat.endsWith('te')) {
      add(forms, [prat, `${prat}st`, `${prat}n`, `${prat}t`], 'prat');
      const k2 = umlautLast(prat);
      add(forms, [k2, `${k2}st`, `${k2}n`, `${k2}t`], 'k2');
    } else {
      const wide = /(?:[sßzdt]|sch)$/.test(prat);
      add(forms, [prat, `${prat}${wide ? 'est' : 'st'}`, `${prat}st`, `${prat}en`, `${prat}${wide ? 'et' : 't'}`, `${prat}t`], 'prat');
      const k2 = `${umlautLast(prat)}e`;
      add(forms, [k2, `${k2.slice(0, -1)}est`, `${k2}n`, `${k2.slice(0, -1)}et`], 'k2');
    }
  }
  if (infinitive === 'stehen') add(forms, ['stünde', 'stündest', 'stünden', 'stündet'], 'k2');
  add(forms, [`${stem}e`, `${stem}est`, `${stem}en`, `${stem}et`], 'k1');
  return { forms, participles: strong.part, aux: strong.aux, modal: false, basic: false, noGe: false };
}

function specialParadigm(infinitive: string): Paradigm {
  const sp = SPECIAL_VERBS.get(infinitive)!;
  const forms: DeVerbForm[] = [{ form: infinitive, tense: 'inf' }];
  add(forms, sp.praes, 'praes');
  add(forms, sp.imp, 'imp');
  add(forms, sp.prat, 'prat');
  // "möchte" is taught at A1 as a form of its own, so it counts as a present form
  for (const form of sp.k2) forms.push({ form, tense: infinitive === 'mögen' && form.startsWith('möcht') ? 'praes' : 'k2' });
  add(forms, sp.k1, 'k1');
  const modal = MODAL_VERBS.has(infinitive);
  return { forms, participles: sp.part, aux: sp.aux, modal, basic: modal || ['sein', 'haben', 'werden'].includes(infinitive), noGe: false };
}

function plainParadigm(infinitive: string): Paradigm {
  if (SPECIAL_VERBS.has(infinitive)) return specialParadigm(infinitive);
  const strong = STRONG_VERBS.get(infinitive);
  return strong ? strongParadigm(infinitive, strong) : regularParadigm(infinitive);
}

export interface Split {
  kind: 'none' | 'separable' | 'inseparable';
  prefix: string;
  base: string;
}

function looksLikeVerb(rest: string): boolean {
  return rest.length >= 4 && VOWEL.test(rest) && /(?:en|ern|eln|tun)$/.test(rest);
}

export function splitPrefix(infinitive: string): Split {
  const none: Split = { kind: 'none', prefix: '', base: infinitive };
  if (SPECIAL_VERBS.has(infinitive) || STRONG_VERBS.has(infinitive) || NOT_PREFIXED.has(infinitive)) return none;
  if (infinitive === 'möchten') return none;
  if (INSEPARABLE_VERBS.has(infinitive)) {
    const prefix = ['unter', 'wieder', 'durch', 'über', 'um'].find((p) => infinitive.startsWith(p) && looksLikeVerb(infinitive.slice(p.length)));
    return prefix ? { kind: 'inseparable', prefix, base: infinitive.slice(prefix.length) } : none;
  }
  for (const prefix of SEPARABLE_PREFIXES) {
    if (!infinitive.startsWith(prefix)) continue;
    const rest = infinitive.slice(prefix.length);
    if (looksLikeVerb(rest) || (prefix === 'weh' && rest === 'tun') || (prefix === 'leid' && rest === 'tun')) return { kind: 'separable', prefix, base: rest };
  }
  for (const prefix of INSEPARABLE_PREFIXES) {
    if (!infinitive.startsWith(prefix)) continue;
    const rest = infinitive.slice(prefix.length);
    if (looksLikeVerb(rest)) return { kind: 'inseparable', prefix, base: rest };
  }
  return none;
}

/** The infinitive-looking verb of a dictionary alternative, or null: "gehen", "aufstehen", "sich freuen", "Rad fahren". */
export function deInfinitiveOf(alternative: string): string | null {
  const cleaned = alternative.replace(/\([^)]*\)/g, ' ').trim().replace(/^sich\s+/i, '');
  const words = cleaned.split(/\s+/).filter(Boolean);
  // a conjugated phrase of the deck ("ich bin gegangen", "sie arbeiten") is learned as written, it names no infinitive
  if (words.length > 1 && SUBJECT_PRONOUNS.has(words[0].toLowerCase())) return null;
  const last = words[words.length - 1]?.toLowerCase();
  if (!last || !/^[a-zäöüß]+$/.test(last)) return null;
  if (words[words.length - 1][0] !== words[words.length - 1][0].toLowerCase()) return null; // a capital = a noun ("das Essen")
  if (SPECIAL_VERBS.has(last) || STRONG_VERBS.has(last) || last === 'möchten') return last;
  return /(?:en|ern|eln)$/.test(last) && last.length >= 4 ? last : null;
}

function withoutGe(participle: string): string {
  return participle.startsWith('ge') ? participle.slice(2) : participle;
}

const verbCache = new Map<string, DeVerb>();

/** All forms of one German verb (given as its infinitive), tagged by tense. */
export function deVerb(infinitive: string): DeVerb {
  const cached = verbCache.get(infinitive);
  if (cached) return cached;
  const split = splitPrefix(infinitive);
  let result: DeVerb;
  if (infinitive === 'möchten') {
    const mogen = specialParadigm('mögen');
    result = { infinitive, base: infinitive, separable: '', modal: true, basic: true, aux: 'haben', forms: mogen.forms.filter((f) => f.form.startsWith('möcht')) };
  } else if (split.kind === 'none') {
    const p = plainParadigm(infinitive);
    const forms = [...p.forms];
    for (const participle of p.participles) forms.push({ form: participle, tense: 'part' });
    result = { infinitive, base: infinitive, separable: '', modal: p.modal, basic: p.basic, aux: p.aux, forms };
  } else {
    const inner = deVerb(split.base);
    const forms: DeVerbForm[] = [];
    const noGe = inner.forms.some((f) => f.tense === 'part' && !f.form.startsWith('ge') && /ieren$/.test(split.base));
    if (split.kind === 'inseparable') {
      for (const f of inner.forms) {
        if (f.prefix) continue;
        forms.push({ form: f.tense === 'part' ? `${split.prefix}${noGe ? f.form : withoutGe(f.form)}` : `${split.prefix}${f.form}`, tense: f.tense });
      }
      // a verb with an inseparable prefix and a separable one inside (zurückbekommen) is handled by the separable branch
    } else {
      for (const f of inner.forms) {
        if (f.tense === 'part') forms.push({ form: `${split.prefix}${f.form}`, tense: 'part' });
        else if (f.tense === 'inf') forms.push({ form: infinitive, tense: 'inf' });
        else {
          // detached from its prefix in a main clause, joined in a subordinate clause
          forms.push({ form: f.form, tense: f.tense, prefix: split.prefix });
          forms.push({ form: `${split.prefix}${f.form}`, tense: f.tense });
        }
      }
      // zu-infinitive: aufzustehen
      forms.push({ form: `${split.prefix}zu${split.base}`, tense: 'inf' });
    }
    // the perfect of a prefixed verb: sein for the listed ones, haben after an inseparable prefix, else the base verb's
    const aux = SEIN_PERFECT_VERBS.has(infinitive) ? 'sein' : split.kind === 'inseparable' ? 'haben' : inner.aux;
    result = { infinitive, base: split.base, separable: split.kind === 'separable' ? split.prefix : '', modal: inner.modal, basic: inner.basic, aux, forms };
  }
  verbCache.set(infinitive, result);
  return result;
}

/** The level that teaches a tense of this verb (the contract: lib/deForms.ts header and the grammar gate). */
export function deTenseLevel(verb: Pick<DeVerb, 'basic'>, tense: DeTense): DeLevel {
  switch (tense) {
    case 'inf':
    case 'praes':
    case 'imp':
    case 'part':
      return 'A1';
    case 'prat':
      return verb.basic ? 'A2' : 'B1';
    case 'k2':
      // würde / hätte / wäre / könnte (B1); the own subjunctive II of any other verb is literary (C1)
      return verb.basic ? 'B1' : 'C1';
    case 'k1':
      return 'B2';
  }
}

export interface DeVerbTokens {
  /** Complete words. */
  plain: string[];
  /** Finite forms that stand apart from a detached prefix: "stehe" + "auf". */
  split: Array<{ form: string; prefix: string }>;
}

/** The words a learner of this verb may meet at `level`. */
export function deVerbTokens(infinitive: string, level: DeLevel): DeVerbTokens {
  const verb = deVerb(infinitive);
  const plain = new Set<string>();
  const split: Array<{ form: string; prefix: string }> = [];
  for (const f of verb.forms) {
    if (!atLeast(level, deTenseLevel(verb, f.tense))) continue;
    if (f.prefix) split.push({ form: f.form, prefix: f.prefix });
    else plain.add(f.form);
  }
  return { plain: [...plain], split };
}

/** The sein-perfect and haben-perfect of a verb: which auxiliary a participle goes with. */
export function isCommonPerfectVerb(infinitive: string): boolean {
  return A1_PERFECT_VERBS.has(infinitive);
}

// ---------------------------------------------------------------- adjectives

const ADJ_ENDINGS = ['e', 'en', 'er', 'es', 'em'];

function adjectiveStems(adj: string): string[] {
  if (adj === 'hoch') return ['hoh'];
  if (adj.endsWith('el') && adj.length > 3) return [`${adj.slice(0, -2)}l`]; // dunkel > dunkl-
  if (/[aeiouäöü]er$/.test(adj)) return [`${adj.slice(0, -2)}r`]; // teuer > teur-
  return [adj];
}

function withEndings(stem: string): string[] {
  // stems on -e take only the consonant of the ending (müde, müden, müder)
  return stem.endsWith('e') ? ADJ_ENDINGS.map((end) => `${stem}${end.slice(1)}`).filter((f) => f !== stem) : ADJ_ENDINGS.map((end) => `${stem}${end}`);
}

/** The inflected forms of an adjective (A1), plus the comparative and the superlative from A2. */
export function deAdjectiveForms(adjective: string, level: DeLevel): string[] {
  const adj = adjective.toLowerCase();
  if (!/^[a-zäöüß]+$/.test(adj) || adj.length < 3) return [];
  const out = new Set<string>();
  for (const stem of adjectiveStems(adj)) for (const form of withEndings(stem)) out.add(form);
  if (!atLeast(level, 'A2')) return [...out];
  const irregular = IRREGULAR_DEGREES.get(adj);
  const base = UMLAUT_ADJECTIVES.has(adj) ? umlautLast(adj) : adj;
  const comparative = irregular?.[0] ?? (adj.endsWith('e') ? `${base}r` : /[aeiouäöü]er$/.test(adj) ? `${base.slice(0, -2)}rer` : adj.endsWith('el') ? `${base.slice(0, -2)}ler` : `${base}er`);
  out.add(comparative);
  for (const form of withEndings(comparative)) out.add(form);
  const superlatives = irregular ? [irregular[1]] : [`${base}st`, `${base}est`];
  for (const root of superlatives) {
    out.add(root);
    for (const form of ADJ_ENDINGS.map((end) => `${root}${end}`)) out.add(form);
  }
  return [...out];
}

// ---------------------------------------------------------------- nouns

/**
 * The forms of a noun from its plural(s) (the data table `data/de/plurals.json`, lower-case, no article):
 * the plural, the dative plural (+n) and, from B1, the genitive singular of a masculine / neuter noun.
 * No plural in the table = the singular only (nothing is guessed).
 */
export function deNounForms(noun: string, gender: 'm' | 'f' | 'n' | '', plurals: readonly string[], level: DeLevel): string[] {
  const out = new Set<string>();
  for (const plural of plurals) {
    out.add(plural);
    if (!/[ns]$/.test(plural)) out.add(`${plural}n`);
  }
  if (atLeast(level, 'B1') && (gender === 'm' || gender === 'n' || gender === '')) {
    out.add(`${noun}s`);
    out.add(`${noun}es`);
    if (/e$/.test(noun) && gender !== 'n') out.add(`${noun}ns`);
  }
  return [...out];
}

/** A nominalised adjective ("der / die Angestellte"): the adjective endings of its stem. */
export function deNominalisedForms(noun: string): string[] {
  return noun.endsWith('e') && noun.length > 3 ? ADJ_ENDINGS.map((end) => `${noun.slice(0, -1)}${end}`) : [];
}

// ---------------------------------------------------------------- numbers, times, colours

const ORDINAL_STEMS: Record<string, string> = {
  eins: 'erst', ein: 'erst', zwei: 'zweit', drei: 'dritt', sieben: 'siebt', acht: 'acht',
};

/** The ordinal of a cardinal with the adjective endings: zwei > zweite, zweiten, ...; zwanzig > zwanzigste. */
export function deOrdinalForms(cardinal: string): string[] {
  const word = cardinal.toLowerCase();
  if (!/^[a-zäöüß]+$/.test(word) || word.length < 3 && word !== 'ei') return [];
  const stem = ORDINAL_STEMS[word] ?? (/(?:zig|ßig|hundert|tausend)$/.test(word) ? `${word}st` : `${word}t`.replace(/ent$/, 'nt'));
  return withEndings(stem).concat(stem);
}

const COMPOUND_COLOURS: ReadonlySet<string> = new Set(['blau', 'grün', 'braun', 'grau', 'rot', 'gelb', 'schwarz', 'weiß', 'rosa', 'lila', 'orange']);
const COLOUR_PREFIXES: readonly string[] = ['dunkel', 'hell'];

/** "dunkelblau", "hellgrün" and their endings, from a learned colour. */
export function deColourCompounds(colour: string): string[] {
  const word = colour.toLowerCase();
  if (!COMPOUND_COLOURS.has(word)) return [];
  return COLOUR_PREFIXES.flatMap((prefix) => [`${prefix}${word}`, ...withEndings(`${prefix}${word}`)]);
}

/** Days and times of the day make the adverb on -s (sonntags, morgens, nachts). */
const TIME_NOUNS: ReadonlySet<string> = new Set([
  'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag', 'morgen', 'vormittag', 'mittag', 'nachmittag', 'abend',
  'nacht', 'wochenende',
]);

export function deTimeAdverb(noun: string): string[] {
  const word = noun.toLowerCase();
  return TIME_NOUNS.has(word) ? [`${word}s`] : [];
}

/** A cardinal like "einunddreißig": a unit, "und", a tens word. */
const NUMBER_UNITS = '(ein|zwei|drei|vier|fünf|sechs|sieben|acht|neun)';
const NUMBER_TENS = '(zwanzig|dreißig|vierzig|fünfzig|sechzig|siebzig|achtzig|neunzig)';
const COMPOUND_NUMBER = new RegExp(`^${NUMBER_UNITS}und${NUMBER_TENS}$`);

/** The two parts of a compound cardinal ("einunddreißig" > ["ein", "dreißig"]), or null. */
export function deCompoundNumber(token: string): [string, string] | null {
  const m = COMPOUND_NUMBER.exec(token);
  return m ? [m[1], m[2]] : null;
}
