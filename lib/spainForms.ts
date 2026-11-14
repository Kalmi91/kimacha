import spainForms from '@/data/words-open/spain-forms.json';
import { pcicAlternatives } from './pcicMatch';
import { conjugate, TENSES } from './games/conjugate';
import { esPlural } from './esInflect';
import { encliticBases, subjuntivoImperfecto, vosotrosPresente } from './esForms';

function normalize(text: string): string {
  return text.normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ');
}

function withoutArticle(text: string): string {
  return normalize(text).replace(/^(el|la|los|las|un|una|unos|unas)\s+/, '');
}

const listed = new Set(spainForms.map(({ form }) => form));

/** Match accepted alternatives individually, never substrings or translations. */
export function spainFormsInAnswer(answer: string): string[] {
  return Array.from(new Set(pcicAlternatives(answer).map(withoutArticle).filter(form => listed.has(form))));
}

export function isSpainForm(answer: string): boolean {
  return spainFormsInAnswer(answer).length > 0;
}

const surfaceForms = spainForms.map(({ form }) => {
  const forms = new Set([form]);
  if (/(ar|er|ir)(se)?$/.test(form)) {
    const infinitive = form.replace(/se$/, '');
    forms.add(infinitive);
    for (const tense of TENSES) {
      for (const entry of conjugate(infinitive, tense) ?? []) forms.add(entry.form);
    }
    const pastPlural = conjugate(infinitive, 'indefinido')?.find(entry => entry.person === 'ellos')?.form;
    for (const surface of [...subjuntivoImperfecto(pastPlural ?? ''), ...vosotrosPresente(infinitive)]) forms.add(surface);
    // The listed verb is regular; compound tenses and the gerund are also surface forms.
    if (infinitive.endsWith('ar')) {
      const stem = infinitive.slice(0, -2);
      for (const ending of ['ando', 'ado', 'ada', 'ados', 'adas']) forms.add(`${stem}${ending}`);
    }
  } else {
    const plural = esPlural(form);
    if (plural) forms.add(plural);
  }
  return { form, forms };
});

/** Lemmas cover inflection; surface forms also cover missing or stale corpus annotations. */
export function spainFormsInSentence(sentence: string, sentenceLemmas?: readonly string[]): string[] {
  if (!sentence.trim()) return [];
  const tokens = normalize(sentence).match(/[a-záéíóúüñ]+/g) ?? [];
  const words = new Set(tokens.flatMap(token => [token, ...encliticBases(token).flatMap(base =>
    [base, base.normalize('NFD').replace(/[\u0300-\u036f]/g, '')]
  )]));
  const lemmas = new Set((sentenceLemmas ?? []).map(normalize));
  return surfaceForms.filter(({ form, forms }) =>
    lemmas.has(form) || lemmas.has(form.replace(/se$/, '')) || [...forms].some(surface => words.has(surface))
  ).map(({ form }) => form);
}

// PcicItem does not retain sentence_lemmas. Recover them by the words-open ID without changing
// the corpus or its adapter, and only when the displayed sentence is the annotated sentence.
// Built on the first call, so importing this module (the learn card does) never walks the word lists.
type OpenSentence = { order: number; sentence_es: string; sentence_lemmas: string[] };
let openSentences: Map<string, OpenSentence> | null = null;
function openSentenceById(id: string): OpenSentence | undefined {
  if (!openSentences) {
    const files: OpenSentence[][] = [
      require('@/data/words-open/a1.json'),
      require('@/data/words-open/a2.json'),
      require('@/data/words-open/b1.json'),
      require('@/data/words-open/b2.json'),
      require('@/data/words-open/c1.json'),
    ];
    openSentences = new Map(files.flat().map((card) => [`o${card.order}`, card] as const));
  }
  return openSentences.get(id);
}

export function spainFormsInCardSentence(item: { id: string; exampleEs?: string }, sentence = item.exampleEs ?? ''): string[] {
  const card = openSentenceById(item.id);
  return spainFormsInSentence(sentence, card?.sentence_es === sentence ? card.sentence_lemmas : undefined);
}
