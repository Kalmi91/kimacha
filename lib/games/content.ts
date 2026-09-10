// GAMES.md 3. (F0): authored-JSON content loading for the content-driven games
// (story 4.5, chat 4.6, grammar-choice 4.11, confusables 4.12, myth 4.13).
//
// F3 (2026-08-27): grammar-choice's and confusables' types are final (K21's
// lang-keyed why/wrong, K23's drill `type`, both content kinds' `glossary`
// escape hatch); their registries are still empty here, the following commits
// populate them (data/topics.ts import style: one static import per file,
// pushed into the lang-keyed array) as the first content batch lands.
// story/chat/myth stay empty until F4. The types mirror the JSON formats
// verbatim so a future content batch (a new topic/set, or the en/de branches)
// is a pure-data change: add `data/games/<kind>/<lang>/<id>.json`, statically
// import it here, push it into the matching registry array. No code in the
// game screens should need to change.

import { LEVELS, getWordsForLevel, type Level } from '@/data/words';

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

export interface LanguageContentBundle {
  stories: StoryData[];
  chats: ChatData[];
  grammarTopics: GrammarTopicData[];
  confusables: ConfusablesSet[];
  myths: MythItem[];
  ccatAntonyms: CcatWordPairItem[];
  ccatSynonyms: CcatWordPairItem[];
  ccatWordProblems: CcatWordProblemItem[];
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
// story (4.5)
// ---------------------------------------------------------------------------

export interface StoryQuestionOption {
  correct?: true;
  [lang: string]: string | true | undefined;
}

export interface StoryScene {
  id: string;
  text: Record<string, string>; // { es: '...' }
  translation?: Record<string, string>;
  newWords?: { word: string; gloss: Record<string, string> }[];
  question?: {
    prompt: Record<string, string>;
    options: StoryQuestionOption[];
  };
}

// F4 MEGVALÓSÍTÁSI JEGYZET (story, 2026-08-27): `track` is a small addition
// over the pre-existing StoryData shape, K11's three sávok (cdmx/crime/scifi)
// need SOMETHING to group the picker by, and the illustrative 4.5 JSON never
// showed one. Kept as its own top-level field (not folded into `id`) so the
// hub can section the picker without parsing ids.
export type StoryTrack = 'cdmx' | 'crime' | 'scifi';

export interface StoryData {
  id: string;
  level: Level;
  track: StoryTrack;
  title: Record<string, string>;
  cover: string; // emoji
  estMinutes: number;
  scenes: StoryScene[];
}


const storiesByLang: Partial<Record<string, StoryData[]>> = byLang('stories');

export function getStories(lang: string): StoryData[] {
  return storiesByLang[lang] ?? [];
}

export function getStory(lang: string, id: string): StoryData | undefined {
  return getStories(lang).find((s) => s.id === id);
}

// ---------------------------------------------------------------------------
// chat (4.6)
// ---------------------------------------------------------------------------

export interface ChatSetupQuestion {
  id: string;
  prompt: Record<string, string>;
  options: { value: string; label: Record<string, string> }[];
}

// F4 MEGVALÓSÍTÁSI JEGYZET (chat, 2026-08-27): the GAMES.md 4.6 illustrative
// JSON's `nodes` graph has no way for the setup answer (K24: "más kimenetele
// legyen ha mást mondasz") to actually change anything, its `next` pointers
// are setup-agnostic. Rather than duplicating whole node subtrees per setup
// combo (a `start` map keyed by setup-answer-combo -> node id, which would
// require content authors to hand-write parallel branches), options gained a
// `requires` gate: `{ [setupQuestionId]: requiredValue }`. An option is only
// OFFERED when every entry matches the picked setup answers; omitted =
// always offered. `nodes[0]` is always the entry point (npc line is the
// same for everyone, only the offered questions differ), so one graph
// serves every setup combo, and different setup answers still walk a
// genuinely different subset of nodes via `next`. `next` is optional: its
// absence ends the conversation at that option (K14: a rossz válasz nem
// büntet, csak más, korábban véget érő ághoz vezet).
export interface ChatNodeOption {
  next?: string;
  good?: true;
  checklist?: string;
  requires?: Record<string, string>;
  [lang: string]: string | true | Record<string, string> | undefined;
}

export interface ChatNode {
  id: string;
  npc: Record<string, string>;
  options: ChatNodeOption[];
}

// GAMES.md source-fegyelem (2026-08-27 forduló, chat): `url` OPTIONAL, ugyanaz
// a szabály, mint a myth MythItem.source-nál (content.ts fentebb): csak akkor
// kerül bele, ha ténylegesen lekért, látott oldalra mutat.
export interface ChatChecklistItem {
  id: string;
  why: Record<string, string>;
  source: { label: string; url?: string };
  [lang: string]: string | Record<string, string> | { label: string; url?: string } | undefined;
}

export interface ChatEnding {
  id: string;
  if: string;
  title: Record<string, string>;
}

export interface ChatData {
  id: string;
  level: Level;
  title: Record<string, string>;
  setup: ChatSetupQuestion[];
  nodes: ChatNode[];
  checklist: ChatChecklistItem[];
  endings: ChatEnding[];
  // Same escape hatch as grammar-choice's/confusables' `glossary`: a chat's
  // professional vocabulary (kilometraje, óxido, revisión…) routinely runs
  // ahead of the level's general corpus, this is topic-wide (every node,
  // option, and checklist phrasing), not per-node, because the same domain
  // word recurs across the whole conversation.
  glossary?: { word: string; gloss: Record<string, string> }[];
}


const chatsByLang: Partial<Record<string, ChatData[]>> = byLang('chats');

export function getChats(lang: string): ChatData[] {
  return chatsByLang[lang] ?? [];
}

export function getChat(lang: string, id: string): ChatData | undefined {
  return getChats(lang).find((c) => c.id === id);
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

export type GrammarItem = GrammarGapItem | GrammarMarkItem;

export function isMarkItem(item: GrammarItem): item is GrammarMarkItem {
  return item.kind === 'mark';
}

export interface GrammarTopicData {
  topic: string;
  level: Level;
  title: Record<string, string>; // hu/en/es/de
  rule: Record<string, string>; // hu/en/es/de, the topic's one-sentence rule card
  more?: Record<string, string>; // hu/en/es/de, K21 collapsed "Több" block: exceptions/edge cases
  glossary?: { word: string; gloss: Record<string, string> }[];
  items: GrammarItem[];
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

// ---------------------------------------------------------------------------
// confusables (4.12)
// ---------------------------------------------------------------------------
//
// F3 MEGVALÓSÍTÁSI JEGYZET: `ConfusablesDrill` gained a `type` (K23: gap /
// reverse / listening, GAMES.md 4.12 "B) Dril"). `sentence` stays the literal
// text for 'gap' (blank marked "___") and 'listening' (the full sentence
// spoken via TTS, no blank); 'reverse' needs neither, the screen builds its
// prompt at render time from the target member's own `gloss[nativeLang]`, so
// the "melyik jelenti azt, hogy X" question is never duplicated in the JSON.
// `glossary` mirrors grammar-choice's: incidental non-member Spanish words
// used in an example/drill sentence that are not yet in the shared corpus.

export type ConfusablesDrillType = 'gap' | 'reverse' | 'listening';

export interface ConfusableMember {
  word: string;
  gloss: Record<string, string>;
  hint?: Record<string, string>;
  examples: string[];
}

export interface ConfusablesDrill {
  type: ConfusablesDrillType;
  sentence?: string; // 'gap': contains "___"; 'listening': full sentence, the answer word present
  correct: string; // one of members[].word
}

export interface ConfusablesSet {
  id: string;
  level: Level;
  members: ConfusableMember[];
  mnemonic?: Record<string, string>;
  drills: ConfusablesDrill[];
  glossary?: { word: string; gloss: Record<string, string> }[];
}


const confusablesByLang: Partial<Record<string, ConfusablesSet[]>> = byLang('confusables');

export function getConfusablesSets(lang: string): ConfusablesSet[] {
  return confusablesByLang[lang] ?? [];
}

export function getConfusablesSet(lang: string, id: string): ConfusablesSet | undefined {
  return getConfusablesSets(lang).find((c) => c.id === id);
}

// ---------------------------------------------------------------------------
// myth (4.13)
// ---------------------------------------------------------------------------

export type MythTrack = 'common' | 'body' | 'mexico' | 'language';

export interface MythItem {
  id: string;
  level: Level;
  track: MythTrack;
  claim: Record<string, string>;
  verdict: 'true' | 'myth';
  explanation: Record<string, string>;
  // GAMES.md source-fegyelem (2026-08-27 forduló): url OPTIONAL. Csak akkor
  // kerül bele, ha ténylegesen lekért, látott oldalra mutat; egy széles körben
  // megalapozott, de pontosan nem hivatkozható állításnál a label a szervezetet/
  // tudásterületet nevezi meg, url nélkül. Kitalált URL rosszabb, mint a hiánya.
  source: { label: string; url?: string };
  gloss?: { word: string; [lang: string]: string }[];
}


const mythsByLang: Partial<Record<string, MythItem[]>> = byLang('myths');

export function getMyths(lang: string): MythItem[] {
  return mythsByLang[lang] ?? [];
}

// ---------------------------------------------------------------------------
// ccat (4.10): antonym / synonym / word-problem authored items.
//
// Analogy items are DERIVED from the antonym/synonym pairs at round-build
// time (lib/games/ccat.ts), not separately authored: two antonym pairs make
// a perfectly valid A:B::C:D analogy, so a third authored file would just
// duplicate the first two. Kakukktojás reuses oddOneOut.ts's
// buildOddOneOutRound, mondat-kiegészítés reuses the EXISTING grammar-choice
// topics via getGrammarTopics() above, GAMES.md's own words: "Ahol a ccat és
// az odd-one-out ugyanazt csinálja, OSZD MEG a motort, ne másold."
// ---------------------------------------------------------------------------

export interface CcatWordPairItem {
  id: string;
  level: Level;
  word: string; // target-language prompt word
  correct: string; // target-language answer (its antonym/synonym)
  distractors: string[]; // 3 target-language wrong options
}

export interface CcatWordProblemItem {
  id: string;
  level: Level;
  prompt: Record<string, string>; // hu/en/es/de, the numbers are already baked into the text
  a: number;
  b: number;
  op: '+' | '-';
  answer: number;
  distractors: number[];
}


const ccatAntonymsByLang: Partial<Record<string, CcatWordPairItem[]>> = byLang('ccatAntonyms');
const ccatSynonymsByLang: Partial<Record<string, CcatWordPairItem[]>> = byLang('ccatSynonyms');
const ccatWordProblemsByLang: Partial<Record<string, CcatWordProblemItem[]>> = byLang('ccatWordProblems');

export function getCcatAntonyms(lang: string): CcatWordPairItem[] {
  return ccatAntonymsByLang[lang] ?? [];
}

export function getCcatSynonyms(lang: string): CcatWordPairItem[] {
  return ccatSynonymsByLang[lang] ?? [];
}

export function getCcatWordProblems(lang: string): CcatWordProblemItem[] {
  return ccatWordProblemsByLang[lang] ?? [];
}
