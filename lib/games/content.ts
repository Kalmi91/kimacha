// Authored-JSON content loading, grammar-choice only.
// Play cut: story/chat/confusables/myth/ccat
// removed, no caller since their tabs left in
// earlier steps. The grammar types mirror the JSON format verbatim so a new
// topic is a pure-data change: add `data/games/grammar/<lang>/<id>.json`,
// statically import it in `lib/games/content/<lang>.ts`, push it into
// `grammarTopics`. No code in the grammar screens should need to change.

import type { Level } from '@/data/words';
import { getOpenWordsUpToLevel } from '@/data/openWords';
import type { DictationItem, FormItem, Lang4, LessonV2, MatchItem, OrderItem, SpotItem, TenseId, TransformItem, WhyItem } from '../grammar/lessonTypes';
import { isVosotrosItem } from '../grammar/vosotros';

// Cumulative corpus word ids up to and including `level` (A0..level), used by
// the content-driven game screens to build GlossText's `knownWordIds`: a
// corpus-resolved word only gets the "isNew" dotted-underline treatment when
// it is genuinely outside the level's taught vocabulary, not for every word
// the screen didn't personally track via vocabPool (grammar-choice/confusables
// don't draw from the pool, the audit script is their gate instead).
const cumulativeIdsCache = new Map<string, Set<number>>();

export function cumulativeCorpusWordIds(level: Level, lang: string): Set<number> {
  const key = `${lang}:${level}`;
  const cached = cumulativeIdsCache.get(key);
  if (cached) return cached;
  // The words-open cards (id = order), A0 → A1, C1/C2 → B2.
  const ids = new Set<number>();
  for (const w of getOpenWordsUpToLevel(level)) ids.add(w.id);
  cumulativeIdsCache.set(key, ids);
  return ids;
}


// ---------------------------------------------------------------------------
// Per-language content bundles (issue #3)
// ---------------------------------------------------------------------------
//
// One language's game content lives in a bundle file (`lib/games/content/<lang>.ts`),
// and this table stitches them into the language-keyed maps. A new language lane is
// thus one new file plus one line here, not eight edits in this file, so the work of
// two lanes does not collide.

// Play cut: story/chat/confusables/myth/ccat fields
// removed, no caller since their tabs left in earlier steps.
export interface LanguageContentBundle {
  grammarTopics: GrammarTopicData[];
}

import { esContent } from './content/es';
import { enContent } from './content/en';

const BUNDLES: Partial<Record<string, LanguageContentBundle>> = {
  es: esContent,
  en: enContent,
};

function byLang<K extends keyof LanguageContentBundle>(
  key: K
): Partial<Record<string, LanguageContentBundle[K]>> {
  const out: Partial<Record<string, LanguageContentBundle[K]>> = {};
  for (const [lang, bundle] of Object.entries(BUNDLES)) {
    if (bundle) out[lang] = bundle[key];
  }
  return out;
}

// ---------------------------------------------------------------------------
// grammar-choice
// ---------------------------------------------------------------------------
//
// IMPLEMENTATION NOTE: the example JSON showed `why` as a
// single hu-only string plus a `wrong` sub-object. The top-level i18n×4
// rule needs the explanation (why the correct option IS right, and why each
// wrong option ISN'T) in all 4 native languages, so both are restructured to
// be lang-keyed: `why[lang]`, `wrong[optionText][lang]`. A `level` field was
// also added (absent from the illustrative JSON) because the audit script's
// P1 check needs to know which level's cumulative vocabulary an item's
// Spanish text must stay inside; content authors can freely mix items of
// different levels in one topic via a per-topic `level` (the ceiling of its
// hardest item) since a topic is one JSON file, one level. `glossary` covers
// any incidental Spanish word used in a sentence/example that is not yet in
// the shared corpus at that level (mirrors story's `newWords`), consumed by
// lib/games/gloss.ts's `overrides` param the same way.

interface GrammarWrongExplanation {
  [optionText: string]: Record<string, string>; // per native lang hu/en/es/de
}

interface GrammarItemBase {
  id: string;
  why: Record<string, string>; // one-sentence "why correct", per native lang
  wrong: GrammarWrongExplanation; // wrong[optionText][lang] = why that option is wrong here
  examples: string[]; // 2 target-language example sentences illustrating the same rule
  /**
   * The sentence's translation in four languages (the learned-language side is the filled-in sentence itself); the drill shows it
   * with the F button, as for the transform item. Optional: filled by scripts/grammar-translate.py; where it is missing, there is no button.
   */
  tr?: Lang4;
}

/** The classic "which one fits the gap" exercise. */
export interface GrammarGapItem extends GrammarItemBase {
  kind?: 'gap';
  sentence: string; // target language, blank marked "___"
  options: string[]; // target-language option texts
  correct: number; // index into options
  tense?: { from: TenseId; to: TenseId };
  /** 'article' = an item of the article-choice (el / la) exercise set, with its own button. */
  set?: 'article';
}

export function isArticleSetItem(item: GrammarItem): boolean {
  return (item as GrammarGapItem).set === 'article';
}

// Learner request: an exercise where, in a sentence, you pick out the verb or
// the adverb, or find where a given word class is in it, i.e. a more
// life-like task. A gap sentence asks about an isolated word; this type gives a
// COMPLETE sentence and the learner taps the requested word class in it, so they
// have to recognise it within the whole sentence rather than choose between two
// offered words.
export type GrammarWordClass =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'article'
  | 'pronoun'
  | 'preposition';

export interface GrammarMarkItem extends GrammarItemBase {
  kind: 'mark';
  sentence: string; // target language, WHOLE sentence, no blank
  target: GrammarWordClass; // which word class to mark
  answer: string; // the word of the sentence to tap
  /** If the word occurs more than once: which occurrence (0-based). */
  answerIndex?: number;
}

// match/form are new exercise kinds of the body-block LessonV2; they are
// included here too, so that any GrammarItem consumer (the round of the
// choice game) knows every lesson item kind, even if for now it only handles
// the gap/mark pair (lib/games/grammarChoice.ts filters match/form out of its
// round; those appear on the lesson screen).
export type GrammarItem = GrammarGapItem | GrammarMarkItem | MatchItem | FormItem | WhyItem | TransformItem | SpotItem | OrderItem | DictationItem;

export function isMarkItem(item: GrammarItem): item is GrammarMarkItem {
  return item.kind === 'mark';
}

export function isMatchItem(item: GrammarItem): item is MatchItem {
  return item.kind === 'match';
}

export function isFormItem(item: GrammarItem): item is FormItem {
  return item.kind === 'form';
}

// The "why this sentence" exercise kind.
export function isWhyItem(item: GrammarItem): item is WhyItem {
  return item.kind === 'why';
}

// The three new exercise kinds (error spotting, word order, dictation).
export function isSpotItem(item: GrammarItem): item is SpotItem {
  return item.kind === 'spot';
}

export function isOrderItem(item: GrammarItem): item is OrderItem {
  return item.kind === 'order';
}

export function isDictationItem(item: GrammarItem): item is DictationItem {
  return item.kind === 'dictation';
}

/** A temporary ("NEW · TEST") item? */
export function isTrialItem(item: GrammarItem): boolean {
  return (item as { trial?: boolean }).trial === true;
}

// The sentence-rewriting exercise kind of the tense drill.
export function isTransformItem(item: GrammarItem): item is TransformItem {
  return item.kind === 'transform';
}

// A lesson's exercises can be started
// per kind (the sentence exercises, matching and conjugation do not go behind a
// single button), which requires knowing how many items of each kind a lesson has.
// 'article' = the article-choice (el / la) button, separate: gap
// items marked `set: 'article'`, on their own button, not among the sentence exercises.
export type GrammarKind = 'choice' | 'article' | 'match' | 'form' | 'why' | 'transform' | 'spot' | 'order' | 'dictation';

export function grammarKindCounts(topic: GrammarTopicData): Record<GrammarKind, number> {
  const counts: Record<GrammarKind, number> = { choice: 0, article: 0, match: 0, form: 0, why: 0, transform: 0, spot: 0, order: 0, dictation: 0 };
  // the button label counts the round the learner actually plays, so a
  // vosotros item dropped from buildGrammarRound (lib/games/grammarChoice.ts)
  // does not inflate a "Sentences (N)"-style count.
  for (const item of topic.items as GrammarItem[]) {
    if (isVosotrosItem(item)) continue;
    if (isMatchItem(item)) counts.match++;
    else if (isFormItem(item)) counts.form++;
    else if (isWhyItem(item)) counts.why++;
    else if (isTransformItem(item)) counts.transform++;
    else if (isSpotItem(item)) counts.spot++;
    else if (isOrderItem(item)) counts.order++;
    else if (isDictationItem(item)) counts.dictation++;
    else if (isArticleSetItem(item)) counts.article++;
    else counts.choice++;
  }
  return counts;
}

// Every lesson is LessonV2 (schema 2); the old rule/more shape is gone.
export type GrammarTopicData = LessonV2;

const grammarTopicsByLang: Partial<Record<string, GrammarTopicData[]>> = byLang('grammarTopics');

export function getGrammarTopics(lang: string): GrammarTopicData[] {
  return grammarTopicsByLang[lang] ?? [];
}

export function getGrammarTopic(lang: string, topic: string): GrammarTopicData | undefined {
  return getGrammarTopics(lang).find((t) => t.topic === topic);
}

