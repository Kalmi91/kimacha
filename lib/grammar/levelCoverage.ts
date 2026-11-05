// Level test coverage measurement (FB595, FB597, FB598): drives the REAL picker (pickLevelNext) over the REAL course data
// with simulated learners, and plays every question with its own right answer. Pure helpers, used by the jest test
// lib/grammar/__tests__/levelCoverage.test.ts and printed by scripts/level-coverage.mjs.

import type { Level } from '@/data/words';
import { kindsOfCtx, pickLevelNext } from '@/lib/grammar/levelTest';
import { levelTestCtx } from '@/lib/grammar/levelTestView';
import { appendEvidence, topicTicked, type TopicEvidence } from '@/lib/grammar/randomRound';
import { questionsOf, type RoundData } from '@/lib/grammar/randomRoundView';
import { hasLesson, syllabusForLevel, syllabusLevels } from '@/lib/grammar/syllabus';
import { gradePcicAnswer, gradeSentenceAnswer, suggestedGrade } from '@/lib/pcicMatch';
import { sentenceBuildMatch, strictAnswerMatch } from '@/lib/answerMatch';
import { stripSentencePunct } from '@/lib/sentenceCards';
import type { LessonTestQuestion } from '@/lib/grammar/lessonTest';

export const CHECKPOINTS = [20, 40, 100, 500] as const;

export function levelData(lang: string, level: Level): RoundData {
  const levels = syllabusLevels(lang);
  return {
    learnedLang: lang,
    contentLang: lang === 'en' ? 'es' : 'en',
    userLevel: level,
    levels,
    startLevel: level,
    topics: syllabusForLevel(level, lang).filter((tp) => hasLesson(lang, tp.id)),
    cache: { seed: -1, map: new Map() },
  };
}

/** Small deterministic PRNG, so the simulated learners are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TopicStat {
  id: string;
  tier: string;
  available: number;
  /** Times asked within the first 20, 40, 100 and 500 answers. */
  asked: number[];
}

export interface SimResult {
  topics: TopicStat[];
  /** The asked topic ids and question ids, in order. */
  steps: { topicId: string; qid: string; /** A core topic was still open (not ticked) when this question was picked. */ coreOpen: boolean; /** How many topics took turns when this question was picked. */ pool: number }[];
  /** Per topic the first step where a question came back before every question of the topic was asked. */
  earlyRepeats: { topicId: string; step: number; available: number }[];
}

export interface SimOptions {
  /** Stored evidence the learner comes with (a returning learner); default none. */
  start?: Map<string, TopicEvidence>;
  /** Every this many answers the learner leaves and comes back: a new seed (new option order), a new question cache, no previous topic. */
  visitEvery?: number;
}

/** Evidence of a learner who answered 10 questions of every topic but the first core one (never asked), the stamps rising topic by topic. */
export function unevenStart(d: RoundData, level: Level, seed: number): Map<string, TopicEvidence> {
  const ev = new Map<string, TopicEvidence>();
  let stamp = 1;
  const topics = levelTestCtx(d, seed, level, ev).topics;
  const skipped = topics.find((tp) => tp.tier === 'core' || tp.tier === 'core-plus');
  topics.filter((tp) => tp !== skipped).forEach((tp) => {
    let e: TopicEvidence | undefined;
    questionsOf(d, seed, tp.id).slice(0, 10).forEach((q, i) => {
      e = appendEvidence(e, { id: q.id, kind: q.kind, ok: i % 3 !== 0, at: '2026-11-01' }, stamp++);
    });
    if (e) ev.set(tp.id, e);
  });
  return ev;
}

/** A learner who answers right with probability `pRight`, 500 answers by default, through the real picker. */
export function simulate(d: RoundData, level: Level, pRight: number, seed: number, answers = 500, opts: SimOptions = {}): SimResult {
  const rand = rng(seed);
  let evidence = new Map(opts.start ?? []);
  let visitSeed = seed;
  let ctx = levelTestCtx(d, visitSeed, level, evidence);
  const steps: SimResult['steps'] = [];
  let prev: string | undefined;
  for (let i = 0; i < answers; i++) {
    if (opts.visitEvery && i > 0 && i % opts.visitEvery === 0) {
      visitSeed = seed + i * 7919;
      d.cache = { seed: -1, map: new Map() };
      prev = undefined;
      ctx = levelTestCtx(d, visitSeed, level, evidence);
    }
    const kindsOf = kindsOfCtx(ctx);
    const openOf = (core: boolean) => ctx.topics.filter((tp) => (tp.tier === 'core' || tp.tier === 'core-plus') === core && !topicTicked(evidence.get(tp.id), () => kindsOf(tp.id))).length;
    const coreOpen = openOf(true) > 0;
    const pool = coreOpen ? openOf(true) : openOf(false) || ctx.topics.length;
    const next = pickLevelNext(ctx, prev, visitSeed + i);
    if (!next) break;
    const q = questionsOf(d, visitSeed, next.topicId).find((x) => x.id === next.qid)!;
    const ok = rand() < pRight;
    const ids = ctx.questionIds(next.topicId).map((x) => x.id);
    evidence = new Map(evidence).set(next.topicId, appendEvidence(evidence.get(next.topicId), { id: q.id, kind: q.kind, ok, at: '2026-11-05' }, 1_000_000 + i, ids));
    ctx = levelTestCtx(d, visitSeed, level, evidence);
    steps.push({ ...next, coreOpen, pool });
    prev = next.topicId;
  }
  const topics: TopicStat[] = ctx.topics.map((tp) => ({
    id: tp.id,
    tier: tp.tier,
    available: ctx.questionIds(tp.id).length,
    asked: CHECKPOINTS.map((n) => steps.slice(0, n).filter((s) => s.topicId === tp.id).length),
  }));
  const seen = new Map<string, Set<string>>();
  const earlyRepeats: SimResult['earlyRepeats'] = [];
  const flagged = new Set<string>();
  steps.forEach((s, i) => {
    const set = seen.get(s.topicId) ?? new Set<string>();
    const available = ctx.questionIds(s.topicId).length;
    if (set.has(s.qid) && set.size < available && !flagged.has(s.topicId)) {
      flagged.add(s.topicId);
      earlyRepeats.push({ topicId: s.topicId, step: i + 1, available });
    }
    set.add(s.qid);
    seen.set(s.topicId, set);
  });
  return { topics, steps, earlyRepeats };
}

/** The question's own right answer is accepted, the wrong options are rejected; returns the failure reasons (empty = playable). */
export function playQuestion(q: LessonTestQuestion, learnedLang: string, strictAccents = false): string[] {
  const out: string[] = [];
  const v = q.view;
  if (v.card === 'choice') {
    if (!v.text.trim() && !v.heading.trim()) out.push('empty prompt');
    if (v.options.length < 2) out.push('fewer than 2 options');
    if (v.correctIndex < 0 || v.correctIndex >= v.options.length) out.push('correctIndex out of range');
    if (new Set(v.options).size !== v.options.length) out.push('duplicate options');
    if (v.options.some((o) => !o.trim())) out.push('empty option');
  } else if (v.card === 'type') {
    if (!v.prompt.trim()) out.push('empty prompt');
    const grade = (typed: string, target: string) => {
      if (v.keepUmlauts && learnedLang === 'de') return strictAnswerMatch(typed, target, { lang: 'de', keepUmlauts: true, strictAccents });
      const g = v.sentence
        ? gradeSentenceAnswer(stripSentencePunct(typed), stripSentencePunct(target), strictAccents, learnedLang)
        : gradePcicAnswer(typed, target, strictAccents, learnedLang);
      return suggestedGrade(g) === 'good';
    };
    const targets = [v.answer, ...(v.accept ?? [])];
    if (!v.answer.trim()) out.push('empty answer');
    else if (!targets.some((tg) => grade(v.answer, tg))) out.push('own answer rejected');
    if (v.accept?.some((a) => !grade(a, a))) out.push('accept entry rejected');
    if (grade('zzzz qqqq', v.answer)) out.push('nonsense accepted');
  } else if (v.card === 'tiles') {
    if (!v.prompt.trim()) out.push('empty prompt');
    if (v.answerTokens.length < 2) out.push('fewer than 2 tiles');
    else if (!sentenceBuildMatch(v.answerTokens, v.answerTokens)) out.push('own answer rejected');
  }
  return out;
}

export interface PlayFailure {
  topicId: string;
  qid: string;
  kind: string;
  reasons: string[];
}

export function playAll(d: RoundData, level: Level, seed: number): { played: number; failures: PlayFailure[] } {
  const failures: PlayFailure[] = [];
  let played = 0;
  for (const tp of d.topics.filter((x) => x.level === level)) {
    for (const q of questionsOf(d, seed, tp.id)) {
      played++;
      const reasons = playQuestion(q, d.learnedLang);
      if (reasons.length > 0) failures.push({ topicId: tp.id, qid: q.id, kind: q.kind, reasons });
    }
  }
  return { played, failures };
}

/** Syllabus topics of the level without a lesson or without any usable question. */
export function emptyTopics(d: RoundData, lang: string, level: Level): { id: string; reason: string }[] {
  const out: { id: string; reason: string }[] = [];
  for (const tp of syllabusForLevel(level, lang)) {
    if (!hasLesson(lang, tp.id)) out.push({ id: tp.id, reason: 'no lesson' });
    else if (questionsOf(d, 1, tp.id).length === 0) out.push({ id: tp.id, reason: 'no usable question' });
  }
  return out;
}
