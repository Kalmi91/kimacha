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
}

export interface LessonV2 {
  schema: 2;
  topic: string;
  level: Level;
  title: Lang4;
  body: LessonBlock[];
  speak: Lang4; // LECKE-SEMA 3: felolvasásra írt szöveg, a spanyol szakaszok «...» közt
  glossary?: { word: string; gloss: Lang4 }[];
  items: (GrammarGapItem | GrammarMarkItem | MatchItem | FormItem)[];
}
