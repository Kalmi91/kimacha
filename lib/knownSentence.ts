// the "learned words only" gate. A sentence can become a
// sentence card only if EVERY one of its words is known: a learned word (the target-language
// form of an item answered correctly at least once in the deck), its plural/gender
// form, a learned verb conjugated in an unlocked tense, or a free word (article,
// preposition, conjunction). A pure module: no database, no corpus import.

import { esFeminine, esPlural } from '@/lib/esInflect';
import { conjugate, TENSES, type Tense } from '@/lib/games/conjugate';
import { detectStructures, tokenize, type Structure } from '@/lib/grammar/tenseGate';
import type { Sm2Card } from '@/lib/sm2';

type KnownLang = 'es' | 'en';

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
}

// Free words: contain no verb, the learner does not have to learn them separately.
const FREE_WORDS: Record<KnownLang, ReadonlySet<string>> = {
  es: new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
    'de', 'del', 'al', 'a', 'en', 'y', 'o', 'que', 'no', 'con', 'por', 'para',
  ]),
  en: new Set(['the', 'a', 'an', 'of', 'to', 'in', 'on', 'and', 'or']),
};

// The forms of English be/have/do/go, if the base verb is learned.
const EN_IRREGULAR_FORMS: Record<string, string[]> = {
  be: ['am', 'is', 'are', 'was', 'were', 'been', 'being'],
  have: ['has', 'had', 'having'],
  do: ['does', 'did', 'done', 'doing'],
  go: ['goes', 'went', 'gone', 'going'],
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

const ES_INFINITIVE = /^[a-záéíóúñü]+(ar|er|ir)$/;
const ACCENT_ADD: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };

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

// Subjunctive imperfecto: from the stem of the 3rd person plural indefinido (-ra instead of -ron…).
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
  // The conjugation endings only apply to a one-word item (or "to X"); the words of a
  // phrase ("good morning") do not get an -ing/-ed form.
  if (tokens.length !== 1) return;
  const [base] = tokens;
  for (const suffix of ['s', 'es', 'ed', 'ing', 'd']) known.add(`${base}${suffix}`);
  for (const form of EN_IRREGULAR_FORMS[base] ?? []) known.add(form);
}

/** All accepted (lowercase) tokens from the learned words. */
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

/** The tokens of the sentence that the gate does not accept. Empty = every word is known. */
export function unknownTokens(sentence: string, lang: KnownLang, ctx: KnownContext): string[] {
  const known = knownTokens(lang, ctx);
  const tokens = lang === 'es' ? tokenize(sentence) : enTokenize(sentence);
  return tokens.filter((token) => !known.has(token));
}

/**
 * Only a sentence whose every word is learned or free may land on a sentence card,
 * and (for Spanish) which does not use a structure the grammar has not yet taught:
 * a compound tense or an imperative.
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
