// The word forms one German deck entry teaches: its verb forms (lib/deForms.ts), the plural and the genitive of a noun,
// the adjective endings and degrees, ordinals, colour compounds. A pure module with no corpus import, shared by the
// "learned words only" gate (lib/knownSentence.ts) and by the word lookup of the German lessons (data/deWords.ts), so
// both read an inflected word the same way.

import deNounPlurals from '@/data/de/plurals.json';
import {
  deAdjectiveForms,
  deColourCompounds,
  deInfinitiveOf,
  deNominalisedForms,
  deNounForms,
  deOrdinalForms,
  deTimeAdverb,
  deVerbTokens,
  type DeLevel,
} from '@/lib/deForms';

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
}

/** The inflected forms an entry teaches at `level` (a tense is returned only once the level teaches it). */
export function germanEntryForms(entry: GermanEntry, level: DeLevel): GermanEntryForms {
  const text = entry.text.trim();
  const plain = new Set<string>();
  const split: { form: string; prefix: string }[] = [];
  const addForm = (form: string) => {
    for (const token of deTokenize(form)) plain.add(token);
  };
  for (const raw of text.split(' / ')) {
    const alt = raw.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    if (!alt) continue;
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
        for (const form of deNounForms(noun, i === 0 ? gender : 'f', DE_PLURALS[noun] ?? [], level)) addForm(form);
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
    // rechts / links stand for the adjectives rechte / linke (die rechte Hand)
    if (alt === 'rechts' || alt === 'links') for (const form of deAdjectiveForms(alt.slice(0, -1), level)) addForm(form);
  }
  return { plain: [...plain], split };
}
