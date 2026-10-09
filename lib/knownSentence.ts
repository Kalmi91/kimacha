// a „csak tanult szó" kapu. Egy mondat akkor lehet
// mondatkártya, ha MINDEN szava ismert: tanult szó (a pakliban legalább
// egyszer helyesen megválaszolt tétel célnyelvi alakja), annak többes/nemi
// alakja, feloldott igeidőben ragozott tanult ige, vagy szabad szó (névelő,
// elöljáró, kötőszó). Tiszta modul: nincs adatbázis, nincs korpusz-import.

import { esFeminine, esPlural } from '@/lib/esInflect';
import { conjugate, TENSES, type Tense } from '@/lib/games/conjugate';
import { detectStructures, tokenize, type Structure } from '@/lib/grammar/tenseGate';
import type { Sm2Card } from '@/lib/sm2';

type KnownLang = 'es' | 'en';

/** A feloldható igeidők: a `conjugate` hat igeideje + a kötőmód imperfecto. */
export type ResolvedTense = Tense | 'subjuntivo_imperfecto';

export interface LearnedEntry {
  /** A tétel célnyelvi alakja úgy, ahogy a pakliban áll („el libro", „yo hablo", „to be"). */
  text: string;
  /** A tétel szófaja, ha ismert (a nemi alak csak melléknévre, a ragozás csak igére hat). */
  pos?: string;
}

interface KnownContext {
  learned: Iterable<string | LearnedEntry>;
  /** Csak spanyolnál: a nyelvtani leckékkel feloldott igeidők. */
  tenses?: ReadonlySet<ResolvedTense>;
}

// Szabad szavak: igét nem tartalmaz, a tanulónak nem kell külön megtanulnia.
const FREE_WORDS: Record<KnownLang, ReadonlySet<string>> = {
  es: new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
    'de', 'del', 'al', 'a', 'en', 'y', 'o', 'que', 'no', 'con', 'por', 'para',
  ]),
  en: new Set(['the', 'a', 'an', 'of', 'to', 'in', 'on', 'and', 'or']),
};

// Az angol be/have/do/go alakjai, ha az alapige tanult.
const EN_IRREGULAR_FORMS: Record<string, string[]> = {
  be: ['am', 'is', 'are', 'was', 'were', 'been', 'being'],
  have: ['has', 'had', 'having'],
  do: ['does', 'did', 'done', 'doing'],
  go: ['goes', 'went', 'gone', 'going'],
};

// Amit a tenseGate felismer, de a feloldott igeidők (ResolvedTense) nem fedik:
// összetett igeidők és felszólítás. Ilyen szerkezet nem kerülhet mondatkártyára.
const UNMODELED_STRUCTURES: ReadonlySet<Structure> = new Set<Structure>([
  'perfecto',
  'pluscuamperfecto',
  'futuro_perfecto',
  'condicional_perfecto',
  'imperativo',
]);

const ES_INFINITIVE = /^[a-záéíóúñü]+(ar|er|ir)$/;
const ACCENT_ADD: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };

/**
 * Egy kártya „tanult"-e: legalább egyszer helyesen megválaszolták (review
 * állapotba került, vagy volt már lapse-a, vagyis review-ból esett vissza), vagy
 * a tanuló kézzel tudottnak jelölte.
 */
export function isLearnedCard(card: Sm2Card): boolean {
  return card.known === true || card.state === 'review' || card.lapses > 0;
}

/**
 * A nyelvtani leckék teljesítéséből (`doneGrammarTopicProgress` kulcsai) a
 * feloldott igeidők. presente ← presente-regular/presente-irregular,
 * indefinido ← indefinido-*, imperfecto ← imperfecto,
 * futuro ← futuro-simple, condicional ← condicional-simple,
 * kötőmód presente ← subjuntivo-presente-forma, kötőmód imperfecto ← subjuntivo-imperfecto.
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

// Kötőmód imperfecto: a 3. személy többes indefinido tövéből (-ron helyett -ra…).
function subjuntivoImperfecto(infinitive: string): string[] | null {
  const ellos = conjugate(infinitive, 'indefinido')?.[4]?.form;
  if (!ellos || !ellos.endsWith('ron')) return null;
  const base = ellos.slice(0, -3);
  const accented = base.replace(/[aeiou]$/, (v) => ACCENT_ADD[v]);
  return [`${base}ra`, `${base}ras`, `${base}ra`, `${accented}ramos`, `${base}ran`];
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
    }
  }
  if (isVerb && ES_INFINITIVE.test(text)) {
    for (const tense of TENSES) {
      if (!tenses.has(tense)) continue;
      for (const f of conjugate(text, tense) ?? []) known.add(f.form);
    }
    if (tenses.has('subjuntivo_imperfecto')) {
      for (const form of subjuntivoImperfecto(text) ?? []) known.add(form);
    }
  }
}

function addEnglish(known: Set<string>, entry: LearnedEntry) {
  const tokens = enEntryTokens(entry.text.trim());
  for (const token of tokens) known.add(token);
  // A ragozó végződések csak egyszavas tételre (vagy „to X"-re) hatnak; egy
  // kifejezés („good morning") szavai nem kapnak -ing/-ed alakot.
  if (tokens.length !== 1) return;
  const [base] = tokens;
  for (const suffix of ['s', 'es', 'ed', 'ing', 'd']) known.add(`${base}${suffix}`);
  for (const form of EN_IRREGULAR_FORMS[base] ?? []) known.add(form);
}

/** A tanult szavakból az összes elfogadott (kisbetűs) token. */
export function knownTokens(lang: KnownLang, ctx: KnownContext): Set<string> {
  const known = new Set<string>(FREE_WORDS[lang]);
  const tenses = ctx.tenses ?? new Set<ResolvedTense>();
  for (const raw of ctx.learned) {
    const entry = entryOf(raw);
    if (lang === 'es') addSpanish(known, entry, tenses);
    else addEnglish(known, entry);
  }
  return known;
}

/** A mondat tokenjei, amiket a kapu nem fogad el. Üres = minden szó ismert. */
export function unknownTokens(sentence: string, lang: KnownLang, ctx: KnownContext): string[] {
  const known = knownTokens(lang, ctx);
  const tokens = lang === 'es' ? tokenize(sentence) : enTokenize(sentence);
  return tokens.filter((token) => !known.has(token));
}

/**
 * Mondatkártyára csak olyan mondat kerülhet, aminek minden szava tanult vagy
 * szabad, és (spanyolnál) nem használ olyan szerkezetet, amit a nyelvtan még nem
 * tanított: összetett igeidőt vagy felszólítást.
 */
export function isSentenceKnown(sentence: string, lang: KnownLang, ctx: KnownContext): boolean {
  if (!sentence.trim()) return false;
  if (lang === 'es') {
    for (const structure of detectStructures(sentence)) {
      if (UNMODELED_STRUCTURES.has(structure)) return false;
    }
  }
  return unknownTokens(sentence, lang, ctx).length === 0;
}
