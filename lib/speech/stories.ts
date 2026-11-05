// The Speak tab (beta speechTab, PLAN-beszed): a story the learner talks into. A character of the story says a line, the learner
// answers it by voice or typed, an accepted answer moves the story on by itself, and the story ends with how many answers were
// right the first time (data/speech/stories.json). Spanish direction only for now. A story's lines and answers are in its `target`
// language, everything else (title, teaser, intro, meanings, what to say) in the learner's. A turn has branches: the first branch
// with a right match decides her reaction and the next turn, so the answer decides how the story goes on. A story is offered only
// when every text it shows has the learner's language (the same rule as the Situations). Nothing is locked: the words the learner
// does not know yet are shown before the story (`unknownWords`). Pure logic, no I/O: the screens are components/speech/*, what is
// said is checked by lib/practice/situationMatch.ts (an answer may hold a `*` free slot). A turn can have a scene line (what happens in
// between), ask-back branches (the learner asks "¿Y tú?", she answers and the turn stands) and, after the talk, recall questions
// about her. No SRS writes, no XP.

import type { PcicLevel, PcicTarget } from '@/data/pcic';
import storiesData from '@/data/speech/stories.json';
import { activeSourceFor, type Lang } from '@/lib/languagePair';
import { matchSpoken, type SpokenMatch } from '@/lib/practice/situationMatch';

/** Resume store key of the open run. */
export const SPEECH_MODE = 'speech';
/** Resume store key of the level the list shows. */
export const SPEECH_LEVEL_KEY = 'speech-level';
/** Resume store key (the old, pair-less one) of how the learner answers (voice or typing). */
export const SPEECH_ANSWER_KEY = 'speech-answer';
/** The same, per language pair: the last way the learner chose for any story of that pair. */
export const speechAnswerKey = (pair: string): string => `${SPEECH_ANSWER_KEY}:${pair}`;
/** `game_progress` game id: one row per finished story (item id = story id, state 'done', data `StoryProgress`). */
export const SPEECH_PROGRESS_KEY = 'speech-stories';

/** After this many wrong tries on a turn the main answer is shown and Next appears. */
export const MAX_TRIES = 2;
/** Asking back works this many times on one turn; after that it is not an answer any more (so a turn always ends). */
export const MAX_BACKS = 2;

export type StoryText = Record<Lang, string>;

/** A word the story uses: the headword (in the story's target language), the forms it takes in the story and what it means. */
export interface StoryWord extends StoryText {
  forms: string[];
}

/** One way to answer a turn. The first branch (data order) with a right match decides her reaction and where the story goes on. */
export interface StoryBranch {
  /** What is accepted; `*` is one free word slot. */
  answers: string[];
  /** Any number matches the number of an answer ("Cuarenta" is also right as "35"). */
  anyNumber?: boolean;
  /** The lines shown under "You can say": the target text and its translations; `___` stands for what only the learner knows. */
  say: StoryText[];
  /** Her reaction, the start of the next bubble. */
  reply?: StoryText;
  /** The turn this answer leads to; no `next` = the story ends. */
  next?: string;
  /**
   * Asking back ("¿Y tú?", "¿Cómo?"): she answers with `reply` (which asks the question again) and the same turn stands. It counts neither
   * right nor wrong, has no `next`, is kept last in the data (it fires only when no real branch matches and the whole utterance is its
   * phrase) and works MAX_BACKS times on a turn.
   */
  back?: boolean;
}

export interface StoryTurn extends StoryText {
  id: string;
  branches: StoryBranch[];
  /** The branch a given-up turn follows (default: the first one that is not an ask-back). */
  main?: number;
  /** What the app tells before this line (a scene: "The waiter comes back with your order"), shown in the learner's language. */
  scene?: StoryText;
  /** The follow-up chain the turn belongs to (data check only: a chain is two or more questions that build on an answer). */
  chain?: string;
  /** A question about her after the talk, shown as a question of the app, not as her line; `seen` are two turns every way goes through whose line has `key`. */
  recall?: { key: string; seen: string[] };
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

// A story is told to a learner in a language only when every text it shows has that language (a learner never gets another
// language in its place: without the texts the story is simply not offered).
function toldIn(s: SpeechStory, source: Lang): boolean {
  return Boolean(
    s.title[source] &&
      s.teaser[source] &&
      s.intro[source] &&
      s.outro[source] &&
      s.words.every((w) => w[source]) &&
      s.turns.every((turn) => turn[source] && (!turn.scene || turn.scene[source]) && turn.branches.every((b) => b.say.every((x) => x[source]) && (!b.reply || b.reply[source]))),
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
  /** What the learner said or typed, or the first `say` line of the main branch of a turn that was given up. */
  text: string;
  /** false = the turn was given up (Next), the text is the model answer. */
  ok: boolean;
  /** The index of the branch the story followed. */
  branch: number;
}

/** An ask-back the learner made: what was said, on which turn of the path and which branch of it answered. */
export interface StoryBack {
  /** The index of the turn in `path`. */
  at: number;
  text: string;
  branch: number;
}

export interface StoryRun {
  /** The story. */
  id: string;
  mode: AnswerMode;
  /** The ids of the turns of this run in order: the answered ones, and while the run is open the one on screen at the end. */
  path: string[];
  /** Wrong tries on the current turn. */
  tries: number;
  /** Turns answered right at the first try. */
  firstTry: number;
  /** One per finished turn, in order. */
  answers: StoryAnswer[];
  /** The ask-backs so far, in order (they are not answers: no point, no try). */
  backs: StoryBack[];
  done: boolean;
}

/** The turn with this id. */
export const turnById = (s: Pick<SpeechStory, 'turns'>, id: string): StoryTurn | undefined => s.turns.find((x) => x.id === id);

/** The turn on screen (of a finished run: the last one). */
export function currentTurn(s: SpeechStory, run: Pick<StoryRun, 'path'>): StoryTurn {
  return turnById(s, run.path[run.path.length - 1]) ?? s.turns[0];
}

/** The number of turns on the longest way from this turn to an end, this turn included. */
export function longestPath(s: SpeechStory, id: string, seen: readonly string[] = []): number {
  const turn = turnById(s, id);
  if (!turn || seen.includes(id)) return 0;
  return 1 + Math.max(0, ...turn.branches.map((b) => (b.next ? longestPath(s, b.next, [...seen, id]) : 0)));
}

/** The header counter: this turn over what was answered plus the longest way still ahead (a finished run: all of it). */
export function progressOf(s: SpeechStory, run: Pick<StoryRun, 'path' | 'answers' | 'done'>): { n: number; total: number } {
  const answered = run.answers.length;
  if (run.done) return { n: answered, total: answered };
  return { n: answered + 1, total: answered + longestPath(s, run.path[run.path.length - 1]) };
}

/** Her reaction to the right answer before turn `n` (none for a given-up turn, and none before a question about her: that is the app's). */
function reactionBefore(s: SpeechStory, run: Pick<StoryRun, 'path' | 'answers'>, n: number): StoryText | undefined {
  const turn = turnById(s, run.path[n]) ?? s.turns[0];
  const before = n > 0 ? run.answers[n - 1] : undefined;
  return before?.ok && !turn.recall ? turnById(s, run.path[n - 1])?.branches[before.branch]?.reply : undefined;
}

/** The text of bubble `n` in one language as the voice reads it: her reaction to the right answer before it, then the line of the turn. */
export function bubbleOf(s: SpeechStory, run: Pick<StoryRun, 'path' | 'answers'>, n: number, lang: Lang): string {
  const turn = turnById(s, run.path[n]) ?? s.turns[0];
  const reply = reactionBefore(s, run, n);
  return reply ? `${reply[lang]} ${turn[lang]}` : turn[lang];
}

/**
 * What the screen shows for turn `n`: a turn with a scene shows her reaction as its own bubble first (then the scene, then the line),
 * so the scene never comes between an answer and her reaction to it; any other turn is one bubble, as `bubbleOf`.
 */
export function splitBubble(s: SpeechStory, run: Pick<StoryRun, 'path' | 'answers'>, n: number, lang: Lang): { reply: string | null; line: string } {
  const turn = turnById(s, run.path[n]) ?? s.turns[0];
  const reply = reactionBefore(s, run, n);
  if (reply && turn.scene) return { reply: reply[lang], line: turn[lang] };
  return { reply: null, line: bubbleOf(s, run, n, lang) };
}

/** Her last words after the final right answer (a branch with a reply and no next turn), or null: shown as a closing bubble. */
export function closingOf(s: SpeechStory, run: Pick<StoryRun, 'path' | 'answers' | 'done'>, lang: Lang): string | null {
  const last = run.answers[run.answers.length - 1];
  if (!run.done || !last?.ok) return null;
  return currentTurn(s, run).branches[last.branch]?.reply?.[lang] ?? null;
}

/** A `say` line as the voice reads it: the blank is left out (its space stays: "Soy de ." is the text the recordings pack holds). */
export const speakable = (text: string): string => text.replace(/_{3}/g, '').trim();

/** A fresh run of the story. */
export function startStory(s: SpeechStory, mode: AnswerMode): StoryRun {
  return { id: s.id, mode, path: [s.turns[0].id], tries: 0, firstTry: 0, answers: [], backs: [], done: false };
}

/** The ask-backs made on the turn on screen. */
export const backsOn = (run: Pick<StoryRun, 'path' | 'backs'>): number => run.backs.filter((b) => b.at === run.path.length - 1).length;

/** Lower case without accents and punctuation: how an ask-back phrase is compared (typed or spoken, accents never count). */
const plain = (text: string): string =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[¿?¡!.,;:„“”"]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * What was said, judged against a turn: the first real branch (data order) with a right match gives `branch`. An ask-back fires only
 * when no real branch matches and the whole utterance is its phrase (so "Tengo 30 años, ¿y tú?" is the answer, and "Cómo" or "Qué"
 * inside a real answer is not an ask-back); its phrases ignore accents also when typed. `noBack` once the turn has had MAX_BACKS.
 * When nothing matches, `branch` is null and the match is the closest answer over the real branches (its red words).
 */
export function judgeAnswer(
  turn: StoryTurn,
  said: string,
  options: { lang: 'es'; strictAccents?: boolean; noBack?: boolean },
): { branch: number | null; match: SpokenMatch } {
  const { noBack, ...spoken } = options;
  for (let i = 0; i < turn.branches.length; i++) {
    if (turn.branches[i].back) continue;
    const match = matchSpoken(said, turn.branches[i].answers, { ...spoken, anyNumber: turn.branches[i].anyNumber });
    if (match.right) return { branch: i, match };
  }
  if (!noBack) {
    const heard = plain(said);
    const i = turn.branches.findIndex((b) => b.back && b.answers.some((a) => plain(a) === heard));
    if (i >= 0) return { branch: i, match: matchSpoken(said, turn.branches[i].answers, { ...spoken, strictAccents: false }) };
  }
  const own = turn.branches.filter((b) => !b.back);
  return { branch: null, match: matchSpoken(said, own.flatMap((b) => b.answers), { ...spoken, anyNumber: own.some((b) => b.anyNumber) }) };
}

function advance(state: StoryRun, s: SpeechStory, answer: StoryAnswer, firstTry: number): StoryRun {
  const next = currentTurn(s, state).branches[answer.branch]?.next;
  return { ...state, path: next ? [...state.path, next] : state.path, tries: 0, firstTry, answers: [...state.answers, answer], done: !next };
}

/**
 * The learner's answer to the current turn: `branch` = the branch it matched, null = wrong. Right: it goes into the answers, the story
 * follows the branch (a point when it was the first try), a branch without `next` ends the run. Wrong: one more try, nothing else.
 */
export function answerTurn(state: StoryRun, s: SpeechStory, { branch, text }: { branch: number | null; text: string }): StoryRun {
  if (state.done) return state;
  if (branch === null) return { ...state, tries: state.tries + 1 };
  if (currentTurn(s, state).branches[branch]?.back) {
    // asking back: she answers and the turn stands; over MAX_BACKS it is not an answer (one more wrong try)
    if (backsOn(state) >= MAX_BACKS) return { ...state, tries: state.tries + 1 };
    return { ...state, backs: [...state.backs, { at: state.path.length - 1, text, branch }] };
  }
  return advance(state, s, { text, ok: true, branch }, state.firstTry + (state.tries === 0 ? 1 : 0));
}

/** Next after MAX_TRIES wrong tries: the first `say` line of the main branch goes into the answers (given up), and the story follows that branch. */
export function skipTurn(state: StoryRun, s: SpeechStory): StoryRun {
  if (state.done || state.tries < MAX_TRIES) return state;
  const turn = currentTurn(s, state);
  const branch = turn.main ?? Math.max(0, turn.branches.findIndex((b) => !b.back));
  return advance(state, s, { text: turn.branches[branch].say[0][s.target], ok: false, branch }, state.firstTry);
}

/** How the learner answers: the run changes, nothing else does. */
export function setMode(state: StoryRun, mode: AnswerMode): StoryRun {
  return state.mode === mode ? state : { ...state, mode };
}

/** What goes into the resume store. */
export function savedRun(state: StoryRun): unknown {
  return { v: 3, ...state };
}

const isCount = (x: unknown, max = Infinity): x is number => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= max;

/** A saved run back, or null when it is broken (also a run saved by an older version, v 1 or 2), is of a story that is gone, or does not fit the story's graph any more. */
export function parseRun(raw: unknown, stories: readonly SpeechStory[]): StoryRun | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const s = stories.find((x) => x.id === r.id);
  if (!s || r.v !== 3 || (r.mode !== 'voice' && r.mode !== 'type') || typeof r.done !== 'boolean') return null;
  if (!isCount(r.tries) || !Array.isArray(r.path) || !Array.isArray(r.answers)) return null;
  const path = r.path as unknown[];
  if (path.length === 0 || path[0] !== s.turns[0].id || !path.every((id) => typeof id === 'string' && turnById(s, id))) return null;
  // an open run has the turn on screen at the end of its path, a finished one has an answer for every turn of it
  if (r.answers.length !== (r.done ? path.length : path.length - 1)) return null;
  const answers: StoryAnswer[] = [];
  for (let i = 0; i < r.answers.length; i++) {
    const x = r.answers[i] as Record<string, unknown> | null;
    if (typeof x !== 'object' || x === null || typeof x.text !== 'string' || typeof x.ok !== 'boolean' || !isCount(x.branch)) return null;
    const branch = turnById(s, path[i] as string)?.branches[x.branch];
    if (!branch) return null;
    // the next turn of the path is the one the answered branch leads to; a finished run ends on a branch without one
    if (i + 1 < path.length ? branch.next !== path[i + 1] : branch.next !== undefined) return null;
    answers.push({ text: x.text, ok: x.ok, branch: x.branch });
  }
  // a point is a right answer, so there cannot be more points than right answers
  if (!isCount(r.firstTry, answers.filter((a) => a.ok).length)) return null;
  // the ask-backs (a run saved before them has none): each on a turn of the path and an ask-back branch of it, at most MAX_BACKS a turn
  const backs: StoryBack[] = [];
  if (r.backs !== undefined) {
    if (!Array.isArray(r.backs)) return null;
    for (const raw of r.backs as unknown[]) {
      const x = raw as Record<string, unknown> | null;
      if (typeof x !== 'object' || x === null || typeof x.text !== 'string' || !isCount(x.at, path.length - 1) || !isCount(x.branch)) return null;
      if (!turnById(s, path[x.at] as string)?.branches[x.branch]?.back) return null;
      backs.push({ at: x.at, text: x.text, branch: x.branch });
    }
    if (backs.some((b) => backs.filter((o) => o.at === b.at).length > MAX_BACKS)) return null;
  }
  return { id: s.id, mode: r.mode, path: path as string[], tries: r.tries, firstTry: r.firstTry, answers, backs, done: r.done };
}

/** What the `game_progress` row of a finished story holds. */
export interface StoryProgress {
  /** The best number of answers right the first time. */
  best: number;
  total: number;
  /** `localDateString()` of the last finish. */
  at: string;
}

/**
 * The row data after a run finished. `best` and `total` are a pair from one run (shown as that run's x/y): they are replaced only by a
 * run with a higher share of right answers, never by one with more points on a longer way (a story has paths of different length, and
 * a row saved before the stories grew must not be unbeatable). `previous` = the data of the row so far (anything broken counts as none).
 */
export function finishedProgress(previous: unknown, run: Pick<StoryRun, 'firstTry'>, total: number, at: string): StoryProgress {
  const was = previous as Partial<StoryProgress> | null;
  if (typeof was === 'object' && was !== null && isCount(was.best) && isCount(was.total) && was.total > 0 && run.firstTry * was.total <= was.best * total) {
    return { best: was.best, total: was.total, at };
  }
  return { best: run.firstTry, total, at };
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
