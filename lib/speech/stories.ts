// The Speak tab (beta speechTab, PLAN-beszed): a story the learner talks into. A character of the story says a line, the learner
// answers it by voice or typed, an accepted answer moves the story on by itself, and the story ends with how many answers were
// right the first time (data/speech/stories.json). Spanish direction only for now. A story's lines and answers are in its `target`
// language, everything else (title, teaser, intro, meanings, what to say) in the learner's. A story is offered only when every
// text it shows has the learner's language (the same rule as the Situations). Nothing is locked: the words the learner does not
// know yet are shown before the story (`unknownWords`). Pure logic, no I/O: the screens are components/speech/*, what is said
// is checked by lib/practice/situationMatch.ts (an answer may hold a `*` free slot). No SRS writes, no XP.

import type { PcicLevel, PcicTarget } from '@/data/pcic';
import storiesData from '@/data/speech/stories.json';
import { activeSourceFor, type Lang } from '@/lib/languagePair';

/** Resume store key of the open run. */
export const SPEECH_MODE = 'speech';
/** Resume store key of the level the list shows. */
export const SPEECH_LEVEL_KEY = 'speech-level';
/** Resume store key of how the learner answers (voice or typing), kept between stories. */
export const SPEECH_ANSWER_KEY = 'speech-answer';
/** `game_progress` game id: one row per finished story (item id = story id, state 'done', data `StoryProgress`). */
export const SPEECH_PROGRESS_KEY = 'speech-stories';

/** After this many wrong tries on a turn the model answer is shown and Next appears. */
export const MAX_TRIES = 2;

export type StoryText = Record<Lang, string>;

/** A word the story uses: the headword (in the story's target language), the forms it takes in the story and what it means. */
export interface StoryWord extends StoryText {
  forms: string[];
}

export interface StoryTurn extends StoryText {
  /** What the learner is asked to do, in the learner's language. */
  ask: StoryText;
  /** The model answer, shown as a hint; `___` stands for what only the learner knows. */
  model: string;
  /** What is accepted; `*` is one free word slot. */
  answers: string[];
  /** Any number matches the number of the answer ("Tengo treinta años" is also right as "tengo 35 años"). */
  anyNumber?: boolean;
}

/** The languages that have stories: the character talks in this language. */
export type StoryTarget = 'es';

export interface SpeechStory {
  id: string;
  target: StoryTarget;
  level: PcicLevel;
  /** The character who talks to the learner. */
  speaker: string;
  title: StoryText;
  teaser: StoryText;
  /** The scene before the first line, and the closing words after the last. */
  intro: StoryText;
  outro: StoryText;
  words: StoryWord[];
  turns: StoryTurn[];
}

/** The Spanish stories. */
export const STORIES: SpeechStory[] = storiesData as SpeechStory[];

const BY_TARGET: Partial<Record<PcicTarget, readonly SpeechStory[]>> = { es: STORIES };

/** The text of a line the character says, in the language of the story. */
export const lineOf = (s: Pick<SpeechStory, 'target'>, turn: StoryTurn): string => turn[s.target];

// A story is told to a learner in a language only when every text it shows has that language (a learner never gets another
// language in its place: without the texts the story is simply not offered).
function toldIn(s: SpeechStory, source: Lang): boolean {
  return Boolean(
    s.title[source] &&
      s.teaser[source] &&
      s.intro[source] &&
      s.outro[source] &&
      s.words.every((w) => w[source]) &&
      s.turns.every((turn) => turn[source] && turn.ask[source]),
  );
}

/** The stories of a target language that can be told in the learner's language (none for a language without stories). */
export function storiesFor(target: PcicTarget, source: Lang = activeSourceFor(target)): readonly SpeechStory[] {
  const all = BY_TARGET[target];
  if (!all) return [];
  const told = all.filter((s) => toldIn(s, source));
  return told.length === all.length ? all : told;
}

/** The stories of one level. */
export function storiesOfLevel(target: PcicTarget, level: PcicLevel, source: Lang = activeSourceFor(target)): readonly SpeechStory[] {
  return storiesFor(target, source).filter((s) => s.level === level);
}

/** The words of the story the learner does not know yet: none of their forms is in `known` (lib/knownSentence.ts knownTokens). */
export function unknownWords(s: SpeechStory, known: ReadonlySet<string>): StoryWord[] {
  return s.words.filter((w) => !w.forms.some((f) => known.has(f.toLowerCase())));
}

export type AnswerMode = 'voice' | 'type';

export interface StoryAnswer {
  /** What the learner said or typed, or the model answer of a turn that was given up. */
  text: string;
  /** false = the turn was given up (Next), the text is the model answer. */
  ok: boolean;
}

export interface StoryRun {
  /** The story. */
  id: string;
  mode: AnswerMode;
  /** The turn on screen; the total of the story once the run is done. */
  turn: number;
  /** Wrong tries on the current turn. */
  tries: number;
  /** Turns answered right at the first try. */
  firstTry: number;
  /** One per finished turn, in order. */
  answers: StoryAnswer[];
  done: boolean;
}

/** A fresh run of the story. */
export function startStory(s: SpeechStory, mode: AnswerMode): StoryRun {
  return { id: s.id, mode, turn: 0, tries: 0, firstTry: 0, answers: [], done: false };
}

function advance(state: StoryRun, s: SpeechStory, answer: StoryAnswer, firstTry: number): StoryRun {
  const turn = state.turn + 1;
  return { ...state, turn, tries: 0, firstTry, answers: [...state.answers, answer], done: turn >= s.turns.length };
}

/**
 * The learner's answer to the current turn. Right: it goes into the answers, the turn moves on (a point when it was the first try),
 * after the last turn the run is done. Wrong: one more try, nothing else.
 */
export function answerTurn(state: StoryRun, s: SpeechStory, { right, text }: { right: boolean; text: string }): StoryRun {
  if (state.done) return state;
  if (!right) return { ...state, tries: state.tries + 1 };
  return advance(state, s, { text, ok: true }, state.firstTry + (state.tries === 0 ? 1 : 0));
}

/** Next after MAX_TRIES wrong tries: the turn's model answer goes into the answers (given up), and the story moves on. */
export function skipTurn(state: StoryRun, s: SpeechStory): StoryRun {
  if (state.done || state.tries < MAX_TRIES) return state;
  return advance(state, s, { text: s.turns[state.turn].model, ok: false }, state.firstTry);
}

/** How the learner answers: the run changes, nothing else does. */
export function setMode(state: StoryRun, mode: AnswerMode): StoryRun {
  return state.mode === mode ? state : { ...state, mode };
}

/** What goes into the resume store. */
export function savedRun(state: StoryRun): unknown {
  return { v: 1, ...state };
}

const isCount = (x: unknown, max = Infinity): x is number => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= max;

/** A saved run back, or null when it is broken, is of a story that is gone, or does not fit the story any more. */
export function parseRun(raw: unknown, stories: readonly SpeechStory[]): StoryRun | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const s = stories.find((x) => x.id === r.id);
  if (!s || r.v !== 1 || (r.mode !== 'voice' && r.mode !== 'type') || typeof r.done !== 'boolean') return null;
  const total = s.turns.length;
  if (!isCount(r.turn, total) || !isCount(r.tries) || !isCount(r.firstTry, total)) return null;
  if (r.done !== (r.turn === total)) return null;
  if (!Array.isArray(r.answers) || r.answers.length !== r.turn) return null;
  const answers: StoryAnswer[] = [];
  for (const a of r.answers as unknown[]) {
    const x = a as Record<string, unknown> | null;
    if (typeof x !== 'object' || x === null || typeof x.text !== 'string' || typeof x.ok !== 'boolean') return null;
    answers.push({ text: x.text, ok: x.ok });
  }
  // a point is a right answer, so there cannot be more points than right answers
  if (r.firstTry > answers.filter((a) => a.ok).length) return null;
  return { id: s.id, mode: r.mode, turn: r.turn, tries: r.tries, firstTry: r.firstTry, answers, done: r.done };
}

/** What the `game_progress` row of a finished story holds. */
export interface StoryProgress {
  /** The best number of answers right the first time. */
  best: number;
  total: number;
  /** `localDateString()` of the last finish. */
  at: string;
}

/** The row data after a run finished: `best` keeps the higher value. `previous` = the data of the row so far (anything broken counts as none). */
export function finishedProgress(previous: unknown, run: Pick<StoryRun, 'firstTry'>, total: number, at: string): StoryProgress {
  const was = previous as Partial<StoryProgress> | null;
  const before = typeof was === 'object' && was !== null && isCount(was.best) ? was.best : 0;
  return { best: Math.max(before, run.firstTry), total, at };
}

/** The finished stories by id with their best, from the rows of `SPEECH_PROGRESS_KEY`. */
export function progressById(rows: readonly { itemId: string; state: string; data?: unknown }[]): Map<string, StoryProgress> {
  const out = new Map<string, StoryProgress>();
  for (const row of rows) {
    const d = row.data as Partial<StoryProgress> | null | undefined;
    if (row.state === 'done' && typeof d === 'object' && d !== null && isCount(d.best) && isCount(d.total)) {
      out.set(row.itemId, { best: d.best, total: d.total, at: typeof d.at === 'string' ? d.at : '' });
    }
  }
  return out;
}
