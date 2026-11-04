// The random grammar round engine: thresholds, tick, window, ladder, mode, weak topics, picking, phases.

import type { Level } from '@/data/words';
import type { GrammarKind } from '@/lib/games/content';
import {
  CHECK_SIZE,
  EVIDENCE_WINDOW,
  FULL_SIZE,
  MAX_WEAK_TOPICS,
  PRACTICE_SIZE,
  appendEvidence,
  badgeForTopic,
  currentPhase,
  evidenceFromRows,
  ladderIndex,
  ladderLevel,
  metaFromRows,
  newRun,
  nextMode,
  otherWrongTopics,
  overallScore,
  phaseProgress,
  pickNext,
  recordAnswer,
  runFromRows,
  skipPhase,
  topicPercent,
  topicTicked,
  weakTopicCount,
  type EvidenceAnswer,
  type PickCtx,
  type PickTopic,
  type RoundRun,
  type RoundStep,
  type TopicEvidence,
} from '../randomRound';

const LEVELS: Level[] = ['A1', 'A2', 'B1'];
const KINDS: GrammarKind[] = ['choice', 'form', 'why'];
const TOPICS: PickTopic[] = [
  { id: 'a1-x', level: 'A1', tier: 'core-plus' },
  { id: 'a1-y', level: 'A1', tier: 'core' },
  { id: 'a1-z', level: 'A1', tier: 'exam' },
  { id: 'a2-x', level: 'A2', tier: 'core' },
  { id: 'a2-y', level: 'A2', tier: 'full' },
  { id: 'b1-x', level: 'B1', tier: 'exam' },
  { id: 'b1-y', level: 'B1', tier: 'perfect' },
];

const answer = (ok: boolean, kind: GrammarKind = 'choice', id = 'q', at = '2026-11-01'): EvidenceAnswer => ({ id, kind, ok, at });

/** Evidence from a list of ok flags; the kinds cycle through `kinds` (default: choice only). */
function ev(oks: boolean[], kinds: GrammarKind[] = ['choice']): TopicEvidence {
  return { answers: oks.map((ok, i) => answer(ok, kinds[i % kinds.length], `e${i}`)) };
}

function questionsOf(topicId: string, n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `${topicId}#${i}`, kind: KINDS[i % KINDS.length] }));
}

function makeCtx(opts: { topics?: PickTopic[]; evidence?: Map<string, TopicEvidence>; n?: number; counts?: Record<string, number> } = {}): PickCtx {
  const n = opts.n ?? 8;
  return {
    levels: LEVELS,
    topics: opts.topics ?? TOPICS,
    evidence: opts.evidence ?? new Map(),
    questionIds: (id) => questionsOf(id, opts.counts?.[id] ?? n),
  };
}

function step(over: Partial<RoundStep> = {}): RoundStep {
  return { topicId: 'a1-x', qid: 'a1-x#0', kind: 'choice', level: 'A1', phase: 'check', ok: true, ...over };
}

/** n check steps; ok flags and topics cycle, the qids are unique. */
function checkSteps(oks: boolean[], topics: string[] = ['a1-x']): RoundStep[] {
  return oks.map((ok, i) => step({ ok, topicId: topics[i % topics.length], qid: `chk${i}` }));
}

function runWith(over: Partial<RoundRun> = {}): RoundRun {
  return { ...newRun('mixed', 100, 'A1'), ...over };
}

// Plays like the screen: pick, skip an empty phase, answer (evidence first), until the round is done.
function playRound(
  start: RoundRun,
  ctx: PickCtx,
  okFn: (topicId: string, run: RoundRun) => boolean = () => true,
  onPick?: (pick: { topicId: string; qid: string }, run: RoundRun) => void,
): RoundRun {
  let run = start;
  for (let guard = 0; currentPhase(run) !== 'done'; guard++) {
    if (guard > 500) throw new Error('round did not finish');
    const pick = pickNext(run, ctx);
    if (!pick) {
      run = skipPhase(run, ctx);
      continue;
    }
    onPick?.(pick, run);
    const topic = ctx.topics.find((t) => t.id === pick.topicId) as PickTopic;
    const q = ctx.questionIds(pick.topicId).find((x) => x.id === pick.qid);
    expect(q).toBeDefined();
    const ok = okFn(pick.topicId, run);
    ctx.evidence.set(pick.topicId, appendEvidence(ctx.evidence.get(pick.topicId), answer(ok, q!.kind, pick.qid)));
    run = recordAnswer(run, step({ topicId: pick.topicId, qid: pick.qid, kind: q!.kind, level: topic.level, phase: currentPhase(run) as 'check', ok }), ctx);
  }
  return run;
}

describe('topicPercent', () => {
  it('is null below 3 answers and a rounded percent from 3', () => {
    expect(topicPercent(undefined)).toBeNull();
    expect(topicPercent(ev([]))).toBeNull();
    expect(topicPercent(ev([true, false]))).toBeNull();
    expect(topicPercent(ev([true, false, true]))).toBe(67);
    expect(topicPercent(ev([false, false, false]))).toBe(0);
  });

  it('reads only the last EVIDENCE_WINDOW answers', () => {
    const oks = [...Array(5).fill(false), ...Array(EVIDENCE_WINDOW).fill(true)];
    expect(topicPercent(ev(oks))).toBe(100);
  });
});

describe('topicTicked', () => {
  it('needs 5 answers', () => {
    expect(topicTicked(ev([true, true, true, true], ['choice', 'form']))).toBe(false);
  });

  it('needs two different kinds', () => {
    expect(topicTicked(ev([true, true, true, true, true], ['choice']))).toBe(false);
  });

  it('is ticked at 80% with two kinds, not below 80%', () => {
    expect(topicTicked(ev([true, true, true, true, false], ['choice', 'form']))).toBe(true);
    expect(topicTicked(ev([true, true, true, false, false], ['choice', 'form']))).toBe(false);
    expect(topicTicked(undefined)).toBe(false);
  });
});

describe('appendEvidence', () => {
  it('starts a new topic and keeps the last EVIDENCE_WINDOW answers', () => {
    let e: TopicEvidence | undefined;
    for (let i = 0; i < EVIDENCE_WINDOW + 2; i++) e = appendEvidence(e, answer(true, 'choice', `q${i}`));
    expect(e!.answers).toHaveLength(EVIDENCE_WINDOW);
    expect(e!.answers[0].id).toBe('q2');
    expect(e!.answers[EVIDENCE_WINDOW - 1].id).toBe(`q${EVIDENCE_WINDOW + 1}`);
  });

  it('does not change the old evidence', () => {
    const old = ev([true]);
    appendEvidence(old, answer(false));
    expect(old.answers).toHaveLength(1);
  });
});

describe('rows', () => {
  it('evidenceFromRows reads only well-formed evidence rows of real topics', () => {
    const good = ev([true, false]);
    const map = evidenceFromRows([
      { itemId: 'a1-x', state: 'evidence', data: good },
      { itemId: 'a1-y', state: 'evidence', data: { answers: [{ id: 'q' }] } },
      { itemId: 'a1-z', state: 'evidence', data: null },
      { itemId: 'a2-x', state: 'other', data: good },
      { itemId: '_meta', state: 'evidence', data: good },
      { itemId: '_run', state: 'evidence', data: good },
    ]);
    expect([...map.keys()]).toEqual(['a1-x']);
    expect(map.get('a1-x')).toEqual(good);
  });

  it('metaFromRows defaults to 0 rounds', () => {
    expect(metaFromRows([])).toEqual({ rounds: 0 });
    expect(metaFromRows([{ itemId: '_meta', state: 'meta', data: { rounds: 'x' } }])).toEqual({ rounds: 0 });
    expect(metaFromRows([{ itemId: '_meta', state: 'meta', data: { rounds: 4 } }])).toEqual({ rounds: 4 });
  });

  it('runFromRows is null without a valid open run', () => {
    const run = runWith({ steps: checkSteps([true, false]), pending: { topicId: 'a1-x', qid: 'a1-x#3' } });
    expect(runFromRows([])).toBeNull();
    expect(runFromRows([{ itemId: '_run', state: 'none', data: null }])).toBeNull();
    expect(runFromRows([{ itemId: '_run', state: 'run', data: { mode: 'mixed' } }])).toBeNull();
    expect(runFromRows([{ itemId: '_run', state: 'run', data: { ...run, steps: [{ topicId: 'a1-x' }] } }])).toBeNull();
    expect(runFromRows([{ itemId: 'a1-x', state: 'run', data: run }])).toBeNull();
    expect(runFromRows([{ itemId: '_run', state: 'run', data: run }])).toEqual(run);
  });
});

describe('nextMode', () => {
  it('is full for the first round and every 5th, mixed otherwise', () => {
    expect(nextMode({ rounds: 0 })).toBe('full');
    for (const r of [1, 2, 3, 4]) expect(nextMode({ rounds: r })).toBe('mixed');
    expect(nextMode({ rounds: 5 })).toBe('full');
    expect(nextMode({ rounds: 6 })).toBe('mixed');
    expect(nextMode({ rounds: 10 })).toBe('full');
  });
});

describe('newRun', () => {
  it('starts empty', () => {
    expect(newRun('mixed', 7, 'A2')).toEqual({ mode: 'mixed', seed: 7, startLevel: 'A2', steps: [], pending: null, weak: [], before: {}, skipped: [] });
  });
});

describe('ladder', () => {
  it('starts at the start level, 0 when it is not in the list', () => {
    expect(ladderIndex(runWith({ startLevel: 'A2' }), LEVELS)).toBe(1);
    expect(ladderIndex(runWith({ startLevel: 'C2' }), LEVELS)).toBe(0);
  });

  it('goes up after 2 correct in a row, not after 1', () => {
    expect(ladderIndex(runWith({ startLevel: 'A1', steps: checkSteps([true]) }), LEVELS)).toBe(0);
    expect(ladderIndex(runWith({ startLevel: 'A1', steps: checkSteps([true, true]) }), LEVELS)).toBe(1);
    expect(ladderIndex(runWith({ startLevel: 'A1', steps: checkSteps([true, true, true]) }), LEVELS)).toBe(1);
    expect(ladderIndex(runWith({ startLevel: 'A1', steps: checkSteps([true, true, true, true]) }), LEVELS)).toBe(2);
  });

  it('goes down on a wrong answer and the streak starts again', () => {
    expect(ladderIndex(runWith({ startLevel: 'A2', steps: checkSteps([false]) }), LEVELS)).toBe(0);
    expect(ladderIndex(runWith({ startLevel: 'B1', steps: checkSteps([true, false, true]) }), LEVELS)).toBe(1);
  });

  it('stops at the ceiling and the floor', () => {
    expect(ladderIndex(runWith({ startLevel: 'B1', steps: checkSteps([true, true, true, true]) }), LEVELS)).toBe(2);
    expect(ladderIndex(runWith({ startLevel: 'A1', steps: checkSteps([false, false, false]) }), LEVELS)).toBe(0);
    expect(ladderLevel(runWith({ startLevel: 'A1', steps: checkSteps([true, true, true, true, true, true]) }), LEVELS)).toBe('B1');
  });

  it('counts only the check steps', () => {
    const steps = [...checkSteps([true, true]), step({ phase: 'practice', ok: false, qid: 'p1' }), step({ phase: 'recheck', ok: false, qid: 'r1' })];
    expect(ladderLevel(runWith({ startLevel: 'A1', steps }), LEVELS)).toBe('A2');
  });
});

describe('currentPhase and phaseProgress', () => {
  it('full: 20 steps, then done; a skipped full phase is done', () => {
    const full = newRun('full', 1, 'A1');
    expect(currentPhase(full)).toBe('full');
    const fullSteps = Array.from({ length: FULL_SIZE }, (_, i) => step({ phase: 'full', qid: `f${i}` }));
    expect(currentPhase({ ...full, steps: fullSteps.slice(0, FULL_SIZE - 1) })).toBe('full');
    expect(currentPhase({ ...full, steps: fullSteps })).toBe('done');
    expect(currentPhase({ ...full, skipped: ['full'] })).toBe('done');
    expect(phaseProgress({ ...full, steps: fullSteps.slice(0, 4) })).toEqual({ phase: 'full', index: 4, of: FULL_SIZE });
  });

  it('mixed: check, practice, recheck, done', () => {
    const checks = checkSteps(Array(CHECK_SIZE).fill(true));
    const practice = Array.from({ length: PRACTICE_SIZE }, (_, i) => step({ phase: 'practice', qid: `p${i}` }));
    const weak = ['a1-x', 'a1-y'];
    expect(currentPhase(runWith())).toBe('check');
    expect(currentPhase(runWith({ steps: checks.slice(0, CHECK_SIZE - 1) }))).toBe('check');
    expect(currentPhase(runWith({ steps: checks }))).toBe('done');
    expect(currentPhase(runWith({ steps: checks, weak }))).toBe('practice');
    expect(currentPhase(runWith({ steps: [...checks, ...practice.slice(0, 7)], weak }))).toBe('practice');
    expect(currentPhase(runWith({ steps: [...checks, ...practice], weak }))).toBe('recheck');
    const rechecks = [step({ phase: 'recheck', qid: 'r0' }), step({ phase: 'recheck', qid: 'r1' })];
    expect(currentPhase(runWith({ steps: [...checks, ...practice, rechecks[0]], weak }))).toBe('recheck');
    expect(currentPhase(runWith({ steps: [...checks, ...practice, ...rechecks], weak }))).toBe('done');
  });

  it('mixed: a skipped phase is passed over', () => {
    const checks = checkSteps(Array(3).fill(true));
    const weak = ['a1-x'];
    expect(currentPhase(runWith({ steps: checks, weak, skipped: ['check'] }))).toBe('practice');
    expect(currentPhase(runWith({ steps: checks, weak, skipped: ['check', 'practice'] }))).toBe('recheck');
    expect(currentPhase(runWith({ steps: checks, weak, skipped: ['check', 'practice', 'recheck'] }))).toBe('done');
    expect(currentPhase(runWith({ steps: checks, weak: [], skipped: ['check'] }))).toBe('done');
  });

  it('phaseProgress reports the index and size of each phase', () => {
    const checks = checkSteps(Array(CHECK_SIZE).fill(true));
    expect(phaseProgress(runWith({ steps: checks.slice(0, 3) }))).toEqual({ phase: 'check', index: 3, of: CHECK_SIZE });
    const practiceStep = step({ phase: 'practice', qid: 'p0' });
    expect(phaseProgress(runWith({ steps: [...checks, practiceStep], weak: ['a1-x'] }))).toEqual({ phase: 'practice', index: 1, of: PRACTICE_SIZE });
    const practice = Array.from({ length: PRACTICE_SIZE }, (_, i) => step({ phase: 'practice', qid: `p${i}` }));
    expect(phaseProgress(runWith({ steps: [...checks, ...practice], weak: ['a1-x', 'a1-y'] }))).toEqual({ phase: 'recheck', index: 0, of: 2 });
    expect(phaseProgress(runWith({ steps: checks }))).toEqual({ phase: 'done', index: 0, of: 0 });
  });
});

describe('recordAnswer and the weak topics', () => {
  it('appends the step, clears pending and does not change the old run', () => {
    const run = runWith({ pending: { topicId: 'a1-x', qid: 'a1-x#0' } });
    const next = recordAnswer(run, step(), makeCtx());
    expect(next.steps).toHaveLength(1);
    expect(next.pending).toBeNull();
    expect(run.steps).toHaveLength(0);
    expect(run.pending).not.toBeNull();
    expect(next.weak).toEqual([]);
  });

  it('fixes the weak topics only when the check just reached CHECK_SIZE', () => {
    const steps = checkSteps(Array(CHECK_SIZE - 1).fill(false), ['a1-x']);
    const ctx = makeCtx();
    expect(recordAnswer(runWith({ steps: steps.slice(0, CHECK_SIZE - 2) }), steps[CHECK_SIZE - 2], ctx).weak).toEqual([]);
    const done = recordAnswer(runWith({ steps }), step({ ok: false, qid: 'last' }), ctx);
    expect(done.weak).toEqual(['a1-x']);
  });

  it('does not fix weak topics in a full round or on a non-check step', () => {
    const full = recordAnswer(newRun('full', 1, 'A1'), step({ phase: 'full', ok: false }), makeCtx());
    expect(full.weak).toEqual([]);
    const checks = checkSteps(Array(CHECK_SIZE).fill(false));
    const practice = recordAnswer(runWith({ steps: checks, weak: ['a1-y'] }), step({ phase: 'practice', ok: false, qid: 'p0' }), makeCtx());
    expect(practice.weak).toEqual(['a1-y']);
  });

  it('orders by wrong count, then the lowest percent, then the tier, and keeps MAX_WEAK_TOPICS', () => {
    // wrong: a1-x 2, a1-y 2, a1-z 1, a2-x 1; a1-y has the lower percent, a2-x (core) beats a1-z (exam).
    const oks = [false, false, false, false, false, true, true, true, true];
    const topics = ['a1-x', 'a1-y', 'a1-z', 'a2-x', 'a1-x', 'a1-y', 'a1-z', 'a2-x', 'a2-y'];
    const steps = checkSteps(oks, ['a1-x']).map((s, i) => ({ ...s, topicId: topics[i] }));
    const evidence = new Map<string, TopicEvidence>([
      ['a1-x', ev([true, true, false])],
      ['a1-y', ev([true, false, false])],
    ]);
    const next = recordAnswer(runWith({ steps }), step({ topicId: 'a1-y', ok: false, qid: 'last' }), makeCtx({ evidence }));
    expect(next.weak).toEqual(['a1-y', 'a1-x', 'a2-x']);
    expect(next.weak).toHaveLength(MAX_WEAK_TOPICS);
    expect(next.before).toEqual({ 'a1-y': 33, 'a1-x': 67, 'a2-x': null });
  });

  it('keeps the first occurrence on a full tie', () => {
    const steps = checkSteps(Array(CHECK_SIZE - 1).fill(true)).map((s, i) => (i === 3 ? { ...s, topicId: 'a1-y', ok: false } : i === 1 ? { ...s, topicId: 'a1-x', ok: false } : s));
    const next = recordAnswer(runWith({ steps }), step({ topicId: 'a1-x', qid: 'last' }), makeCtx({ topics: TOPICS.map((t) => ({ ...t, tier: 'core' })) }));
    expect(next.weak).toEqual(['a1-x', 'a1-y']);
  });

  it('falls back to below-tick topics at or under the ladder level, lowest percent first', () => {
    const steps = checkSteps(Array(CHECK_SIZE - 1).fill(true));
    const evidence = new Map<string, TopicEvidence>([
      ['a1-x', ev(Array(5).fill(true))],
      ['a1-y', ev([true, false, true, false])],
      ['a2-x', ev([true, true, true, true, true, true, true, false, false, false])],
      ['b1-x', ev([false, false, true, false])],
      ['b1-y', ev([true, false])],
    ]);
    // 10 correct from A1 → the ladder is at B1, so every level counts.
    const next = recordAnswer(runWith({ steps }), step({ qid: 'last' }), makeCtx({ evidence }));
    expect(next.weak).toEqual(['b1-x', 'a1-y', 'a2-x']);
    expect(next.before).toEqual({ 'b1-x': 25, 'a1-y': 50, 'a2-x': 70 });
  });

  it('has no weak topics (the round ends after the check) when nothing is wrong and nothing is below the tick', () => {
    const steps = checkSteps(Array(CHECK_SIZE - 1).fill(true));
    const next = recordAnswer(runWith({ steps }), step({ qid: 'last' }), makeCtx());
    expect(next.weak).toEqual([]);
    expect(currentPhase(next)).toBe('done');
  });
});

describe('skipPhase', () => {
  it('adds the current phase to skipped', () => {
    const run = runWith({ steps: checkSteps(Array(CHECK_SIZE).fill(true)), weak: ['a1-x'] });
    const next = skipPhase(run, makeCtx());
    expect(next.skipped).toEqual(['practice']);
    expect(currentPhase(next)).toBe('recheck');
    expect(run.skipped).toEqual([]);
  });

  it('fixes the weak topics when the check of a mixed round is skipped', () => {
    const steps = checkSteps([true, false, true], ['a1-x', 'a1-y', 'a1-z']);
    const next = skipPhase(runWith({ steps }), makeCtx());
    expect(next.skipped).toEqual(['check']);
    expect(next.weak).toEqual(['a1-y']);
    expect(currentPhase(next)).toBe('practice');
  });

  it('uses the ladder level of the skipped check for the fallback topics', () => {
    const evidence = new Map<string, TopicEvidence>([
      ['a1-y', ev([true, false, true, false])],
      ['b1-x', ev([false, false, false])],
    ]);
    // Two correct from A1: the ladder is at A2, so the B1 topic is out of reach.
    const next = skipPhase(runWith({ steps: checkSteps([true, true]) }), makeCtx({ evidence }));
    expect(next.weak).toEqual(['a1-y']);
  });

  it('skips the one phase of a full round and leaves a finished round alone', () => {
    const full = skipPhase(newRun('full', 1, 'A1'), makeCtx());
    expect(full.skipped).toEqual(['full']);
    expect(currentPhase(full)).toBe('done');
    expect(skipPhase(full, makeCtx())).toBe(full);
  });
});

describe('pickNext: check', () => {
  it('stays on the ladder level', () => {
    const ctx = makeCtx();
    const a1 = pickNext(runWith({ startLevel: 'A1' }), ctx)!;
    expect(ctx.topics.find((t) => t.id === a1.topicId)!.level).toBe('A1');
    const b1 = pickNext(runWith({ startLevel: 'A1', steps: checkSteps([true, true, true, true], ['a1-x', 'a1-y']) }), ctx)!;
    expect(ctx.topics.find((t) => t.id === b1.topicId)!.level).toBe('B1');
    const down = pickNext(runWith({ startLevel: 'B1', steps: checkSteps([false], ['b1-x']) }), ctx)!;
    expect(ctx.topics.find((t) => t.id === down.topicId)!.level).toBe('A2');
  });

  it('takes the nearest level (the lower on a tie) when the level has no free question', () => {
    const ctx = makeCtx({ counts: { 'a2-x': 0, 'a2-y': 0 } });
    const pick = pickNext(runWith({ startLevel: 'A2' }), ctx)!;
    expect(ctx.topics.find((t) => t.id === pick.topicId)!.level).toBe('A1');
    const far = makeCtx({ counts: { 'a1-x': 0, 'a1-y': 0, 'a1-z': 0, 'a2-x': 0, 'a2-y': 0 } });
    expect(far.topics.find((t) => t.id === pickNext(runWith({ startLevel: 'A1' }), far)!.topicId)!.level).toBe('B1');
  });

  it('never repeats a question id and leaves the previous step topic out', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const ctx = makeCtx();
      let run = runWith({ seed });
      const qids = new Set<string>();
      let prev = '';
      for (let i = 0; i < CHECK_SIZE; i++) {
        const pick = pickNext(run, ctx)!;
        expect(pick).not.toBeNull();
        expect(qids.has(pick.qid)).toBe(false);
        qids.add(pick.qid);
        if (i > 0) expect(pick.topicId).not.toBe(prev);
        prev = pick.topicId;
        run = recordAnswer(run, step({ topicId: pick.topicId, qid: pick.qid, level: 'A1', ok: false }), ctx);
      }
    }
  });

  it('lesson item ids are not unique across lessons: a question id is only used up in its own topic', () => {
    const ctx: PickCtx = { levels: LEVELS, topics: [TOPICS[0], TOPICS[1]], evidence: new Map(), questionIds: () => [{ id: 'dup', kind: 'choice' }] };
    const first = pickNext(runWith({ seed: 5 }), ctx)!;
    expect(first.qid).toBe('dup');
    // the other topic's "dup" is still free (the previous step's topic is left out), after the answer ...
    const answered = recordAnswer(runWith({ seed: 5, pending: first }), step({ topicId: first.topicId, qid: 'dup' }), ctx);
    const second = pickNext(answered, ctx)!;
    expect(second).not.toBeNull();
    expect(second.qid).toBe('dup');
    expect(second.topicId).not.toBe(first.topicId);
    // ... and also while the first one is still on screen (pending)
    const whilePending = pickNext(runWith({ seed: 5, pending: first }), ctx)!;
    expect(whilePending.topicId).not.toBe(first.topicId);
    // both used: nothing is left
    const both = recordAnswer(answered, step({ topicId: second.topicId, qid: 'dup' }), ctx);
    expect(pickNext(both, ctx)).toBeNull();
  });

  it('keeps the previous topic only when it is the single candidate', () => {
    const ctx = makeCtx({ topics: [TOPICS[0]] });
    const pick = pickNext(runWith({ steps: checkSteps([false], ['a1-x']) }), ctx);
    expect(pick?.topicId).toBe('a1-x');
    expect(pick?.qid).not.toBe('chk0');
  });

  it('prefers a weak topic over a known one and a core-plus topic on a tie (once every topic has answers)', () => {
    const evidence = new Map<string, TopicEvidence>([
      ['a1-x', ev([true, true, true, true, true])],
      ['a1-y', ev([true, true, true, true, true])],
      ['a1-z', ev([false, false, false])],
      ['a2-x', ev([true, true, true, true, true])],
      ['a2-y', ev([true, true, true, true, true])],
      ['b1-x', ev([true, true, true, true, true])],
      ['b1-y', ev([true, true, true, true, true])],
    ]);
    for (let seed = 1; seed <= 10; seed++) {
      expect(pickNext(runWith({ seed }), makeCtx({ evidence }))!.topicId).toBe('a1-z');
    }
    const none = new Map<string, TopicEvidence>();
    for (let seed = 1; seed <= 10; seed++) {
      expect(pickNext(runWith({ seed }), makeCtx({ evidence: none }))!.topicId).toBe('a1-x');
    }
  });

  it('prefers a question that is not in the evidence yet, then a new kind', () => {
    const ctx = makeCtx({ topics: [TOPICS[0]], n: 4 });
    // choice(#0), form(#1), why(#2), choice(#3); #0 and #1 are in the evidence.
    ctx.evidence.set('a1-x', { answers: [answer(true, 'choice', 'a1-x#0'), answer(true, 'form', 'a1-x#1')] });
    for (let seed = 1; seed <= 10; seed++) {
      expect(['a1-x#2', 'a1-x#3']).toContain(pickNext(runWith({ seed }), ctx)!.qid);
    }
    // The round already asked a choice question at this topic: the new kind (why) wins.
    const asked = runWith({ steps: [step({ topicId: 'a1-x', qid: 'old', kind: 'choice' })], seed: 5 });
    expect(pickNext(asked, ctx)!.qid).toBe('a1-x#2');
  });

  it('returns null when no question is left and for a finished round', () => {
    const ctx = makeCtx({ n: 0 });
    expect(pickNext(runWith(), ctx)).toBeNull();
    expect(pickNext(runWith({ steps: checkSteps(Array(CHECK_SIZE).fill(true)) }), makeCtx())).toBeNull();
  });

  it('does not offer the pending question again', () => {
    const ctx = makeCtx({ topics: [TOPICS[0]], n: 2 });
    const pick = pickNext(runWith({ pending: { topicId: 'a1-x', qid: 'a1-x#0' } }), ctx)!;
    expect(pick.qid).toBe('a1-x#1');
  });
});

// FB568: the check keeps testing new grammar units; a topic that was never answered comes before any answered one.
describe('pickNext: check, new topics first', () => {
  const syllabus = (n: number, tiers: PickTopic['tier'][] = ['core']): PickTopic[] =>
    Array.from({ length: n }, (_, i) => ({ id: `t${i}`, level: LEVELS[i % LEVELS.length], tier: tiers[i % tiers.length] }));
  const checkOf = (run: RoundRun) => run.steps.filter((s) => s.phase === 'check');
  // Before every pick of the check: while a topic has no evidence, the pick must be one of those.
  const onlyNewWhileAny = (ctx: PickCtx) => (pick: { topicId: string }, run: RoundRun) => {
    if (currentPhase(run) !== 'check') return;
    const fresh = ctx.topics.filter((t) => !ctx.evidence.has(t.id)).map((t) => t.id);
    if (fresh.length > 0) expect(fresh).toContain(pick.topicId);
  };

  it('a never-answered topic beats an answered one at the same level, whatever the weak score', () => {
    const evidence = new Map<string, TopicEvidence>([['a1-x', ev([false, false, false])]]);
    for (let seed = 1; seed <= 10; seed++) {
      expect(['a1-y', 'a1-z']).toContain(pickNext(runWith({ seed }), makeCtx({ evidence }))!.topicId);
    }
    // one answer is an answer too (no percent yet, but not new any more)
    evidence.set('a1-y', ev([true]));
    for (let seed = 1; seed <= 10; seed++) {
      expect(pickNext(runWith({ seed }), makeCtx({ evidence }))!.topicId).toBe('a1-z');
    }
  });

  it('when the ladder level has none left, the nearest level with a never-answered topic is used before any answered topic', () => {
    const answered = (levels: Level[]) =>
      new Map<string, TopicEvidence>(TOPICS.filter((t) => levels.includes(t.level)).map((t) => [t.id, ev([false, false, false])]));
    for (let seed = 1; seed <= 10; seed++) {
      const a2 = pickNext(runWith({ seed }), makeCtx({ evidence: answered(['A1']) }))!;
      expect(TOPICS.find((t) => t.id === a2.topicId)!.level).toBe('A2');
      const b1 = pickNext(runWith({ seed }), makeCtx({ evidence: answered(['A1', 'A2']) }))!;
      expect(TOPICS.find((t) => t.id === b1.topicId)!.level).toBe('B1');
    }
    // the ladder is at B1, B1 is used up: the nearest level (A2) before A1
    const lowerFirst = pickNext(runWith({ startLevel: 'B1' }), makeCtx({ evidence: answered(['B1']) }))!;
    expect(TOPICS.find((t) => t.id === lowerFirst.topicId)!.level).toBe('A2');
  });

  it('a never-answered topic without a free question does not hold the answered ones back', () => {
    const evidence = new Map<string, TopicEvidence>(TOPICS.map((t) => [t.id, ev([false, false, false])]));
    evidence.delete('a2-x');
    const ctx = makeCtx({ evidence, counts: { 'a2-x': 0 } });
    expect(pickNext(runWith(), ctx)).not.toBeNull();
    expect(pickNext(runWith(), ctx)!.topicId).not.toBe('a2-x');
  });

  it('an all-right learner has been asked every topic after ceil(topics / CHECK_SIZE) rounds, new ones first', () => {
    const topics = syllabus(25);
    const ctx = makeCtx({ topics, n: 4 });
    const rounds = Math.ceil(topics.length / CHECK_SIZE);
    for (let r = 0; r < rounds; r++) {
      const run = playRound(newRun('mixed', 30 + r, 'A1'), ctx, () => true, onlyNewWhileAny(ctx));
      expect(checkOf(run)).toHaveLength(CHECK_SIZE);
      if ((r + 1) * CHECK_SIZE <= topics.length) expect(new Set(checkOf(run).map((s) => s.topicId)).size).toBe(CHECK_SIZE);
    }
    expect(topics.every((t) => ctx.evidence.has(t.id))).toBe(true);
  });

  it('a learner with wrong answers meets only never-answered topics in the check too, while there are any', () => {
    const topics = syllabus(25);
    const ctx = makeCtx({ topics, n: 6 });
    const rounds = Math.ceil(topics.length / CHECK_SIZE);
    for (let r = 0; r < rounds; r++) {
      const run = playRound(newRun('mixed', 40 + r, 'A1'), ctx, (_t, cur) => cur.steps.length % 3 !== 0, onlyNewWhileAny(ctx));
      expect(checkOf(run)).toHaveLength(CHECK_SIZE);
      // weak topics keep their practice and re-check
      expect(run.weak.length).toBeGreaterThan(0);
      expect(run.steps.filter((s) => s.phase === 'practice').every((s) => run.weak.includes(s.topicId))).toBe(true);
      expect(run.steps.filter((s) => s.phase === 'recheck')).toHaveLength(run.weak.length);
    }
    expect(topics.every((t) => ctx.evidence.has(t.id))).toBe(true);
  });

  it('respects the tier filter of ctx.topics: a topic that is not in it is never asked', () => {
    const all = syllabus(30, ['core', 'full', 'perfect']);
    const topics = all.filter((t) => t.tier === 'core');
    const ctx = makeCtx({ topics, n: 4 });
    const allowed = new Set(topics.map((t) => t.id));
    for (let r = 0; r < 3; r++) {
      const run = playRound(newRun('mixed', 50 + r, 'A1'), ctx, () => true, onlyNewWhileAny(ctx));
      expect(checkOf(run).every((s) => allowed.has(s.topicId))).toBe(true);
      expect(checkOf(run)).toHaveLength(CHECK_SIZE);
    }
    expect(topics.every((t) => ctx.evidence.has(t.id))).toBe(true);
    expect(all.filter((t) => !allowed.has(t.id)).some((t) => ctx.evidence.has(t.id))).toBe(false);
  });

  it('once every topic has answers the old scoring applies again: the weakest topic of the ladder level', () => {
    const topics = syllabus(12);
    const evidence = new Map<string, TopicEvidence>(topics.map((t) => [t.id, ev([true, true, true, true, true])]));
    evidence.set('t3', ev([false, false, false])); // t3 is at A1 (3 % 3 = 0), weak
    for (let seed = 1; seed <= 10; seed++) {
      expect(pickNext(runWith({ seed }), makeCtx({ topics, evidence }))!.topicId).toBe('t3');
    }
  });
});

describe('pickNext: practice and recheck', () => {
  const checks = checkSteps(Array(CHECK_SIZE).fill(false));

  it('goes round the weak topics', () => {
    const ctx = makeCtx();
    let run = runWith({ steps: checks, weak: ['a1-y', 'a2-x'] });
    const order: string[] = [];
    for (let i = 0; i < 4; i++) {
      const pick = pickNext(run, ctx)!;
      order.push(pick.topicId);
      run = recordAnswer(run, step({ topicId: pick.topicId, qid: pick.qid, phase: 'practice' }), ctx);
    }
    expect(order).toEqual(['a1-y', 'a2-x', 'a1-y', 'a2-x']);
  });

  it('takes the next weak topic when one has no free question, null when none has', () => {
    const run = runWith({ steps: checks, weak: ['a1-y', 'a2-x'] });
    expect(pickNext(run, makeCtx({ counts: { 'a1-y': 0 } }))!.topicId).toBe('a2-x');
    expect(pickNext(run, makeCtx({ counts: { 'a1-y': 0, 'a2-x': 0 } }))).toBeNull();
  });

  it('asks one re-check question per weak topic, then the round is done', () => {
    const ctx = makeCtx();
    const weak = ['a1-y', 'a2-x', 'b1-x'];
    const practice = Array.from({ length: PRACTICE_SIZE }, (_, i) => step({ phase: 'practice', qid: `p${i}` }));
    let run = runWith({ steps: [...checks, ...practice], weak });
    const order: string[] = [];
    while (currentPhase(run) === 'recheck') {
      const pick = pickNext(run, ctx)!;
      order.push(pick.topicId);
      run = recordAnswer(run, step({ topicId: pick.topicId, qid: pick.qid, phase: 'recheck' }), ctx);
    }
    expect(order).toEqual(weak);
    expect(currentPhase(run)).toBe('done');
    expect(pickNext(run, ctx)).toBeNull();
  });

  it('leaves a weak topic without a free question out of the re-check and asks the next one', () => {
    const weak = ['a1-y', 'a2-x', 'b1-x'];
    const practice = Array.from({ length: PRACTICE_SIZE }, (_, i) => step({ phase: 'practice', qid: `p${i}` }));
    const ctx = makeCtx({ counts: { 'a1-y': 0 } });
    let run = runWith({ steps: [...checks, ...practice], weak });
    const order: string[] = [];
    for (let pick = pickNext(run, ctx); pick; pick = pickNext(run, ctx)) {
      order.push(pick.topicId);
      run = recordAnswer(run, step({ topicId: pick.topicId, qid: pick.qid, phase: 'recheck' }), ctx);
    }
    // the first weak topic is left out, the other two are asked; then nothing is left and the screen passes the phase over
    expect(order).toEqual(['a2-x', 'b1-x']);
    expect(currentPhase(run)).toBe('recheck');
    expect(currentPhase(skipPhase(run, ctx))).toBe('done');
  });

  it('does not repeat a practice question in the re-check', () => {
    const ctx = makeCtx({ n: 2 });
    const used = [step({ phase: 'practice', topicId: 'a1-y', qid: 'a1-y#0' }), step({ phase: 'practice', topicId: 'a1-y', qid: 'a1-y#1' })];
    const run = runWith({ steps: [...checks, ...used], weak: ['a1-y'], skipped: ['practice'] });
    expect(pickNext(run, ctx)).toBeNull();
  });
});

describe('pickNext: full', () => {
  it('spreads over the levels and fills a started topic up to 3 answers', () => {
    const ctx = makeCtx();
    const run = playRound(newRun('full', 42, 'A1'), ctx);
    expect(run.steps).toHaveLength(FULL_SIZE);
    expect(currentPhase(run)).toBe('done');
    const perTopic = new Map<string, number>();
    for (const s of run.steps) perTopic.set(s.topicId, (perTopic.get(s.topicId) ?? 0) + 1);
    const started = [...perTopic.keys()];
    // 20 steps = six topics with 3 answers + a seventh with 2.
    expect(started).toHaveLength(7);
    expect(started.slice(0, 6).every((id) => perTopic.get(id) === 3)).toBe(true);
    expect(perTopic.get(started[6])).toBe(2);
    // The first topic of each level comes before a second topic of the same level.
    expect(new Set(started.slice(0, 3).map((id) => ctx.topics.find((t) => t.id === id)!.level)).size).toBe(3);
    expect(new Set(run.steps.map((s) => s.qid)).size).toBe(FULL_SIZE);
  });

  it('alternates two new topics three times each before the next pair starts (A B A B A B, C D C D C D)', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const run = playRound(newRun('full', seed, 'A1'), makeCtx());
      const ids = run.steps.map((s) => s.topicId);
      for (const base of [0, 6, 12]) {
        const [x, y] = [ids[base], ids[base + 1]];
        expect(x).not.toBe(y);
        expect(ids.slice(base, base + 6)).toEqual([x, y, x, y, x, y]);
      }
      expect(new Set(ids.slice(0, 18)).size).toBe(6);
    }
  });

  it('does not ask the same topic twice in a row while another topic can be started', () => {
    const ctx = makeCtx();
    const first = pickNext(newRun('full', 4, 'A1'), ctx)!;
    const steps = [step({ phase: 'full', topicId: first.topicId, qid: first.qid })];
    ctx.evidence.set(first.topicId, ev([true]));
    const second = pickNext({ ...newRun('full', 4, 'A1'), steps }, ctx)!;
    expect(second.topicId).not.toBe(first.topicId);
    // the topic is asked again when it is the only one left to ask
    const single = makeCtx({ topics: [TOPICS.find((t) => t.id === first.topicId)!] });
    single.evidence.set(first.topicId, ev([true]));
    expect(pickNext({ ...newRun('full', 4, 'A1'), steps }, single)?.topicId).toBe(first.topicId);
  });

  it('counts the evidence of earlier rounds: a topic with 3 answers has no demand', () => {
    const evidence = new Map<string, TopicEvidence>(TOPICS.filter((t) => t.id !== 'b1-y').map((t) => [t.id, ev([true, true, true])]));
    const pick = pickNext(newRun('full', 3, 'A1'), makeCtx({ evidence }))!;
    expect(pick.topicId).toBe('b1-y');
  });

  it('keeps going with the started topic that still needs answers, and does not repeat the previous one when there is another', () => {
    const ctx = makeCtx();
    const steps = [step({ phase: 'full', topicId: 'a1-x', qid: 'a1-x#0' }), step({ phase: 'full', topicId: 'a2-x', level: 'A2', qid: 'a2-x#0' })];
    ctx.evidence.set('a1-x', ev([true]));
    ctx.evidence.set('a2-x', ev([true]));
    const pick = pickNext({ ...newRun('full', 9, 'A1'), steps }, ctx)!;
    expect(pick.topicId).toBe('a1-x');
    const afterA1 = pickNext({ ...newRun('full', 9, 'A1'), steps: [steps[1], steps[0]] }, ctx)!;
    expect(afterA1.topicId).toBe('a2-x');
  });

  it('without any demand, takes the topics with the oldest last answer, at most 2 questions per topic', () => {
    const dates = ['2026-10-03', '2026-10-01', '2026-10-05', '2026-10-02', '2026-10-07', '2026-10-04', '2026-10-06'];
    const evidence = new Map<string, TopicEvidence>(
      TOPICS.map((t, i) => [t.id, { answers: [answer(true, 'choice', 'o1', '2026-09-01'), answer(true, 'form', 'o2', '2026-09-02'), answer(true, 'choice', 'o3', dates[i])] }]),
    );
    const ctx = makeCtx({ evidence });
    const run = playRound(newRun('full', 8, 'A1'), ctx);
    const perTopic = new Map<string, number>();
    for (const s of run.steps) perTopic.set(s.topicId, (perTopic.get(s.topicId) ?? 0) + 1);
    expect(run.steps[0].topicId).toBe('a1-y');
    expect(Math.max(...perTopic.values())).toBe(2);
    expect(run.steps).toHaveLength(TOPICS.length * 2);
    expect(run.skipped).toEqual(['full']);
  });

  it('a topic without any question is never picked', () => {
    const ctx = makeCtx({ counts: { 'a1-x': 0 } });
    const run = playRound(newRun('full', 11, 'A1'), ctx);
    expect(run.steps.some((s) => s.topicId === 'a1-x')).toBe(false);
  });

  it('FB568: starts a never-answered topic before one with 1-2 answers, even at a level with more started topics', () => {
    // earlier rounds left A2 and B1 with one or two answers each; this round started a1-x, A1 has two never-answered topics left
    const evidence = new Map<string, TopicEvidence>([
      ['a2-x', ev([true])],
      ['a2-y', ev([true, true])],
      ['b1-x', ev([true])],
      ['b1-y', ev([true])],
    ]);
    const ctx = makeCtx({ evidence });
    ctx.evidence.set('a1-x', ev([true]));
    const steps = [step({ phase: 'full', topicId: 'a1-x', qid: 'a1-x#0' })];
    for (let seed = 1; seed <= 10; seed++) {
      expect(['a1-y', 'a1-z']).toContain(pickNext({ ...newRun('full', seed, 'A1'), steps }, ctx)!.topicId);
    }
  });
});

describe('a whole mixed round', () => {
  it('runs check, practice and re-check without a repeated question', () => {
    const ctx = makeCtx({ n: 6 });
    const run = playRound(newRun('mixed', 77, 'A1'), ctx, (_t, r) => r.steps.length % 3 !== 0);
    const qids = run.steps.map((s) => s.qid);
    expect(new Set(qids).size).toBe(qids.length);
    expect(run.steps.filter((s) => s.phase === 'check')).toHaveLength(CHECK_SIZE);
    expect(run.weak.length).toBeGreaterThan(0);
    expect(run.weak.length).toBeLessThanOrEqual(MAX_WEAK_TOPICS);
    expect(run.steps.filter((s) => s.phase === 'practice')).toHaveLength(PRACTICE_SIZE);
    expect(run.steps.filter((s) => s.phase === 'recheck')).toHaveLength(run.weak.length);
    expect(run.steps.filter((s) => s.phase === 'practice').every((s) => run.weak.includes(s.topicId))).toBe(true);
    expect(Object.keys(run.before).sort()).toEqual([...run.weak].sort());
  });

  it('skips a practice phase that runs out of questions', () => {
    const ctx = makeCtx({ n: 1 });
    const run = playRound(newRun('mixed', 5, 'A1'), ctx, () => false);
    expect(run.skipped).toContain('practice');
    expect(currentPhase(run)).toBe('done');
    const qids = run.steps.map((s) => s.qid);
    expect(new Set(qids).size).toBe(qids.length);
  });
});

describe('otherWrongTopics', () => {
  it('lists the wrong topics that did not make it into the capped weak list, in the order first asked wrong', () => {
    const topics = ['t1', 't2', 't3', 't4', 't5', 't6'];
    const oks = [false, true, false, false, false, true, false, false, true, true];
    let run = runWith();
    oks.forEach((ok, i) => {
      run = recordAnswer(run, step({ topicId: topics[i % topics.length], qid: `chk${i}`, ok }), makeCtx({ topics: topics.map((id) => ({ id, level: 'A1', tier: 'core' })) }));
    });
    // wrong: t1 twice, t2, t3, t4, t5 once each: five wrong topics, the weak list keeps three
    expect(run.weak).toEqual(['t1', 't2', 't3']);
    expect(otherWrongTopics(run)).toEqual(['t4', 't5']);
  });

  it('is empty when every wrong topic is weak or nothing is wrong, and lists a topic once', () => {
    expect(otherWrongTopics(runWith({ steps: checkSteps([true, true, true]) }))).toEqual([]);
    expect(otherWrongTopics(runWith({ steps: checkSteps([false, false], ['a1-x', 'a1-y']), weak: ['a1-x', 'a1-y'] }))).toEqual([]);
    expect(otherWrongTopics(runWith({ steps: checkSteps([false, false, false], ['a1-x']), weak: [] }))).toEqual(['a1-x']);
  });
});

describe('determinism', () => {
  it('the same run and context give the same pick', () => {
    const run = runWith({ seed: 31337, steps: checkSteps([true, false, true], ['a1-x', 'a1-y', 'a1-z']) });
    expect(pickNext(run, makeCtx())).toEqual(pickNext(run, makeCtx()));
    const full = newRun('full', 31337, 'A1');
    expect(pickNext(full, makeCtx())).toEqual(pickNext(full, makeCtx()));
  });

  it('the same seed plays the same round', () => {
    const play = (seed: number) => playRound(newRun('mixed', seed, 'A2'), makeCtx(), (_t, r) => r.steps.length % 4 !== 1).steps.map((s) => `${s.topicId}/${s.qid}`);
    expect(play(2024)).toEqual(play(2024));
  });

  it('different seeds can give different questions', () => {
    const picks = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const p = pickNext(newRun('mixed', seed, 'A1'), makeCtx())!;
      picks.add(`${p.topicId}/${p.qid}`);
    }
    expect(picks.size).toBeGreaterThan(1);
  });
});

describe('badgeForTopic', () => {
  it('takes the larger percent and says when it comes from the test', () => {
    const passed = ev([true, true, true, true, false], ['choice', 'form']); // 80%, ticked
    expect(badgeForTopic(50, passed)).toEqual({ pct: 80, fromTest: true, ticked: true });
    expect(badgeForTopic(90, passed)).toEqual({ pct: 90, fromTest: false, ticked: true });
    expect(badgeForTopic(80, passed)).toEqual({ pct: 80, fromTest: false, ticked: true });
  });

  it('works with a missing lesson percent or missing evidence', () => {
    expect(badgeForTopic(null, ev([true, true, true]))).toEqual({ pct: 100, fromTest: true, ticked: false });
    expect(badgeForTopic(40, undefined)).toEqual({ pct: 40, fromTest: false, ticked: false });
    expect(badgeForTopic(40, ev([true, true]))).toEqual({ pct: 40, fromTest: false, ticked: false });
    expect(badgeForTopic(null, undefined)).toEqual({ pct: null, fromTest: false, ticked: false });
  });
});

describe('overallScore and weakTopicCount', () => {
  it('averages the better of the lesson and the test percent, 0 for a missing one', () => {
    const lesson = new Map([
      ['a1-x', 100],
      ['a1-y', 20],
    ]);
    const evidence = new Map([
      ['a1-y', ev([true, true, true])],
      ['a1-z', ev([true, false, false])],
    ]);
    // a1-x 100, a1-y max(20, 100) = 100, a1-z 33, a2-x 0 → 233 / 4 = 58.25
    expect(overallScore(['a1-x', 'a1-y', 'a1-z', 'a2-x'], lesson, evidence)).toBe(58);
  });

  it('is 0 for an empty list', () => {
    expect(overallScore([], new Map(), new Map())).toBe(0);
  });

  it('counts the topics with a percent under 60 (no percent yet is not weak)', () => {
    const evidence = new Map([
      ['a1-x', ev([false, false, true])],
      ['a1-y', ev([true, true, false])],
      ['a1-z', ev([false, false])],
      ['a2-x', ev([true, false, false, false, true])],
    ]);
    expect(weakTopicCount(evidence)).toBe(2);
    expect(weakTopicCount(new Map())).toBe(0);
  });
});
