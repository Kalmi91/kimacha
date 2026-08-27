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

export interface StoryData {
  id: string;
  level: Level;
  title: Record<string, string>;
  cover: string; // emoji
  estMinutes: number;
  scenes: StoryScene[];
}

const storiesByLang: Partial<Record<string, StoryData[]>> = {};

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

export interface ChatNodeOption {
  next: string;
  good?: true;
  checklist?: string;
  [lang: string]: string | true | undefined;
}

export interface ChatNode {
  id: string;
  npc: Record<string, string>;
  options: ChatNodeOption[];
}

export interface ChatChecklistItem {
  id: string;
  why: Record<string, string>;
  source: { label: string; url: string };
  [lang: string]: string | Record<string, string> | { label: string; url: string } | undefined;
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
}

const chatsByLang: Partial<Record<string, ChatData[]>> = {};

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

export interface GrammarItem {
  id: string;
  sentence: string; // target language, blank marked "___"
  options: string[]; // target-language option texts
  correct: number; // index into options
  why: Record<string, string>; // one-sentence "why correct", per native lang
  wrong: GrammarWrongExplanation; // wrong[optionText][lang] = why that option is wrong here
  examples: string[]; // 2 target-language example sentences illustrating the same rule
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

import grammarEsSerEstar from '@/data/games/grammar/es/ser-estar.json';
import grammarEsArticulosGenero from '@/data/games/grammar/es/articulos-genero.json';
import grammarEsPorPara from '@/data/games/grammar/es/por-para.json';

const grammarTopicsByLang: Partial<Record<string, GrammarTopicData[]>> = {
  // The JSON's per-item literal shape (each `wrong` only has the one key that
  // item actually needs) is narrower than GrammarWrongExplanation's index
  // signature, so a direct `as` doesn't overlap; `unknown` first is the
  // standard escape hatch for "this JSON conforms to the hand-written type,
  // TS just can't see it structurally".
  es: [grammarEsSerEstar, grammarEsArticulosGenero, grammarEsPorPara] as unknown as GrammarTopicData[],
};

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

const confusablesByLang: Partial<Record<string, ConfusablesSet[]>> = {};

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
  source: { label: string; url: string };
  gloss?: { word: string; [lang: string]: string }[];
}

const mythsByLang: Partial<Record<string, MythItem[]>> = {};

export function getMyths(lang: string): MythItem[] {
  return mythsByLang[lang] ?? [];
}
