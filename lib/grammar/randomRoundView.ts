import type { Level } from '@/data/words';
import { buildLessonTest, type LessonTestQuestion } from '@/lib/grammar/lessonTest';
import { getGrammarTier, lessonFor, type SyllabusTopic } from '@/lib/grammar/syllabus';
import {
  currentPhase,
  pickNext,
  skipPhase,
  type PickCtx,
  type RoundRun,
  type TopicEvidence,
} from '@/lib/grammar/randomRound';

// The non-visual parts of the random grammar round screen (app/grammar/random.tsx): the loaded data, the lazily built
// questions, the engine context, and the check-result / next-question steps the screen takes around the engine.

export interface RoundData {
  learnedLang: string;
  contentLang: string;
  /** The user's level as stored: the 💬 (FeedbackModal) writes this into the Feedback sheet. */
  userLevel: string;
  /** The syllabus levels of the learned language, in order. */
  levels: Level[];
  startLevel: Level;
  /** The written lessons, in syllabus order. */
  topics: SyllabusTopic[];
  /** The questions built so far (lazily, per topic). */
  cache: QuestionCache;
}

/** The question cache of one round: the seed fixes the option order, so a new seed (a new round) empties it. */
export interface QuestionCache {
  seed: number;
  map: Map<string, LessonTestQuestion[]>;
}

// All usable questions of a topic, built lazily. A match card is left out (one card = many answers).
export function questionsOf(d: RoundData, seed: number, topicId: string): LessonTestQuestion[] {
  const cache = d.cache;
  if (cache.seed !== seed) {
    cache.seed = seed;
    cache.map = new Map();
  }
  let qs = cache.map.get(topicId);
  if (!qs) {
    const lesson = lessonFor(d.learnedLang, topicId);
    qs = lesson
      ? buildLessonTest(lesson, { seed, learnedLang: d.learnedLang, contentLang: d.contentLang, size: 9999 }).filter((q) => q.kind !== 'match')
      : [];
    cache.map.set(topicId, qs);
  }
  return qs;
}

export function makeCtx(d: RoundData, seed: number, evidence: Map<string, TopicEvidence>): PickCtx {
  return {
    levels: d.levels,
    topics: d.topics.map((tp) => ({ id: tp.id, level: tp.level, tier: getGrammarTier(tp.id) })),
    evidence,
    questionIds: (topicId) => questionsOf(d, seed, topicId).map((q) => ({ id: q.id, kind: q.kind })),
  };
}

// The check is over (or skipped) and the practice has not started: the check result is on screen. A finished round
// is only shown here when the check left no weak topic ("no weak topics"); with weak topics it ends on the end screen.
export function isResultPause(run: RoundRun): boolean {
  const phase = currentPhase(run);
  if (run.mode !== 'mixed' || run.pending !== null || phase === 'check' || (phase === 'done' && run.weak.length > 0)) return false;
  return run.steps.every((st) => st.phase === 'check');
}

// Puts the next question of the current phase on the screen (`pending`); a phase with no unused question is
// passed over. Passing over the check of a mixed round stops there: the check result comes first.
export function advance(run: RoundRun, ctx: PickCtx): RoundRun {
  let r = run;
  for (let i = 0; i < 6; i++) {
    const phase = currentPhase(r);
    if (phase === 'done') return r;
    const pick = pickNext(r, ctx);
    if (pick) return { ...r, pending: pick };
    r = skipPhase(r, ctx);
    if (r.mode === 'mixed' && phase === 'check') return r;
  }
  return r;
}
