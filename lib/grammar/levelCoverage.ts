// Level test coverage measurement (FB595, FB597, FB598): drives the REAL picker (pickLevelNext) over the REAL course data
// with simulated learners, and plays every question with its own right answer. Pure helpers, used by the jest test
// lib/grammar/__tests__/levelCoverage.test.ts and printed by scripts/level-coverage.mjs.

import type { Level } from '@/data/words';
import { pickLevelNext } from '@/lib/grammar/levelTest';
import { levelTestCtx } from '@/lib/grammar/levelTestView';
import { appendEvidence, type TopicEvidence } from '@/lib/grammar/randomRound';
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
  steps: { topicId: string; qid: string }[];
  /** Per topic the first step where a question came back before every question of the topic was asked. */
  earlyRepeats: { topicId: string; step: number; available: number }[];
}

/** A learner who answers right with probability `pRight`, 500 answers by default, through the real picker. */
export function simulate(d: RoundData, level: Level, pRight: number, seed: number, answers = 500): SimResult {
  const rand = rng(seed);
  let evidence = new Map<string, TopicEvidence>();
  let ctx = levelTestCtx(d, seed, level, evidence);
  const steps: { topicId: string; qid: string }[] = [];
  let prev: string | undefined;
  for (let i = 0; i < answers; i++) {
    const next = pickLevelNext(ctx, prev, seed + i);
    if (!next) break;
    const q = questionsOf(d, seed, next.topicId).find((x) => x.id === next.qid)!;
    const ok = rand() < pRight;
    evidence = new Map(evidence).set(next.topicId, appendEvidence(evidence.get(next.topicId), { id: q.id, kind: q.kind, ok, at: '2026-11-05' }));
    ctx = levelTestCtx(d, seed, level, evidence);
    steps.push(next);
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
