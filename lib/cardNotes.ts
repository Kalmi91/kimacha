// FB75/FB78/FB79: the "i" note on a card. Learners kept asking why the two
// sides of a card disagree ("trousers" vs "el pantalón", "unos vaqueros",
// "las cortinas"). Hybrid model, per Kálmán's decision (2026-07-30):
//   1. a hand-written note on the word entry (note_hu/en/es/de) always wins;
//   2. otherwise a rule fires, but ONLY for cases backed by an actual grammar
//      rule and matched from an explicit list, so no card gets a made-up note.
//
// Grammar source for the pair-noun rule: RAE, "nombres de objetos constituidos
// por dos partes simétricas pueden designar en plural un solo objeto
// (gafa(s), tijera(s), pantalón(es))", Nueva gramática § 3.8r-t / § 2.5.
// English counterparts (trousers, jeans, glasses, scissors) are plural-only
// nouns, counted with "a pair of".

export interface NoteWord {
  es?: string;
  en?: string;
  hu?: string;
  de?: string;
  note_es?: string;
  note_en?: string;
  note_hu?: string;
  note_de?: string;
  [key: string]: unknown;
}

export type CardNote =
  | { kind: 'manual'; text: string }
  // one garment/tool, singular OR plural in Spanish, always plural in English
  | { kind: 'pairNoun' }
  // "unos/unas" in the sentence: the plural indefinite, "some"
  | { kind: 'someIndef' };

// Spanish nouns of the RAE "two symmetric parts" class (lemma, no article).
const ES_PAIR_NOUNS = [
  'pantalón', 'pantalones', 'vaquero', 'vaqueros', 'gafa', 'gafas',
  'tijera', 'tijeras', 'braga', 'bragas', 'alicate', 'alicates',
  'tenaza', 'tenazas', 'leotardo', 'leotardos', 'short', 'shorts',
  'calzoncillo', 'calzoncillos',
];

// English plural-only ("pair of") nouns for the same objects.
const EN_PAIR_NOUNS = [
  'trousers', 'jeans', 'glasses', 'scissors', 'shorts', 'pants',
  'pyjamas', 'pajamas', 'tights', 'underpants', 'briefs', 'pliers',
];

const strip = (value: string): string =>
  value
    .toLowerCase()
    .replace(/^(el|la|los|las|un|una|unos|unas|the|a|an)\s+/, '')
    .trim();

export function cardNote(word: NoteWord, uiLang: string, targetLang: string, sentence?: string): CardNote | null {
  // 1. hand-written note wins, in the learner's own UI language
  const manual = word[`note_${uiLang}`] ?? word.note_en;
  if (typeof manual === 'string' && manual.trim().length > 0) {
    return { kind: 'manual', text: manual.trim() };
  }

  if (targetLang !== 'es') return null;

  const es = strip(String(word.es ?? ''));
  const en = strip(String(word.en ?? ''));
  if (ES_PAIR_NOUNS.includes(es) || EN_PAIR_NOUNS.includes(en)) {
    return { kind: 'pairNoun' };
  }

  if (sentence && /(^|\s)(unos|unas)\s/i.test(sentence)) {
    return { kind: 'someIndef' };
  }

  return null;
}
