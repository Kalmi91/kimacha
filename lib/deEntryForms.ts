// The word forms one German deck entry teaches: its verb forms (lib/deForms.ts), the plural and the genitive of a noun,
// the adjective endings and degrees, ordinals, colour compounds. A pure module with no corpus import, shared by the
// "learned words only" gate (lib/knownSentence.ts) and by the word lookup of the German lessons (data/deWords.ts), so
// both read an inflected word the same way.

import deNounPlurals from '@/data/de/plurals.json';
import { compoundKeys, compoundModifierForms } from '@/lib/deCompounds';
import {
  deAdjectiveForms,
  deColourCompounds,
  deInfinitiveOf,
  deNominalisedForms,
  deNounForms,
  deOrdinalForms,
  deTimeAdverb,
  deVerb,
  deVerbTokens,
  type DeLevel,
} from '@/lib/deForms';
import { SEPARABLE_PREFIXES, SPECIAL_VERBS, STRONG_VERBS } from '@/lib/deIrregularForms';

// German: ä ö ü ß are letters, and so are the accented letters of names and loanwords (Péter, Café). A bracketed gloss of a
// headword ("die Leute (Pl.)") is not a word of the sentence.
export function deTokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9äöüßàáâãåæçèéêëìíîïñòóôõøùúûýÿœ\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// Adverbs of the deck that also stand as an adjective before a noun ("ein guter Freund"): the adjective endings count for them.
const DE_ADVERB_ADJECTIVES: ReadonlySet<string> = new Set([
  'gut', 'schlecht', 'schnell', 'langsam', 'früh', 'spät', 'laut', 'leise', 'weit', 'nah', 'fern', 'hell', 'dunkel', 'richtig',
  'falsch', 'wichtig', 'ganz', 'genau', 'oben', 'fertig', 'gesund', 'krank', 'jung', 'alt', 'neu', 'gleich', 'wenig', 'viel',
]);
const SUBJECT_PRONOUNS: ReadonlySet<string> = new Set(['ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'man']);
const DE_PLURALS = deNounPlurals as Record<string, string[]>;
const DE_ARTICLE = /^(der\/die|der|die|das)\s+(.*)$/i;

export interface GermanEntry {
  /** The headword as the deck writes it ("der Hund", "aufstehen", "gehen / fahren"). */
  text: string;
  pos?: string;
}

export interface GermanEntryForms {
  /** Lower-case tokens that are complete words (inflected forms; not the headword's own tokens). */
  plain: string[];
  /** Finite forms that stand apart from a detached prefix: "stehe" + "auf". */
  split: { form: string; prefix: string }[];
  /** Marked keys (lib/deCompounds.ts) of the nouns this entry teaches: the parts a compound noun may be made of. */
  compound: string[];
}

// Present-tense form > the verbs (infinitives) that have it, over the irregular verbs of the deck's tables.
let finiteIndex: Map<string, string[]> | undefined;
function irregularLemmasOf(finite: string): string[] {
  if (!finiteIndex) {
    finiteIndex = new Map();
    for (const lemma of new Set([...STRONG_VERBS.keys(), ...SPECIAL_VERBS.keys(), 'möchten'])) {
      for (const f of deVerb(lemma).forms) {
        if (f.tense !== 'praes' || f.prefix) continue;
        finiteIndex.set(f.form, [...(finiteIndex.get(f.form) ?? []), lemma]);
      }
    }
  }
  return finiteIndex.get(finite) ?? [];
}

// The infinitive a regular present form points to: arbeitest > arbeiten, wandere > wandern, lächle > lächeln, studiere > studieren.
function regularCandidates(finite: string): string[] {
  const out = new Set<string>();
  for (const suffix of ['est', 'et', 'st', 't', 'en', 'n', 'e', '']) {
    if (!finite.endsWith(suffix)) continue;
    const stem = finite.slice(0, finite.length - suffix.length);
    if (stem.length < 2 || stem.endsWith('e')) continue;
    if (/(?:[^aeiouäöüylh]|ch)l$/.test(stem)) out.add(`${stem.slice(0, -1)}eln`);
    else if (!/[^e]ier$/.test(stem) && (/er$/.test(stem) || /[^aeiouäöüy]el$/.test(stem))) out.add(`${stem}n`);
    else out.add(`${stem}en`);
  }
  return [...out];
}

/**
 * The verb a phrase card with a subject pronoun teaches ("ich habe" > haben, "man darf" > dürfen, "ich stehe auf" > aufstehen),
 * or null. Read only from the FIRST finite verb after the pronoun, and only when that verb really has that present form
 * (so "ich habe gegessen" teaches haben, the participle stays the word it is).
 */
export function dePhraseVerb(phrase: string): string | null {
  const words = deTokenize(phrase);
  if (words.length < 2 || !SUBJECT_PRONOUNS.has(words[0])) return null;
  const finite = words[1];
  const last = words[words.length - 1];
  const prefix = words.length > 2 && SEPARABLE_PREFIXES.includes(last) ? last : '';
  for (const lemma of [...irregularLemmasOf(finite), ...regularCandidates(finite)]) {
    for (const candidate of prefix ? [`${prefix}${lemma}`] : [lemma]) {
      if (deVerb(candidate).forms.some((f) => f.tense === 'praes' && f.form === finite && (f.prefix ?? '') === prefix)) return candidate;
    }
  }
  return null;
}

/** The inflected forms an entry teaches at `level` (a tense is returned only once the level teaches it). */
export function germanEntryForms(entry: GermanEntry, level: DeLevel): GermanEntryForms {
  const text = entry.text.trim();
  const plain = new Set<string>();
  const split: { form: string; prefix: string }[] = [];
  const heads = new Set<string>();
  const modifiers = new Set<string>();
  const addForm = (form: string) => {
    for (const token of deTokenize(form)) plain.add(token);
  };
  for (const raw of text.split(' / ')) {
    const alt = raw.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    if (!alt) continue;
    const phraseVerb = entry.pos === 'verb' || entry.pos === 'phrase' || entry.pos === undefined ? dePhraseVerb(alt) : null;
    // an adjective card that also names the verb ("stehend / stehen") teaches that irregular verb
    const adjectiveVerb = entry.pos === 'adj' && !alt.includes(' ') && (STRONG_VERBS.has(alt) || SPECIAL_VERBS.has(alt)) ? alt : null;
    if (phraseVerb || adjectiveVerb) {
      const verb = deVerbTokens(phraseVerb ?? adjectiveVerb ?? '', level);
      for (const form of verb.plain) addForm(form);
      split.push(...verb.split);
    }
    if (entry.pos === 'verb' || (entry.pos === undefined && !alt.includes(' '))) {
      const infinitive = deInfinitiveOf(alt);
      if (infinitive) {
        const verb = deVerbTokens(infinitive, level);
        for (const form of verb.plain) addForm(form);
        // a participle before a noun takes the adjective endings (das gekochte Ei)
        for (const form of verb.plain) if (/^ge\w+(?:t|en)$/.test(form)) for (const adj of deAdjectiveForms(form, 'A1')) addForm(adj);
        // a finite form that stands apart from its detached prefix: only together with that prefix in the sentence
        split.push(...verb.split);
      }
    } else if (entry.pos === 'noun') {
      const m = DE_ARTICLE.exec(alt);
      const article = m ? m[1].toLowerCase() : '';
      const gender = article === 'der' ? 'm' : article === 'die' ? 'f' : article === 'das' ? 'n' : '';
      const nouns = (m ? m[2] : alt).split(/\s+/).filter((w) => /^[A-ZÄÖÜ]/.test(w));
      nouns.forEach((word, i) => {
        const noun = word.toLowerCase();
        // only the head noun (the first) takes the genitive -s; the others of a phrase ("der Name meiner Mutter") are in the plural table
        const forms = deNounForms(noun, i === 0 ? gender : 'f', DE_PLURALS[noun] ?? [], level);
        for (const form of forms) addForm(form);
        if (i === 0) {
          for (const form of [noun, ...forms]) heads.add(form);
          for (const form of compoundModifierForms(noun, DE_PLURALS[noun] ?? [])) modifiers.add(form);
        }
      });
      for (const word of nouns.slice(0, 1)) for (const adverb of deTimeAdverb(word)) addForm(adverb);
      if (article === 'der/die' && nouns.length === 1) for (const form of deNominalisedForms(nouns[0].toLowerCase())) addForm(form);
    } else if (entry.pos === 'adj' || ((entry.pos === 'adv' || entry.pos === 'det') && DE_ADVERB_ADJECTIVES.has(alt.toLowerCase()))) {
      if (!alt.includes(' ')) {
        for (const form of deAdjectiveForms(alt, level)) addForm(form);
        for (const form of deColourCompounds(alt)) addForm(form);
      }
    } else if (entry.pos === 'num') {
      if (!alt.includes(' ')) for (const form of deOrdinalForms(alt)) addForm(form);
    }
    // an adverb card that also names a noun ("morgen / der Morgen"): the noun is a part of compounds (Montagmorgen)
    if (entry.pos === 'adv') {
      const named = DE_ARTICLE.exec(alt);
      const word = named ? named[2].split(/\s+/)[0] : '';
      if (/^[A-ZÄÖÜ]/.test(word)) {
        const noun = word.toLowerCase();
        for (const form of [noun, ...deNounForms(noun, named?.[1] === 'der' ? 'm' : '', DE_PLURALS[noun] ?? [], level)]) heads.add(form);
        for (const form of compoundModifierForms(noun, DE_PLURALS[noun] ?? [])) modifiers.add(form);
      }
    }
    // the time of day of an adverb card ("morgen / der Morgen") or a phrase card ("heute Nachmittag") makes the adverb on -s
    if (entry.pos === 'adv' || entry.pos === 'phrase') {
      for (const word of alt.split(/\s+/).filter((w) => /^[A-ZÄÖÜ]/.test(w))) for (const adverb of deTimeAdverb(word)) addForm(adverb);
    }
    // rechts / links stand for the adjectives rechte / linke (die rechte Hand)
    if (alt === 'rechts' || alt === 'links') for (const form of deAdjectiveForms(alt.slice(0, -1), level)) addForm(form);
  }
  return { plain: [...plain], split, compound: compoundKeys([...heads], [...modifiers]) };
}
