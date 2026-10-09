// The grammar
// end-of-lesson test. 10 questions from the lesson's OWN items (the lesson's sentences are allowed),
// of mixed kinds; the pass mark is 80% (as for the level exam); the test does NOT count toward the lesson's
// % (lib/grammar/lessonScore.ts), it gets a separate "Test passed" badge; failing locks nothing.
//
// Storage is in the existing `grammar-course` game_progress table, one row per lesson:
//   `${topic}:lessontest`  state 'passed' | 'failed'  data LessonTestResult
// `lessonScoresByTopic` (lesson %) and `doneGrammarTopicProgress` (done flag) do not read this row
// (different row shape, different state), so the test does not affect the lesson's %. No new table.

import { examPassed, EXAM_PASS_PCT } from '@/lib/exam/score';
import {
  isFormItem,
  isMarkItem,
  isMatchItem,
  isOrderItem,
  isSpotItem,
  isTransformItem,
  isTrialItem,
  isWhyItem,
  type GrammarKind,
  type GrammarTopicData,
} from '@/lib/games/content';
import { buildGrammarRound, grammarRoundItemKind, isChoiceRoundItem, type GrammarRoundItem } from '@/lib/games/grammarChoice';
import { scoredKinds } from '@/lib/grammar/syllabus';
import { kindProgressFromRows } from '@/lib/grammar/lessonScore';
import { TENSE_NAMES } from '@/lib/grammar/lessonTypes';
import { t } from '@/lib/i18n';
import { tileWords } from '@/lib/sentenceCards';
import { hashString, shuffleArray, shuffleOptions } from '@/lib/shuffle';
import { fixedSentence } from '@/components/grammar/NewKinds';

export const LESSON_TEST_SIZE = 10;
export const LESSON_TEST_PASS_PCT = EXAM_PASS_PCT;

const KEY_SUFFIX = ':lessontest';
export const lessonTestKey = (topicId: string) => `${topicId}${KEY_SUFFIX}`;

/** The saved test result of one lesson. */
export interface LessonTestResult {
  /** Whether it has been passed at least once (a retry does not take this away). */
  passed: boolean;
  /** The best score, whole percent. */
  best: number;
  bestAt: string;
  /** The score of the latest attempt, whole percent. */
  last: number;
  lastAt: string;
  /** Ids of the items missed in the latest attempt: the next attempt pulls these forward. */
  missed: string[];
}

type Row = { itemId: string; state: string; data: unknown };

function isResult(data: unknown): data is LessonTestResult {
  const d = data as Partial<LessonTestResult> | null | undefined;
  return !!d && typeof d.passed === 'boolean' && typeof d.best === 'number' && typeof d.last === 'number';
}

/** Merges a new attempt into the earlier result: the pass and the best score are not lost. */
export function mergeLessonTestResult(
  prev: LessonTestResult | null | undefined,
  correct: number,
  total: number,
  date: string,
  missed: string[]
): LessonTestResult {
  const pct = total > 0 ? Math.floor((correct * 100) / total) : 0;
  const passed = examPassed(correct, total);
  if (!prev) return { passed, best: pct, bestAt: date, last: pct, lastAt: date, missed };
  const better = pct > prev.best;
  return {
    passed: prev.passed || passed,
    best: better ? pct : prev.best,
    bestAt: better ? date : prev.bestAt,
    last: pct,
    lastAt: date,
    missed,
  };
}

/** A lesson's test result from the progress rows, or null if it has not been tested yet. */
export function lessonTestFromRows(rows: Row[], topicId: string): LessonTestResult | null {
  const key = lessonTestKey(topicId);
  for (const row of rows) {
    if (row.itemId === key && isResult(row.data)) return row.data;
  }
  return null;
}

/** The lessons whose test the learner has passed (for the syllabus list's "Test passed" badge). */
export function lessonTestPassedTopics(rows: Row[]): Set<string> {
  const out = new Set<string>();
  for (const row of rows) {
    if (!row.itemId.endsWith(KEY_SUFFIX) || !isResult(row.data) || !row.data.passed) continue;
    out.add(row.itemId.slice(0, -KEY_SUFFIX.length));
  }
  return out;
}

function hadRound(rows: Row[], topicId: string, kind: GrammarKind): boolean {
  const p = kindProgressFromRows(rows, topicId, kind);
  if (p.best || p.legacy) return true;
  // The "done" row: `${topic}:${kind}` (a round of >= 80%) or the old whole-lesson row (`${topic}`).
  return rows.some((r) => r.state === 'done' && (r.itemId === `${topicId}:${kind}` || r.itemId === topicId));
}

/** The test button is enabled once there has been a completed round of EVERY exercise kind of the lesson (the ones counting toward the %). */
export function lessonTestUnlocked(lesson: GrammarTopicData, rows: Row[], topicId: string): boolean {
  const kinds = scoredKinds(lesson);
  return kinds.length > 0 && kinds.every((k) => hadRound(rows, topicId, k));
}

// ---------------------------------------------------------------------------
// The questions. The lesson items appear on the exam cards (components/exam/*): there,
// a correct answer gets no feedback and after a wrong one the correct answer is shown; the explanation
// (the lesson's `why`) comes on the result sheet for the missed items.

export type LessonTestView =
  | { card: 'choice'; heading: string; text: string; options: string[]; correctIndex: number }
  | { card: 'type'; prompt: string; hint?: string; answer: string; accept?: string[]; sentence: boolean }
  | { card: 'tiles'; prompt: string; answerTokens: string[]; sentence: string }
  | { card: 'match'; pairs: { left: string; right: string }[] };

export interface LessonTestQuestion {
  id: string;
  kind: GrammarKind;
  view: LessonTestView;
  /** The result sheet row: what was asked, what is correct (empty: no single answer), and why. */
  review: { question: string; answer: string; why?: string };
}

interface Ctx {
  topic: GrammarTopicData;
  learnedLang: string;
  contentLang: string;
  seed: number;
}

function toQuestion(r: GrammarRoundItem, ctx: Ctx): LessonTestQuestion | null {
  const s = t();
  const kind = grammarRoundItemKind(r);
  const pick = (l: Record<string, string>) => l[ctx.contentLang] ?? l.en;
  const optionSeed = (id: string) => hashString(`${ctx.topic.topic}:${id}:${ctx.seed}:test`);

  if (isChoiceRoundItem(r)) {
    const it = r.item;
    if (r.options.length < 2 || r.correctIndex < 0) return null;
    if (isMarkItem(it)) {
      return {
        id: it.id,
        kind,
        view: {
          card: 'choice',
          heading: s.games.grammarChoice.markPrompt(s.games.grammarChoice.wordClass[it.target] ?? it.target),
          text: it.sentence,
          options: r.options,
          correctIndex: r.correctIndex,
        },
        review: { question: it.sentence, answer: r.options[r.correctIndex], why: pick(it.why) },
      };
    }
    if (!it.sentence.includes('___')) return null;
    return {
      id: it.id,
      kind,
      view: { card: 'choice', heading: s.exam.chooseGap, text: it.sentence, options: r.options, correctIndex: r.correctIndex },
      review: { question: it.sentence, answer: it.sentence.replace('___', r.options[r.correctIndex]), why: pick(it.why) },
    };
  }

  const item = r.item;
  if (isMatchItem(item)) {
    if (item.pairs.length < 2) return null;
    // The pair {es, en} is literally Spanish/English; the left side of the exam card is the LEARNED language.
    const learnedIsEn = ctx.learnedLang === 'en';
    const pairs = item.pairs.map((p) => ({ left: learnedIsEn ? p.en : p.es, right: learnedIsEn ? p.es : p.en }));
    return {
      id: item.id,
      kind,
      view: { card: 'match', pairs },
      review: { question: pairs.map((p) => `${p.left} = ${p.right}`).join(' · '), answer: '' },
    };
  }
  if (isFormItem(item)) {
    const table = ctx.topic.body.find((b) => b.kind === 'table' && b.id === item.table);
    const headerCell = table && table.kind === 'table' ? table.header.find((h) => h.es === item.verb) : undefined;
    const localized = headerCell ? pick(headerCell) : undefined;
    const verbLabel = localized && localized !== item.verb ? `${item.verb} (${localized})` : item.verb;
    const prompt = `${verbLabel} · ${item.person}`;
    return {
      id: item.id,
      kind,
      view: { card: 'type', prompt, hint: s.grammar.formHint, answer: item.answer, accept: item.accept, sentence: false },
      review: { question: prompt, answer: item.answer },
    };
  }
  if (isWhyItem(item)) {
    const sh = shuffleOptions(
      item.options.map((o) => pick(o.text)),
      item.correctIndex,
      optionSeed(item.id)
    );
    const heading = item.target ? s.games.grammarChoice.whyQuestion(item.target) : s.lessonTest.whyHeading;
    return {
      id: item.id,
      kind,
      view: { card: 'choice', heading, text: item.es, options: sh.options, correctIndex: sh.correctIndex },
      // The result sheet also shows the question text, not just the sentence.
      review: { question: `${heading}\n${item.es}`, answer: sh.options[sh.correctIndex], why: pick(item.tr) },
    };
  }
  if (isTransformItem(item)) {
    const tense = pick(TENSE_NAMES[item.tense.to]);
    return {
      id: item.id,
      kind,
      view: {
        card: 'type',
        prompt: item.prompt.es,
        hint: s.grammar.rewriteTo(`*${tense}*`),
        answer: item.answer,
        accept: item.accept,
        sentence: true,
      },
      review: { question: item.prompt.es, answer: item.answer, why: pick(item.why) },
    };
  }
  if (isSpotItem(item)) {
    const words = item.es.split(/\s+/).filter(Boolean);
    if (item.wrongIndex < 0 || item.wrongIndex >= words.length || item.options.length < 2) return null;
    const marked = words.map((w, i) => (i === item.wrongIndex ? `«${w}»` : w)).join(' ');
    const sh = shuffleOptions(
      item.options.map((o) => (o === '' ? s.grammar.spotDelete : o)),
      item.correctIndex,
      optionSeed(item.id)
    );
    return {
      id: item.id,
      kind,
      view: { card: 'choice', heading: s.grammar.spotPickFix, text: marked, options: sh.options, correctIndex: sh.correctIndex },
      review: {
        question: item.es,
        answer: fixedSentence(item.es, item.wrongIndex, item.options[item.correctIndex]),
        why: pick(item.explain),
      },
    };
  }
  if (isOrderItem(item)) {
    const answerTokens = tileWords(item.es);
    if (answerTokens.length < 2) return null;
    return {
      id: item.id,
      kind,
      view: { card: 'tiles', prompt: pick(item.prompt), answerTokens, sentence: item.es },
      review: { question: pick(item.prompt), answer: item.es },
    };
  }
  // Dictation would require listening, and the test (like the exam) runs without sound: it is left out.
  return null;
}

interface BuildLessonTestOptions {
  seed: number;
  learnedLang: string;
  contentLang: string;
  size?: number;
  /** Items missed in the previous attempt: they move to the front among the fresh items. */
  missedBefore?: ReadonlySet<string>;
  /** Items already asked (retry): the system draws from the not-yet-seen ones first, "10 new items". */
  avoid?: ReadonlySet<string>;
}

/**
 * The test: built from the lesson's items (without the temporary "NEW · TEST" items), cycling
 * through the kinds so it is mixed. Within a kind a fresh item precedes an already seen one, and within
 * that, one missed in the previous attempt precedes the rest. If the lesson has fewer items than `size`,
 * there are as many questions as there are items.
 */
export function buildLessonTest(lesson: GrammarTopicData, opts: BuildLessonTestOptions): LessonTestQuestion[] {
  const { seed, size = LESSON_TEST_SIZE, missedBefore, avoid } = opts;
  const ctx: Ctx = { topic: lesson, learnedLang: opts.learnedLang, contentLang: opts.contentLang, seed };

  const groups = new Map<GrammarKind, LessonTestQuestion[]>();
  for (const r of buildGrammarRound(lesson, seed)) {
    if (isTrialItem(r.item)) continue;
    const q = toQuestion(r, ctx);
    if (!q) continue;
    const list = groups.get(q.kind) ?? [];
    list.push(q);
    groups.set(q.kind, list);
  }

  const queues: LessonTestQuestion[][] = [];
  for (const kind of shuffleArray([...groups.keys()], seed)) {
    const shuffled = shuffleArray(groups.get(kind) ?? [], seed + hashString(kind));
    // rank: 0 fresh+missed, 1 fresh, 2 seen+missed, 3 seen (stable, sorted into buckets by hand)
    const buckets: LessonTestQuestion[][] = [[], [], [], []];
    for (const q of shuffled) buckets[(avoid?.has(q.id) ? 2 : 0) + (missedBefore?.has(q.id) ? 0 : 1)].push(q);
    queues.push(buckets.flat());
  }

  const picked: LessonTestQuestion[] = [];
  for (let round = 0; picked.length < size; round++) {
    let any = false;
    for (const queue of queues) {
      if (picked.length >= size) break;
      if (round < queue.length) {
        picked.push(queue[round]);
        any = true;
      }
    }
    if (!any) break;
  }
  return shuffleArray(picked, seed + 1);
}

/** How many questions the lesson's test has (for the line under the button): `LESSON_TEST_SIZE`, or fewer if the lesson has fewer items. */
export function lessonTestSize(lesson: GrammarTopicData, learnedLang: string, contentLang: string): number {
  return buildLessonTest(lesson, { seed: 1, learnedLang, contentLang }).length;
}
