// authored-JSON content loading, grammar-choice (4.11) only.
// Play-vágás: story/chat/confusables/myth/ccat
// (4.5/4.6/4.12/4.13/4.10) removed, no caller since their tabs left in
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
  // a words-open kártyái (id = order), A0 → A1, C1/C2 → B2.
  const ids = new Set<number>();
  for (const w of getOpenWordsUpToLevel(level)) ids.add(w.id);
  cumulativeIdsCache.set(key, ids);
  return ids;
}


// ---------------------------------------------------------------------------
// Per-language content bundles (issue #3)
// ---------------------------------------------------------------------------
//
// Egy nyelv játék-tartalma egy köteg-fájlban lakik (`lib/games/content/<lang>.ts`),
// és ez a tábla fűzi őket a nyelv-kulcsos mapekbe. Egy új nyelvi sáv így egy új
// fájl plusz egy sor itt, nem nyolc szerkesztés ebben a fájlban, tehát a két
// sáv munkája nem ér össze.

// Play-vágás: story/chat/confusables/myth/ccat fields
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
// grammar-choice (4.11)
// ---------------------------------------------------------------------------
//
// F3 MEGVALÓSÍTÁSI JEGYZET: the example JSON showed `why` as a
// single hu-only string plus a `wrong` sub-object. K21/the top-level i18n×4
// rule need the explanation (why the correct option IS right, and why each
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
   * a mondat fordítása négy nyelven (a tanult nyelvi oldal a kitöltött mondat maga); a drill az F-gombbal
   * mutatja, mint az átírás-tételnél. Opcionális: scripts/grammar-translate.py tölti, ami még nincs, ott nincs gomb.
   */
  tr?: Lang4;
}

/** A klasszikus „melyik illik a lyukba" feladat. */
export interface GrammarGapItem extends GrammarItemBase {
  kind?: 'gap';
  sentence: string; // target language, blank marked "___"
  options: string[]; // target-language option texts
  correct: number; // index into options
  tense?: { from: TenseId; to: TenseId };
  /** 'article' = a névelő-választó (el / la) feladat-készlet tétele, saját gombbal. */
  set?: 'article';
}

export function isArticleSetItem(item: GrammarItem): boolean {
  return (item as GrammarGapItem).set === 'article';
}

// User feedback (grammar:clases-de-palabras:drill): „vagy lehetne
// olyan hogy egy momdat és kijelölni az igét vagy a advarbet vagy hogy egy
// momdat és akkor hol van benne a mi, vagy valami életszerű feladatot". A
// lyukas mondat izolált szót kérdez; ez a típus egy KÉSZ mondatot ad, és a
// tanuló abban koppint rá a kért szófajra, tehát a mondat egészében kell
// felismernie, nem két felkínált szó közül választ.
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
  target: GrammarWordClass; // melyik szófajt kell megjelölni
  answer: string; // a mondat azon szava, amire koppintani kell
  /** Ha a szó többször szerepel: hányadik előfordulás (0-tól). */
  answerIndex?: number;
}

// match/form a body-blokkos LessonV2 új feladat-
// fajtái, ide is bekerülnek, hogy egy GrammarItem-fogyasztó (a választós
// játék köre) minden lecke-item-fajtát ismerjen, még ha egyelőre csak a
// gap/mark kettőt dolgozza is fel (lib/games/grammarChoice.ts szűri ki a
// match/form-ot a köréből, azok a lecke-képernyőn jelennek meg, step 3-4).
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

// a "miért ez a mondat" feladat-fajta.
export function isWhyItem(item: GrammarItem): item is WhyItem {
  return item.kind === 'why';
}

// a három új feladat-fajta (hibakereső, szórend, diktálás).
export function isSpotItem(item: GrammarItem): item is SpotItem {
  return item.kind === 'spot';
}

export function isOrderItem(item: GrammarItem): item is OrderItem {
  return item.kind === 'order';
}

export function isDictationItem(item: GrammarItem): item is DictationItem {
  return item.kind === 'dictation';
}

/** Ideiglenes ("ÚJ · TESZT") tétel? */
export function isTrialItem(item: GrammarItem): boolean {
  return (item as { trial?: boolean }).trial === true;
}

// az igeidő-drill mondat-átírás feladat-fajtája.
export function isTransformItem(item: GrammarItem): item is TransformItem {
  return item.kind === 'transform';
}

// a lecke feladatai fajtánként külön
// indíthatók (a mondat-feladatok, a párosítás és a ragozás nem egy gombban
// megy), ehhez kell tudni fajtánként, hány item van egy leckében.
// 'article' = a névelő-választó (el / la) külön gomb: gap
// tételek `set: 'article'` jelöléssel, a saját gombjukon, nem a mondat-feladatok közt.
export type GrammarKind = 'choice' | 'article' | 'match' | 'form' | 'why' | 'transform' | 'spot' | 'order' | 'dictation';

export function grammarKindCounts(topic: GrammarTopicData): Record<GrammarKind, number> {
  const counts: Record<GrammarKind, number> = { choice: 0, article: 0, match: 0, form: 0, why: 0, transform: 0, spot: 0, order: 0, dictation: 0 };
  // the button label counts the round the learner actually plays, so a
  // vosotros item dropped from buildGrammarRound (lib/games/grammarChoice.ts)
  // does not inflate a "Mondatok (N)"-style count.
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

// minden lecke LessonV2 (schema 2); a régi rule/more alak megszűnt.
export type GrammarTopicData = LessonV2;

// Q1 (A1 alapok), token-burn queue.
// A2, the past and future the course was missing.

const grammarTopicsByLang: Partial<Record<string, GrammarTopicData[]>> = byLang('grammarTopics');

export function getGrammarTopics(lang: string): GrammarTopicData[] {
  return grammarTopicsByLang[lang] ?? [];
}

export function getGrammarTopic(lang: string, topic: string): GrammarTopicData | undefined {
  return getGrammarTopics(lang).find((t) => t.topic === topic);
}

