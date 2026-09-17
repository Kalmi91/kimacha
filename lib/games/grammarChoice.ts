// GAMES.md 4.11 (F3, grammar-choice): "Melyik a helyes?" round-building, pulled
// out of the screen so the FB2-style anti-position-bias shuffle (lib/shuffle.ts)
// is unit-testable without mounting the screen. A round is every item in the
// topic (12-15 per GAMES.md, matches the "10-15 item = egy futam" spec), in a
// seeded random order, each item's own options also seeded-shuffled so the
// correct answer isn't predictably in the JSON's authored slot 0.

import { shuffleArray, shuffleOptions, hashString } from '../shuffle';
import {
  isFormItem,
  isMarkItem,
  isMatchItem,
  isWhyItem,
  type GrammarGapItem,
  type GrammarItem,
  type GrammarKind,
  type GrammarMarkItem,
  type GrammarTopicData,
} from './content';
import type { FormItem, MatchItem, WhyItem } from '../grammar/lessonTypes';
import { markAnswerIndex, markTokens } from './grammarMark';

// A gap/mark tétel mindig kap opció-listát (gap: a felkínált válaszok kevert
// sorrendben; mark: a mondat szavai, sorrendben) és egy helyes indexet;
// match/formnak nincs se opciója, se indexe, azok saját képernyő-ágon
// (GrammarDrill) rajzolódnak ki. A két alak KÜLÖN típus, nem egy opcionális
// mezőkkel teletűzdelt közös alak, hogy a `.options`/`.correctIndex` a
// gap/mark ágon garantáltan jelen legyen (lásd ccat.ts `isChoiceRoundItem`
// szűrését, ami erre a garanciára épít).
export interface GrammarChoiceRoundItem {
  item: GrammarGapItem | GrammarMarkItem;
  options: string[];
  correctIndex: number; // index into `options`
}

export interface GrammarMatchFormRoundItem {
  item: MatchItem | FormItem;
}

// TASK-8 (D4): a `why` tétel saját round-item alakja, az opciók nyelvfüggő
// (Lang4) szövegek, tehát nem fér a GrammarChoiceRoundItem lapos string[]
// alakjába; a WhyDrillItem (GrammarDrill.tsx) a saját képernyő-ágán rajzolja.
export interface GrammarWhyRoundItem {
  item: WhyItem;
}

export type GrammarRoundItem = GrammarChoiceRoundItem | GrammarMatchFormRoundItem | GrammarWhyRoundItem;

export function isChoiceRoundItem(r: GrammarRoundItem): r is GrammarChoiceRoundItem {
  return 'options' in r;
}

// LECKE-SEMA D3 (FB290, 2026-09-17): melyik fajtába tartozik egy round-item,
// hogy a lecke-drill a kért fajtákra tudja szűrni a kört (`kinds` prop).
export function grammarRoundItemKind(r: GrammarRoundItem): GrammarKind {
  if (isChoiceRoundItem(r)) return 'choice';
  if (isMatchItem(r.item)) return 'match';
  return isFormItem(r.item) ? 'form' : 'why';
}

// LECKE-SEMA 2: a LessonV2 két új item-fajtája (match, form) a lecke szerzői
// sorrendjében kerül a kör VÉGÉRE, a gap/mark kör után, egymás közt és a
// gap/mark körrel sem keverve (spec: "no shuffling of kinds"). Hogy egy adott
// képernyő melyik fajtákat látja ebből, a GrammarDrill `kinds` propja dönti
// el (D3, FB290): a lecke-drill fajtánként külön indítja, a Game fül
// grammar-choice-a a prop híján változatlanul csak a gap/mark körét kapja.
export function buildGrammarRound(topic: GrammarTopicData, seed: number): GrammarRoundItem[] {
  // A `topic.items` uniós elem-típusa (LegacyLesson vs LessonV2) a `.filter`
  // narrowing-jét megzavarja; a `GrammarItem[]` cast egy lapos típusra hozza,
  // mielőtt a predikátum leszűkít.
  const allItems = topic.items as GrammarItem[];
  const choiceItems = allItems.filter(
    (item): item is GrammarGapItem | GrammarMarkItem =>
      !isMatchItem(item) && !isFormItem(item) && !isWhyItem(item)
  );
  const orderedChoice: GrammarChoiceRoundItem[] = shuffleArray(choiceItems, seed).map((item) => {
    // FB219: a jelölős feladatnál a sorrend maga a mondat, tehát nincs mit
    // keverni; az „opciók" a mondat szavai, a helyes index a keresett szóé.
    if (isMarkItem(item)) {
      const tokens = markTokens(item.sentence);
      const answerToken = markAnswerIndex(item, tokens);
      const words = tokens.filter((tk) => tk.isWord);
      const correctIndex = answerToken < 0 ? -1 : words.indexOf(tokens[answerToken]);
      return { item, options: words.map((tk) => tk.text), correctIndex };
    }
    const optionSeed = hashString(`${topic.topic}:${item.id}:${seed}`);
    const { options, correctIndex } = shuffleOptions(item.options, item.correct, optionSeed);
    return { item, options, correctIndex };
  });

  const matchItems: GrammarMatchFormRoundItem[] = allItems
    .filter((item): item is MatchItem => isMatchItem(item))
    .map((item) => ({ item }));
  const formItems: GrammarMatchFormRoundItem[] = allItems
    .filter((item): item is FormItem => isFormItem(item))
    .map((item) => ({ item }));
  // TASK-8 (D4): a `why` tételek is a kör VÉGÉRE kerülnek, szerzői sorrendben,
  // a match/form mintáját követve.
  const whyItems: GrammarWhyRoundItem[] = allItems
    .filter((item): item is WhyItem => isWhyItem(item))
    .map((item) => ({ item }));

  return [...orderedChoice, ...matchItems, ...formItems, ...whyItems];
}

// The wrong-answer explanation is keyed by the option's own text (GAMES.md
// 4.11 JSON: `wrong[optionText][lang]`), unaffected by the render-time shuffle.
export function wrongExplanation(
  item: GrammarGapItem | GrammarMarkItem,
  optionText: string,
  lang: string
): string | undefined {
  return item.wrong[optionText]?.[lang];
}
