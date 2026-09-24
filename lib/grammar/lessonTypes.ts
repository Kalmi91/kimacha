// LECKE-SEMA 1-2. szakasz: a lecke új sémája, blokk-alapú törzzsel (body) és a
// két új feladat-fajtával (match, form). A `rule`/`more` próza-mezőket a
// `body` tömb váltja: a szerkezet innentől adat, nem a moreBlocks.ts-féle
// prózából-találgatás. A régi (rule/more) leckék `lib/games/content.ts`-ben,
// `LegacyLesson` néven élnek tovább, amíg a többi 20 téma is át nem költözik
// erre a sémára; a két alak `GrammarTopicData = LegacyLesson | LessonV2`
// unióban fér meg egymás mellett.
//
// `Level` és a gap/mark item-típusok a content.ts-ből jönnek (ott a
// „törzs" a régi típusoknak), hogy ne legyen két hely, ahol egy gap-item
// alakja definiálva van.

import type { Level } from '@/data/words';
import type { GrammarGapItem, GrammarMarkItem } from '../games/content';

export type Lang4 = Record<'hu' | 'en' | 'es' | 'de', string>;

// NY1 (NYELVTAN.md "Adatformátum"): az igeidő-drill 8 igeideje. A sorrend
// itt a TENSE_IDS forrása, ne cseréld fel.
export type TenseId =
  | 'presente'
  | 'indefinido'
  | 'imperfecto'
  | 'perfecto'
  | 'futuro-simple'
  | 'ir-a'
  | 'condicional'
  | 'subjuntivo-presente';

export const TENSE_IDS: readonly TenseId[] = [
  'presente',
  'indefinido',
  'imperfecto',
  'perfecto',
  'futuro-simple',
  'ir-a',
  'condicional',
  'subjuntivo-presente',
];

// A jelvényen mutatott igeidő-név; `es` a spanyol nyelvtani terminus, a többi
// a hétköznapi név (mint a syllabus témacímekben).
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
};

// spanyol mondat + fordítás; `es` maga a mondat (vagy egy parafrázisa, ha a
// blokk-pont maga nem mondat, hanem egy jelenség leírása).
export interface ExamplePair {
  es: string;
  tr: Lang4;
}

export type LessonBlock =
  | { kind: 'text'; text: Lang4 }
  | { kind: 'list'; title?: Lang4; items: { text: Lang4; examples: ExamplePair[] }[] }
  | { kind: 'table'; id: string; title: Lang4; header: Lang4[]; rows: string[][] }
  | { kind: 'usage'; title?: Lang4; points: { text: Lang4; examples: ExamplePair[] }[] }
  | { kind: 'examples'; title?: Lang4; examples: ExamplePair[] }
  | {
      kind: 'contrast';
      title?: Lang4;
      pairs: { a: string; b: string; note: Lang4; examples: ExamplePair[] }[];
      confusables?: string;
    }
  | { kind: 'tip'; text: Lang4 };

// LECKE-SEMA 2.1: párosítás, angol <-> spanyol.
export interface MatchItem {
  kind: 'match';
  id: string;
  pairs: { es: string; en: string }[]; // 5-6 pár
}

// LECKE-SEMA 2.2: ragozási drill, a `table` mezővel a body egyik `table`
// blokkjának id-jára hivatkozva (onnan jönnek a lehetséges alakok).
export interface FormItem {
  kind: 'form';
  id: string;
  verb: string;
  person: string;
  answer: string;
  table: string; // a body egyik `table` blokkjának id-ja
  tense?: { from: TenseId; to: TenseId };
}

// TASK-8 (PLAN-fb0917 D4, FB288, Kálmán 2026-09-15): "miért ez a mondat", a
// tanuló nem a hiányzó szót választja, hanem azt, MELYIK SZABÁLY miatt van a
// mondat úgy, ahogy van (pl. "Soy profesor." → "foglalkozás / identitás").
export interface WhyItem {
  kind: 'why';
  id: string;
  es: string; // a mondat spanyolul, pl. "Soy profesor."
  tr: Lang4; // a mondat fordítása; tr.es === es, a felolvasás miatt egységesen
  options: { text: Lang4; wrong?: Lang4 }[]; // 3 szabály-név; a nem jó opciókon `wrong` kötelező
  correctIndex: number;
  tense?: { from: TenseId; to: TenseId };
  // FB376: melyik szóra vonatkozik a kérdés, pontosan úgy, ahogy `es`-ben áll
  // (a UI ezt emeli ki a mondatban és nevezi meg a kérdésben).
  focus?: string;
}

// NY1: az igeidő-drill item-fajtája, mondat-átírás egyik igeidőből a
// másikba (NYELVTAN.md "Adatformátum"). A `wordIds` a mondat kártyáira
// hivatkozik, ez hajtja az NY2 unlockot.
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

export interface LessonV2 {
  schema: 2;
  topic: string;
  level: Level;
  title: Lang4;
  body: LessonBlock[];
  speak: Lang4; // LECKE-SEMA 3: felolvasásra írt szöveg, a spanyol szakaszok «...» közt
  glossary?: { word: string; gloss: Lang4 }[];
  items: (GrammarGapItem | GrammarMarkItem | MatchItem | FormItem | WhyItem | TransformItem)[];
  focusTopic?: string; // FB318: szó-témakör (data/topics), aminek a kártyái a lecke szó-halmazába tartoznak a transform-szavak mellett
}
