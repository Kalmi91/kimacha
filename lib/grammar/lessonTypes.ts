// The lesson schema, with a block-based body and the two new task
// kinds (match, form). The structure is data, not made up from prose; every
// lesson looks like this (`GrammarTopicData = LessonV2`, lib/games/content.ts).
//
// `Level` and the gap/mark item types come from content.ts (where the old
// types keep their "body"), so there is no second place where the shape
// of a gap item is defined.

import type { Level } from '@/data/words';
import type { GrammarGapItem, GrammarMarkItem } from '../games/content';

export type Lang4 = Record<'hu' | 'en' | 'es' | 'de', string>;

// The tenses of the tense drill (8 + the 4 added later). The order here is the
// source of TENSE_IDS, do not swap it.
export type TenseId =
  | 'presente'
  | 'indefinido'
  | 'imperfecto'
  | 'perfecto'
  | 'futuro-simple'
  | 'ir-a'
  | 'condicional'
  | 'subjuntivo-presente'
  | 'imperativo-negativo'
  | 'pluscuamperfecto'
  | 'subjuntivo-perfecto'
  | 'futuro-condicional-perfecto';

export const TENSE_IDS: readonly TenseId[] = [
  'presente',
  'indefinido',
  'imperfecto',
  'perfecto',
  'futuro-simple',
  'ir-a',
  'condicional',
  'subjuntivo-presente',
  'imperativo-negativo',
  'pluscuamperfecto',
  'subjuntivo-perfecto',
  'futuro-condicional-perfecto',
];

// The tense name shown on the badge; `es` is the Spanish grammatical term, the others
// are the everyday name (as in the syllabus topic titles).
export const TENSE_NAMES: Record<TenseId, Lang4> = {
  presente: { hu: 'jelen idő', en: 'present tense', es: 'Presente', de: 'Präsens' },
  indefinido: { hu: 'befejezett múlt', en: 'preterite', es: 'Pretérito perfecto simple', de: 'Indefinido' },
  imperfecto: { hu: 'folyamatos múlt', en: 'imperfect', es: 'Pretérito imperfecto', de: 'Imperfekt' },
  perfecto: { hu: 'közelmúlt', en: 'present perfect', es: 'Pretérito perfecto compuesto', de: 'Perfekt' },
  'futuro-simple': { hu: 'egyszerű jövő', en: 'simple future', es: 'Futuro simple', de: 'einfaches Futur' },
  'ir-a': { hu: '„ir a" jövő', en: '"ir a" future', es: 'Ir a + infinitivo', de: '„ir a"-Zukunft' },
  condicional: { hu: 'feltételes mód', en: 'conditional', es: 'Condicional simple', de: 'Konditional' },
  'subjuntivo-presente': {
    hu: 'kötőmód jelen',
    en: 'present subjunctive',
    es: 'Presente de subjuntivo',
    de: 'Subjuntivo Präsens',
  },
  'imperativo-negativo': { hu: 'tiltó felszólító mód', en: 'negative imperative', es: 'Imperativo negativo', de: 'Verneinter Imperativ' },
  pluscuamperfecto: { hu: 'régmúlt', en: 'past perfect', es: 'Pretérito pluscuamperfecto', de: 'Plusquamperfekt' },
  'subjuntivo-perfecto': {
    hu: 'kötőmód befejezett',
    en: 'present perfect subjunctive',
    es: 'Pretérito perfecto de subjuntivo',
    de: 'Subjuntivo Perfekt',
  },
  'futuro-condicional-perfecto': {
    hu: 'befejezett jövő és feltételes',
    en: 'future perfect and conditional perfect',
    es: 'Futuro perfecto y condicional perfecto',
    de: 'Futur II und Konditional II',
  },
};

// A Spanish sentence + translation; `es` is the sentence itself (or a paraphrase of it when
// the block point is not itself a sentence but the description of a phenomenon).
// Field convention for an English target language (es->en direction): `ExamplePair.es` and
// `WhyItem.es` hold the sentence in the LEARNED language (English), `tr` holds the translations
// (tr.en === the sentence itself); `MatchItem.pairs` {es, en} stays literal (es = Spanish,
// en = English), the renderer picks the learned-language side by learnedLang.
export interface ExamplePair {
  es: string;
  tr: Lang4;
}

export type LessonBlock =
  | { kind: 'text'; text: Lang4 }
  | { kind: 'list'; title?: Lang4; items: { text: Lang4; examples: ExamplePair[] }[] }
  | {
      kind: 'table';
      id: string;
      title: Lang4;
      header: Lang4[];
      rows: string[][];
      // english prompt per cell (rows x verb-columns, same shape as
      // `rows` minus the person column), for the table-deck's "translate the
      // English sentence" mode; a table without it keeps the person·verb prompt.
      enPrompt?: string[][];
    }
  | { kind: 'usage'; title?: Lang4; points: { text: Lang4; examples: ExamplePair[] }[] }
  | {
      kind: 'contrast';
      title?: Lang4;
      pairs: { a: string; b: string; note: Lang4; examples: ExamplePair[] }[];
      confusables?: string;
    }
  | { kind: 'tip'; text: Lang4 };

// Matching, English <-> Spanish.
export interface MatchItem {
  kind: 'match';
  id: string;
  pairs: { es: string; en: string }[]; // 5-6 pairs
}

// Conjugation drill; the `table` field refers to the id of one of the body's `table`
// blocks (the possible forms come from there).
export interface FormItem {
  kind: 'form';
  id: string;
  verb: string;
  person: string;
  answer: string;
  // further accepted forms (where two forms are correct: hablara / hablase).
  accept?: string[];
  table: string; // id of one of the body's `table` blocks
  tense?: { from: TenseId; to: TenseId };
}

// "Why this sentence": the
// learner does not pick the missing word but WHICH RULE makes the
// sentence the way it is (e.g. "Soy profesor." -> "occupation / identity").
export interface WhyItem {
  kind: 'why';
  id: string;
  es: string; // the sentence in Spanish, e.g. "Soy profesor."
  // the exact part of the sentence the question is about (e.g. "perro",
  // can be several words: "está cansado"); it must appear in the
  // `es` field at a word boundary, see lib/grammar/whyTarget.ts.
  target?: string;
  tr: Lang4; // translation of the sentence; tr.es === es, uniform for the read-aloud
  options: { text: Lang4; wrong?: Lang4 }[]; // 3 rule names; `wrong` is mandatory on the incorrect options
  correctIndex: number;
  tense?: { from: TenseId; to: TenseId };
}

// the item kind of the tense drill, sentence rewriting from one tense into
// another. The `wordIds` refer to the sentence's cards; this drives
// the unlock.
export interface TransformItem {
  kind: 'transform';
  id: string;
  tense: { from: TenseId; to: TenseId };
  prompt: Lang4;
  answer: string;
  accept?: string[];
  wordIds: string[];
  why: Lang4;
}

// three new task kinds, FOR NOW only in two
// lessons, marked `trial: true` so the developer can try them out and approve them; trial items
// do not count toward the lesson % and are left out of the lesson test.

/** Error finder: the sentence contains one typical mistake; the learner taps the wrong word, then picks the right fix from 3 options. */
export interface SpotItem {
  kind: 'spot';
  id: string;
  trial?: boolean;
  /** The faulty sentence, split by spaces into tappable words (punctuation is part of the word). */
  es: string;
  /** Index of the faulty word in the sentence (0-based). */
  wrongIndex: number;
  /** 3 correction options; the empty text means deleting the word. */
  options: string[];
  correctIndex: number;
  /** Short explanation in four languages. */
  explain: Lang4;
  /** Translation of the CORRECT sentence. */
  tr: Lang4;
}

/** Word order: the sentence in the interface language on top, the shuffled Spanish word tiles below; tapping puts them in order. */
export interface OrderItem {
  kind: 'order';
  id: string;
  trial?: boolean;
  /** The sentence in the interface language. */
  prompt: Lang4;
  /** The correct Spanish sentence (the tiles are made from its words). */
  es: string;
}

/** Dictation: the sentence is played (replayable, also slower), the learner types it in. */
export interface DictationItem {
  kind: 'dictation';
  id: string;
  trial?: boolean;
  es: string;
  /** Translation of the sentence, shown after the answer. */
  tr: Lang4;
}

export interface LessonV2 {
  schema: 2;
  topic: string;
  level: Level;
  title: Lang4;
  body: LessonBlock[];
  speak: Lang4; // text written for the read-aloud, the Spanish stretches between «...»
  glossary?: { word: string; gloss: Lang4 }[];
  items: (GrammarGapItem | GrammarMarkItem | MatchItem | FormItem | WhyItem | TransformItem | SpotItem | OrderItem | DictationItem)[];
  focusTopic?: string; // word topic whose cards belong to the lesson's word set alongside the transform words
  noWordDeck?: boolean; // this lesson has no "Practice the words" deck (switches off the automatic word deck)
}
