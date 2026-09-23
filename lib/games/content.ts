// GAMES.md 3. (F0): authored-JSON content loading, grammar-choice (4.11) only.
// Play-vágás 7. lépés (2026-09-23): story/chat/confusables/myth/ccat
// (4.5/4.6/4.12/4.13/4.10) removed, no caller since their tabs left in
// earlier steps. The grammar types mirror the JSON format verbatim so a new
// topic is a pure-data change: add `data/games/grammar/<lang>/<id>.json`,
// statically import it in `lib/games/content/<lang>.ts`, push it into
// `grammarTopics`. No code in the grammar screens should need to change.

import { LEVELS, getWordsForLevel, type Level } from '@/data/words';
import type { FormItem, LessonV2, MatchItem, TenseId, TransformItem, WhyItem } from '../grammar/lessonTypes';
import { isVosotrosItem } from '../grammar/vosotros';

// Cumulative corpus word ids up to and including `level` (A0..level), used by
// the content-driven game screens to build GlossText's `knownWordIds`: a
// corpus-resolved word only gets the "isNew" dotted-underline treatment when
// it is genuinely outside the level's taught vocabulary, not for every word
// the screen didn't personally track via vocabPool (grammar-choice/confusables
// don't draw from the pool, GAMES.md 3.6's audit script is their gate instead).
const cumulativeIdsCache = new Map<string, Set<number>>();

export function cumulativeCorpusWordIds(level: Level, lang: string): Set<number> {
  const key = `${lang}:${level}`;
  const cached = cumulativeIdsCache.get(key);
  if (cached) return cached;
  const idx = LEVELS.indexOf(level);
  const ids = new Set<number>();
  for (let i = 0; i <= idx; i++) {
    for (const w of getWordsForLevel(LEVELS[i], lang)) ids.add(w.id);
  }
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

// Play-vágás 7. lépés (2026-09-23): story/chat/confusables/myth/ccat fields
// removed, no caller since their tabs left in earlier steps.
export interface LanguageContentBundle {
  grammarTopics: GrammarTopicData[];
}

import { esContent } from './content/es';

const BUNDLES: Partial<Record<string, LanguageContentBundle>> = {
  es: esContent,
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
// F3 MEGVALÓSÍTÁSI JEGYZET: the GAMES.md 4.11 example JSON showed `why` as a
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

export interface GrammarWrongExplanation {
  [optionText: string]: Record<string, string>; // per native lang hu/en/es/de
}

interface GrammarItemBase {
  id: string;
  why: Record<string, string>; // one-sentence "why correct", per native lang
  wrong: GrammarWrongExplanation; // wrong[optionText][lang] = why that option is wrong here
  examples: string[]; // 2 target-language example sentences illustrating the same rule
}

/** A klasszikus „melyik illik a lyukba" feladat. */
export interface GrammarGapItem extends GrammarItemBase {
  kind?: 'gap';
  sentence: string; // target language, blank marked "___"
  options: string[]; // target-language option texts
  correct: number; // index into options
  tense?: { from: TenseId; to: TenseId };
}

// FB219, Kálmán 2026-09-09 (grammar:clases-de-palabras:drill): „vagy lehetne
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

// LECKE-SEMA 1-2. szakasz: match/form a body-blokkos LessonV2 új feladat-
// fajtái, ide is bekerülnek, hogy egy GrammarItem-fogyasztó (a választós
// játék köre) minden lecke-item-fajtát ismerjen, még ha egyelőre csak a
// gap/mark kettőt dolgozza is fel (lib/games/grammarChoice.ts szűri ki a
// match/form-ot a köréből, azok a lecke-képernyőn jelennek meg, step 3-4).
export type GrammarItem = GrammarGapItem | GrammarMarkItem | MatchItem | FormItem | WhyItem | TransformItem;

export function isMarkItem(item: GrammarItem): item is GrammarMarkItem {
  return item.kind === 'mark';
}

export function isMatchItem(item: GrammarItem): item is MatchItem {
  return item.kind === 'match';
}

export function isFormItem(item: GrammarItem): item is FormItem {
  return item.kind === 'form';
}

// TASK-8 (D4, FB288): a "miért ez a mondat" feladat-fajta.
export function isWhyItem(item: GrammarItem): item is WhyItem {
  return item.kind === 'why';
}

// NY3 (NYELVTAN.md): az igeidő-drill mondat-átírás feladat-fajtája.
export function isTransformItem(item: GrammarItem): item is TransformItem {
  return item.kind === 'transform';
}

// LECKE-SEMA D3 (FB290, 2026-09-17): a lecke feladatai fajtánként külön
// indíthatók (a mondat-feladatok, a párosítás és a ragozás nem egy gombban
// megy), ehhez kell tudni fajtánként, hány item van egy leckében.
export type GrammarKind = 'choice' | 'match' | 'form' | 'why' | 'transform';

export function grammarKindCounts(topic: GrammarTopicData): Record<GrammarKind, number> {
  const counts: Record<GrammarKind, number> = { choice: 0, match: 0, form: 0, why: 0, transform: 0 };
  // FB357: the button label counts the round the learner actually plays, so a
  // vosotros item dropped from buildGrammarRound (lib/games/grammarChoice.ts)
  // does not inflate a "Mondatok (N)"-style count.
  for (const item of topic.items as GrammarItem[]) {
    if (isVosotrosItem(item)) continue;
    if (isMatchItem(item)) counts.match++;
    else if (isFormItem(item)) counts.form++;
    else if (isWhyItem(item)) counts.why++;
    else if (isTransformItem(item)) counts.transform++;
    else counts.choice++;
  }
  return counts;
}

// A régi (prózás rule/more) lecke-alak. Amíg a 20 másik témát nem migrálják
// a LessonV2 blokk-sémára (LECKE-SEMA), ez él tovább változatlanul.
export interface LegacyLesson {
  schema?: undefined;
  topic: string;
  level: Level;
  title: Record<string, string>; // hu/en/es/de
  rule: Record<string, string>; // hu/en/es/de, the topic's one-sentence rule card
  more?: Record<string, string>; // hu/en/es/de, K21 collapsed "Több" block: exceptions/edge cases
  glossary?: { word: string; gloss: Record<string, string> }[];
  items: (GrammarGapItem | GrammarMarkItem)[]; // a régi séma sosem tartalmaz match/form-ot
}

// LECKE-SEMA: a régi és az új lecke-alak uniója, hogy a két séma egymás
// mellett élhessen a migráció alatt.
export type GrammarTopicData = LegacyLesson | LessonV2;

export function isLessonV2(t: GrammarTopicData): t is LessonV2 {
  return t.schema === 2;
}

// Q1 (A1 alapok), GAMES.md 10. szekció token-burn queue.
// A2, the past and future the course was missing.

const grammarTopicsByLang: Partial<Record<string, GrammarTopicData[]>> = byLang('grammarTopics');

export function getGrammarTopics(lang: string): GrammarTopicData[] {
  return grammarTopicsByLang[lang] ?? [];
}

export function getGrammarTopic(lang: string, topic: string): GrammarTopicData | undefined {
  return getGrammarTopics(lang).find((t) => t.topic === topic);
}

