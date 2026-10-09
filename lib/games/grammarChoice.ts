// Grammar-choice: "Which one is correct?" round-building, pulled
// out of the screen so the usual anti-position-bias shuffle (lib/shuffle.ts)
// is unit-testable without mounting the screen. A round is every item in the
// topic (12-15 items, matches the "10-15 items = one run" rule), in a
// seeded random order, each item's own options also seeded-shuffled so the
// correct answer isn't predictably in the JSON's authored slot 0.

import { shuffleArray, shuffleOptions, hashString } from '../shuffle';
import {
  isArticleSetItem,
  isDictationItem,
  isFormItem,
  isMarkItem,
  isMatchItem,
  isOrderItem,
  isSpotItem,
  isTransformItem,
  isWhyItem,
  type GrammarGapItem,
  type GrammarItem,
  type GrammarKind,
  type GrammarMarkItem,
  type GrammarTopicData,
} from './content';
import type { DictationItem, FormItem, MatchItem, OrderItem, SpotItem, TransformItem, WhyItem } from '../grammar/lessonTypes';
import { markAnswerIndex, markTokens } from './grammarMark';
import { filterVosotros, filterVosotrosPairs } from '../grammar/vosotros';
import { ARTICLE_LESSON_ID, ARTICLE_ROUND_SIZE } from '../grammar/nounArticles';

// A gap/mark item always gets an option list (gap: the offered answers in shuffled
// order; mark: the sentence's words, in order) and a correct index;
// match/form have neither options nor an index, and are rendered on their own
// screen branch (GrammarDrill). The two shapes are SEPARATE types, not one shared shape
// stuffed with optional fields, so that `.options`/`.correctIndex` are
// guaranteed to be present on the gap/mark branch (see the `isChoiceRoundItem`
// filtering in ccat.ts, which relies on this guarantee).
export interface GrammarChoiceRoundItem {
  item: GrammarGapItem | GrammarMarkItem;
  options: string[];
  correctIndex: number; // index into `options`
}

export interface GrammarMatchFormRoundItem {
  item: MatchItem | FormItem;
}

// The `why` item's own round-item shape; its options are language-dependent
// (Lang4) texts, so they do not fit GrammarChoiceRoundItem's flat string[]
// shape; the WhyDrillItem (GrammarDrill.tsx) renders it on its own screen branch.
export interface GrammarWhyRoundItem {
  item: WhyItem;
}

// The tense drill's sentence-rewriting item in its own round-item
// shape, following the pattern of why/match/form.
export interface GrammarTransformRoundItem {
  item: TransformItem;
}

// The three new kinds (error spotting, word order, dictation) also in their own
// round-item shape, following the pattern of why/transform.
export interface GrammarNewKindRoundItem {
  item: SpotItem | OrderItem | DictationItem;
}

export type GrammarRoundItem =
  | GrammarChoiceRoundItem
  | GrammarMatchFormRoundItem
  | GrammarWhyRoundItem
  | GrammarTransformRoundItem
  | GrammarNewKindRoundItem;

export function isChoiceRoundItem(r: GrammarRoundItem): r is GrammarChoiceRoundItem {
  return 'options' in r;
}

// Which kind a round item belongs to,
// so the lesson drill can filter the round to the requested kinds (`kinds` prop).
export function grammarRoundItemKind(r: GrammarRoundItem): GrammarKind {
  if (isChoiceRoundItem(r)) return (r.item as GrammarGapItem).set === 'article' ? 'article' : 'choice';
  if (isMatchItem(r.item)) return 'match';
  if (isFormItem(r.item)) return 'form';
  if (isSpotItem(r.item)) return 'spot';
  if (isOrderItem(r.item)) return 'order';
  if (isDictationItem(r.item)) return 'dictation';
  return isTransformItem(r.item) ? 'transform' : 'why';
}

// LessonV2's two new item kinds (match, form) go at the END of the round in
// the lesson's authored order, after the gap/mark round, not mixed with each other nor
// with the gap/mark round (spec: "no shuffling of kinds"). Which of these kinds a
// given screen sees is decided by GrammarDrill's `kinds` prop: the lesson drill
// starts them separately per kind, and the Game tab's grammar-choice, lacking the
// prop, keeps getting only the gap/mark round, unchanged.
export function buildGrammarRound(topic: GrammarTopicData, seed: number): GrammarRoundItem[] {
  // The union element type of `topic.items` (LegacyLesson vs LessonV2) confuses
  // the narrowing of `.filter`; the `GrammarItem[]` cast brings it to a flat type
  // before the predicate narrows it. The vosotros items drop out of the
  // round here, in ONE place for every lesson item kind (lib/grammar/vosotros.ts).
  const allItems = filterVosotros(topic.items as GrammarItem[]);
  const allChoiceItems = allItems.filter(
    (item): item is GrammarGapItem | GrammarMarkItem =>
      !isMatchItem(item) &&
      !isFormItem(item) &&
      !isWhyItem(item) &&
      !isTransformItem(item) &&
      !isSpotItem(item) &&
      !isOrderItem(item) &&
      !isDictationItem(item)
  );
  // the articulos-genero el / la set is every noun in the app, which is longer than one
  // run; a run gets ARTICLE_ROUND_SIZE items from it (seeded sample). No other lesson is affected.
  let choiceItems = allChoiceItems;
  if (topic.topic === ARTICLE_LESSON_ID) {
    const articleItems = allChoiceItems.filter((item) => isArticleSetItem(item));
    if (articleItems.length > ARTICLE_ROUND_SIZE) {
      const keep = new Set(shuffleArray(articleItems, seed).slice(0, ARTICLE_ROUND_SIZE).map((item) => item.id));
      choiceItems = allChoiceItems.filter((item) => !isArticleSetItem(item) || keep.has(item.id));
    }
  }
  const orderedChoice: GrammarChoiceRoundItem[] = shuffleArray(choiceItems, seed).map((item) => {
    // for the marking exercise the order is the sentence itself, so there is nothing
    // to shuffle; the "options" are the sentence's words, the correct index is that of the sought word.
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

  // the match items stay as they are, only their vosotros pairs drop out.
  const matchItems: GrammarMatchFormRoundItem[] = allItems
    .filter((item): item is MatchItem => isMatchItem(item))
    .map((item) => ({ item: filterVosotrosPairs(item) }));
  const formItems: GrammarMatchFormRoundItem[] = allItems
    .filter((item): item is FormItem => isFormItem(item))
    .map((item) => ({ item }));
  // the `why` items also go at the END of the round, in authored order,
  // following the pattern of match/form.
  const whyItems: GrammarWhyRoundItem[] = allItems
    .filter((item): item is WhyItem => isWhyItem(item))
    .map((item) => ({ item }));
  // the transform items also go at the END of the round, in authored order,
  // following the pattern of why.
  const transformItems: GrammarTransformRoundItem[] = allItems
    .filter((item): item is TransformItem => isTransformItem(item))
    .map((item) => ({ item }));

  // the new kinds also go at the END of the round, in authored order.
  const newKindItems: GrammarNewKindRoundItem[] = allItems
    .filter((item): item is SpotItem | OrderItem | DictationItem => isSpotItem(item) || isOrderItem(item) || isDictationItem(item))
    .map((item) => ({ item }));

  return [...orderedChoice, ...matchItems, ...formItems, ...whyItems, ...transformItems, ...newKindItems];
}

// The wrong-answer explanation is keyed by the option's own text
// (JSON: `wrong[optionText][lang]`), unaffected by the render-time shuffle.
export function wrongExplanation(
  item: GrammarGapItem | GrammarMarkItem,
  optionText: string,
  lang: string
): string | undefined {
  return item.wrong[optionText]?.[lang];
}
