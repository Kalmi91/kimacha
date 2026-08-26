// GAMES.md 3. (F0): authored-JSON content loading for the content-driven games
// (story 4.5, chat 4.6, grammar-choice 4.11, confusables 4.12, myth 4.13).
//
// No content has been authored yet (that's F3/F4 per the 5. szekció build
// order), so every registry below is empty and every getter returns nothing.
// The types mirror the JSON formats verbatim so a future content batch is a
// pure-data change: add `data/games/<kind>/<lang>/<id>.json`, statically
// import it here (same pattern as data/topics.ts), push it into the matching
// registry array. No code in the game screens should need to change.

import type { Level } from '@/data/words';

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

export interface GrammarItem {
  id: string;
  sentence: string;
  options: string[];
  correct: number;
  why: { wrong?: Record<string, string> } & Record<string, string | Record<string, string> | undefined>;
  examples: string[];
}

export interface GrammarTopicData {
  topic: string;
  title: Record<string, string>;
  rule: Record<string, string>;
  items: GrammarItem[];
}

const grammarTopicsByLang: Partial<Record<string, GrammarTopicData[]>> = {};

export function getGrammarTopics(lang: string): GrammarTopicData[] {
  return grammarTopicsByLang[lang] ?? [];
}

export function getGrammarTopic(lang: string, topic: string): GrammarTopicData | undefined {
  return getGrammarTopics(lang).find((t) => t.topic === topic);
}

// ---------------------------------------------------------------------------
// confusables (4.12)
// ---------------------------------------------------------------------------

export interface ConfusableMember {
  word: string;
  gloss: Record<string, string>;
  hint?: Record<string, string>;
  examples: string[];
}

export interface ConfusablesDrill {
  sentence: string;
  correct: string;
}

export interface ConfusablesSet {
  id: string;
  level: Level;
  members: ConfusableMember[];
  mnemonic?: Record<string, string>;
  drills: ConfusablesDrill[];
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
