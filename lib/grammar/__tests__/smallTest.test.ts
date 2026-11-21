import {
  SMALL_TEST_SIZE,
  MINI_CHECK_SIZE,
  DRILL_EXTRA,
  DRILL_MAX,
  GAPS_MAX,
  HARD_TYPES,
  TOPIC_LOG,
  beginRound,
  closeRound,
  drillList,
  finishLesson,
  gapCount,
  isLevelClean,
  isLevelDone,
  resolveDrill,
  startDrill,
  topicWhy,
  levelProgress,
  loadSmallState,
  markShown,
  newSmallState,
  openLesson,
  parseSmallState,
  repairSmallRun,
  resolveAnswer,
  roundRows,
  saveSmallState,
  settleShown,
  startRound,
  taskTypeOfKind,
  type SmallPool,
  type SmallState,
} from '../smallTest';
import { TASK_TYPE_IDS } from '../taskTypes';
import { getDb } from '@/lib/database.web';

// A small sample set: 8 topics (core first), every topic has 4 task types with 4 questions each.
const TOPICS = Array.from({ length: 8 }, (_, i) => ({ id: `t${i + 1}`, core: i < 7 }));
const TYPES = TASK_TYPE_IDS.slice(0, 4);
const pool: SmallPool = (topic) => TYPES.flatMap((type) => [1, 2, 3, 4].map((n) => ({ id: `${topic}:${type}:${n}`, type })));

function begin(seed = 11, st: SmallState = newSmallState(), topics = TOPICS): SmallState {
  return beginRound(startRound(st, topics, pool, seed), pool);
}

// answers until the phase is no longer 'ask': `script(roleIndex)` says right (true) or wrong (false) for the nth answer
function play(st: SmallState, script: (n: number, cur: NonNullable<NonNullable<SmallState['run']>['current']>) => boolean): SmallState {
  let s = st;
  let guard = 0;
  while (s.run && s.run.phase === 'ask' && guard++ < 40) {
    s = resolveAnswer(s, pool, script(s.run.answers.length, s.run.current!));
  }
  return s;
}

const roles = (s: SmallState, topic: string) => s.run!.answers.map((a, i) => ({ i, role: a.role, topic: a.topic, ok: a.ok })).filter((a) => a.topic === topic);

describe('small test: the round', () => {
  it('maps task kinds onto the 8 types', () => {
    expect(taskTypeOfKind('choice')).toBe('choice');
    expect(taskTypeOfKind('noun')).toBe('form');
    expect(taskTypeOfKind('opencloze')).toBe('opencloze');
    expect(taskTypeOfKind('dictation')).toBeNull();
  });

  it('takes at most 6 topics, the core ones first, and marks new / repeat', () => {
    const s = startRound(newSmallState(), TOPICS, pool, 5);
    const run = s.run!;
    expect(run.phase).toBe('intro');
    expect(run.topics).toHaveLength(6);
    expect(run.topics.every((tp) => tp.isNew)).toBe(true);
    expect(run.topics.map((tp) => tp.id)).not.toContain('t8');
    // a second round: the topics of round 1 are "repeat"
    const again = startRound({ ...s, run: null }, TOPICS, pool, 6);
    const seenBefore = new Set(run.topics.map((tp) => tp.id));
    for (const tp of again.run!.topics) expect(tp.isNew).toBe(!seenBefore.has(tp.id));
  });

  it('every round is a different mix', () => {
    const a = startRound(newSmallState(), TOPICS, pool, 1).run!.topics.map((x) => x.id).join();
    const b = startRound(newSmallState(), TOPICS, pool, 2).run!.topics.map((x) => x.id).join();
    const c = startRound(newSmallState(), TOPICS, pool, 3).run!.topics.map((x) => x.id).join();
    expect(new Set([a, b, c]).size).toBeGreaterThan(1);
  });

  it('leaves out a topic without any question', () => {
    const noT1: SmallPool = (tp) => (tp === 't1' ? [] : pool(tp));
    const s = startRound(newSmallState(), TOPICS, noT1, 5);
    expect(s.run!.topics.map((x) => x.id)).not.toContain('t1');
  });

  it('asks 10 questions, the type with the fewest recent answers first, and ends', () => {
    const s = play(begin(), () => true);
    expect(s.run!.phase).toBe('end');
    expect(s.run!.answers).toHaveLength(SMALL_TEST_SIZE);
    expect(new Set(s.run!.answers.slice(0, 4).map((a) => a.type)).size).toBe(4);
    expect(s.run!.answers.every((a) => a.role === 'base')).toBe(true);
    expect(s.history).toEqual([100]);
  });

  it('never repeats a question inside a round', () => {
    const s = play(begin(), (n) => n % 3 !== 0);
    const ids = s.run!.answers.map((a) => a.qid);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('small test: the adaptive rule', () => {
  const firstTopic = (s: SmallState) => s.run!.current!.topic;

  it('a miss brings 2 more questions of the topic within the next 5, never one right after the other', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s0 = begin(seed);
      const t = firstTopic(s0);
      const s = play(s0, (n) => n !== 0);
      const rs = roles(s, t);
      const f1 = rs.find((r) => r.role === 'f1')!;
      const f2 = rs.find((r) => r.role === 'f2')!;
      expect(f1.i - 0).toBeGreaterThanOrEqual(2);
      expect(f2.i - f1.i).toBeGreaterThanOrEqual(2);
      expect(f2.i).toBeLessThanOrEqual(5);
    }
  });

  it('both follow-ups right: a 3rd question; right -> the topic is learned', () => {
    const s0 = begin(2);
    const t = firstTopic(s0);
    const s = play(s0, (n) => n !== 0);
    const rs = roles(s, t);
    expect(rs.map((r) => r.role)).toEqual(['base', 'f1', 'f2', 'f3']);
    expect(s.run!.topicRuns[t].stage).toBe('learned');
    expect(s.learned).toContain(t);
    expect(roundRows(s).find((r) => r.id === t)!.status).toBe('learned');
  });

  it('both follow-ups right, the 3rd wrong: not learned, no stop', () => {
    const s0 = begin(2);
    const t = firstTopic(s0);
    const s = play(s0, (n, cur) => !(n === 0 || cur.role === 'f3'));
    expect(s.run!.topicRuns[t].stage).toBe('open');
    expect(s.learned).not.toContain(t);
    expect(roundRows(s).find((r) => r.id === t)!.status).toBe('more');
    expect(s.run!.phase).toBe('end');
  });

  it('mixed follow-ups (1 right, 1 wrong): a 3rd question; 2 misses, so even a right 3rd is not learned', () => {
    const s0 = begin(3);
    const t = firstTopic(s0);
    const s = play(s0, (n, cur) => !(n === 0 || cur.role === 'f2'));
    expect(roles(s, t).map((r) => r.role)).toEqual(['base', 'f1', 'f2', 'f3']);
    expect(s.run!.topicRuns[t].stage).toBe('open');
    expect(s.learned).not.toContain(t);
    expect(roundRows(s).find((r) => r.id === t)!.status).toBe('more');
  });

  it('2 or more misses take a learned topic out of learned and reset its clean count', () => {
    const s0 = begin(3, { ...newSmallState(), learned: TOPICS.map((tp) => tp.id), clean: { t1: 5, t2: 5, t3: 5, t4: 5, t5: 5, t6: 5, t7: 5 } });
    const t = firstTopic(s0);
    const s = play(s0, (n, cur) => !(n === 0 || cur.role === 'f2'));
    expect(s.learned).not.toContain(t);
    expect(s.clean[t]).toBe(0);
    // a single miss with all follow-ups right keeps it learned
    const one = play(begin(3, { ...newSmallState(), learned: TOPICS.map((tp) => tp.id) }), (n) => n !== 0);
    expect(one.learned).toContain(firstTopic(s0));
  });

  it('mixed follow-ups, the 3rd wrong: the topic stays open', () => {
    const s0 = begin(3);
    const t = firstTopic(s0);
    const s = play(s0, (n, cur) => !(n === 0 || cur.role === 'f1' || cur.role === 'f3'));
    expect(s.run!.topicRuns[t].stage).toBe('open');
    expect(s.learned).not.toContain(t);
  });

  it('both follow-ups wrong: the test stops, the lesson opens, a 3-question check follows, the test continues', () => {
    const s0 = begin(4);
    const t = firstTopic(s0);
    let s = play(s0, (n, cur) => cur.topic !== t);
    expect(s.run!.phase).toBe('stop');
    expect(s.run!.stopTopic).toBe(t);
    const answered = s.run!.answers.length;
    expect(roles(s, t).map((r) => r.role)).toEqual(['base', 'f1', 'f2']);
    s = openLesson(s);
    expect(s.run!.phase).toBe('lesson');
    s = finishLesson(s, pool);
    expect(s.run!.phase).toBe('mini');
    expect(s.run!.mini!.cur).toHaveLength(MINI_CHECK_SIZE);
    expect(new Set(s.run!.mini!.cur.map((q) => q.qid)).size).toBe(MINI_CHECK_SIZE);
    expect(s.run!.mini!.cur.every((q) => q.topic === t)).toBe(true);
    for (let i = 0; i < MINI_CHECK_SIZE; i++) {
      expect(s.run!.phase).toBe('mini');
      s = resolveAnswer(s, pool, i !== 0);
    }
    // back in the test at the same place, the mini check did not count as a test question
    expect(s.run!.phase).toBe('ask');
    expect(s.run!.answers).toHaveLength(answered);
    expect(s.run!.current!.topic).not.toBe(t);
    const done = play(s, () => true);
    expect(done.run!.phase).toBe('end');
    expect(done.run!.answers).toHaveLength(SMALL_TEST_SIZE);
    expect(done.learned).not.toContain(t);
    expect(done.run!.topicRuns[t].mini).toEqual({ right: 2, asked: 3 });
    expect(roundRows(done).find((r) => r.id === t)!.status).toBe('more');
  });

  it('a failed mini check leaves the topic on "Lesson"', () => {
    const s0 = begin(4);
    const t = firstTopic(s0);
    let s = finishLesson(openLesson(play(s0, (n, cur) => cur.topic !== t)), pool);
    for (let i = 0; i < MINI_CHECK_SIZE; i++) s = resolveAnswer(s, pool, false);
    const done = play(s, () => true);
    expect(roundRows(done).find((r) => r.id === t)!.status).toBe('lesson');
  });

  it('"I mistyped" counts the wrong answer as right: no follow-up', () => {
    const s0 = begin(2);
    const t = firstTopic(s0);
    let s = resolveAnswer(s0, pool, true, true);
    expect(s.run!.answers[0]).toMatchObject({ topic: t, ok: true, mistyped: true });
    expect(s.run!.pending).toHaveLength(0);
    expect(s.run!.topicRuns[t].stage).toBe('base');
    s = play(s, () => true);
    expect(s.run!.answers.some((a) => a.role !== 'base')).toBe(false);
  });

  it('a follow-up prefers another task type than the first question of the topic', () => {
    const s0 = begin(2);
    const t = firstTopic(s0);
    const s = play(s0, (n) => n !== 0);
    const types = roles(s, t).map((r) => s.run!.answers[r.i].type);
    expect(new Set(types).size).toBeGreaterThan(1);
  });
});

describe('small test: level done and the saved run', () => {
  const core = TOPICS.filter((x) => x.core).map((x) => x.id);

  it('the level is done when every core topic is learned (three right answers in a row, across rounds, learn a topic)', () => {
    const few = TOPICS.slice(0, 2);
    const fewCore = few.map((x) => x.id);
    let s = play(begin(1, newSmallState(), few), () => true);
    // 10 questions over 2 topics: both get at least 3 clean answers in the first round
    expect(levelProgress(s, fewCore)).toEqual({ learned: 2, total: 2 });
    expect(isLevelDone(s, fewCore)).toBe(true);
    expect(s.history).toEqual([100]);
  });

  it('a topic asked fewer than 3 times in a clean round is not learned yet; the next clean answers add up', () => {
    // 6 topics, 10 questions: some topics get 1 or 2 questions
    let s = play(begin(3), () => true);
    const asked = (t: string) => s.run!.answers.filter((a) => a.topic === t).length;
    const light = s.run!.topics.map((x) => x.id).filter((t) => asked(t) > 0 && asked(t) < 3);
    expect(light.length).toBeGreaterThan(0);
    for (const t of light) {
      expect(s.learned).not.toContain(t);
      expect(s.clean[t]).toBe(asked(t));
    }
    // the same topics, a second clean round: the answers count on from the first round
    const before = { ...s.clean };
    s = begin(4, { ...s, run: null });
    s = play(s, () => true);
    for (const t of light) {
      const now = s.run!.answers.filter((a) => a.topic === t).length;
      if (now > 0) expect(s.clean[t]).toBe(before[t] + now);
      expect(s.learned.includes(t)).toBe((s.clean[t] ?? 0) >= 3);
    }
  });

  it('a miss in a round resets the clean count of the topic', () => {
    const few = TOPICS.slice(0, 3);
    let s = play(begin(1, newSmallState(), few), () => true);
    const t = few[0].id;
    expect(s.clean[t]).toBeGreaterThan(0);
    s = begin(2, { ...s, run: null }, few);
    s = play(s, (n, cur) => !(cur.topic === t && cur.role === 'base'));
    expect(s.clean[t] ?? 0).toBe(0);
  });

  it('survives leaving: the run goes through JSON and the resume store and continues the same way', async () => {
    const s0 = begin(7);
    const mid = play({ ...s0 }, () => true);
    // stop the same run half way: 4 answers
    let a = s0;
    for (let i = 0; i < 4; i++) a = resolveAnswer(a, pool, i !== 1);
    const saved = JSON.parse(JSON.stringify(a));
    const db = getDb();
    await saveSmallState(db, 'en→es', 'A1', saved);
    const loaded = await loadSmallState(db, 'en→es', 'A1');
    expect(loaded).toEqual(parseSmallState(saved));
    const rest = (st: SmallState) => play(st, () => true).run!.answers.map((x) => x.qid);
    expect(rest(loaded)).toEqual(rest(a));
    expect(mid.run!.phase).toBe('end');
  });

  it('a saved run whose round topic has no topicRuns entry is dropped (it would crash the next pick)', () => {
    const a = JSON.parse(JSON.stringify(begin(5)));
    delete a.run.topicRuns[a.run.topics[0].id];
    expect(parseSmallState(a).run).toBeNull();
    expect(parseSmallState(JSON.parse(JSON.stringify(begin(5)))).run).not.toBeNull();
  });

  it('a current question that left the pool is replaced by another one of the same topic; with none left the run is dropped', () => {
    const s = begin(6);
    const cur = s.run!.current!;
    const gone: SmallPool = (topic) => pool(topic).filter((q) => q.id !== cur.qid);
    const fixed = repairSmallRun(s, gone);
    expect(fixed.run!.current!.topic).toBe(cur.topic);
    expect(fixed.run!.current!.qid).not.toBe(cur.qid);
    expect(gone(cur.topic).some((q) => q.id === fixed.run!.current!.qid)).toBe(true);
    const none: SmallPool = (topic) => (topic === cur.topic ? [] : pool(topic));
    expect(repairSmallRun(s, none).run).toBeNull();
    // a run that is fine is left as it is
    expect(repairSmallRun(s, pool)).toBe(s);
  });

  it('a damaged save becomes a fresh state', () => {
    expect(parseSmallState(null)).toEqual(newSmallState());
    expect(parseSmallState({ v: 1, learned: 'x' })).toEqual(newSmallState());
    expect(core.length).toBe(7);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// the miss log, weak topics first, hard types, practice

const T5 = TOPICS.slice(0, 5);
const next = (s: SmallState, seed: number) => begin(seed, { ...s, run: null }, T5);
const firstTopic = (s: SmallState) => s.run!.current!.topic;
const firstWrong = (s: SmallState) => s.run!.answers.find((a) => !a.ok)!;

describe('small test: the miss log', () => {
  it('a miss makes a log item at once (not at the round end); a typo owned up to does not', () => {
    const s0 = begin(2, newSmallState(), T5);
    const cur = s0.run!.current!;
    const s = resolveAnswer(s0, pool, false);
    expect(s.run!.phase).toBe('ask');
    expect(s.gaps[cur.qid]).toEqual({ topic: cur.topic, right: 0, round: 1 });
    expect(s.log[cur.topic]).toEqual([0]);
    const typo = resolveAnswer(s0, pool, true, true);
    expect(gapCount(typo)).toBe(0);
    expect(typo.log[cur.topic]).toEqual([1]);
  });

  it('the miss comes back as the topic base question, and two right answers in two later rounds close it', () => {
    const r1 = play(begin(2, newSmallState(), T5), (n) => n !== 0);
    const miss = firstWrong(r1);
    expect(r1.gaps[miss.qid]).toEqual({ topic: miss.topic, right: 0, round: 1 });
    const r2 = play(next(r1, 5), () => true);
    expect(r2.run!.answers.find((a) => a.topic === miss.topic)!.qid).toBe(miss.qid);
    expect(r2.run!.answers.find((a) => a.topic === miss.topic)!.role).toBe('base');
    expect(r2.gaps[miss.qid]).toEqual({ topic: miss.topic, right: 1, round: 2 });
    expect(r2.fixed).toBe(0);
    const r3 = play(next(r2, 9), () => true);
    expect(r3.run!.answers.find((a) => a.topic === miss.topic)!.qid).toBe(miss.qid);
    expect(r3.gaps[miss.qid]).toBeUndefined();
    expect(r3.fixed).toBe(1);
    expect(gapCount(r3)).toBe(0);
  });

  it('a right answer in the round of the miss does not count; a new miss resets the count', () => {
    const s0 = begin(2, newSmallState(), T5);
    const cur = s0.run!.current!;
    const same = resolveAnswer({ ...s0, gaps: { [cur.qid]: { topic: cur.topic, right: 0, round: 1 } } }, pool, true);
    expect(same.gaps[cur.qid]).toEqual({ topic: cur.topic, right: 0, round: 1 });
    const r1 = play(begin(2, newSmallState(), T5), (n) => n !== 0);
    const miss = firstWrong(r1);
    const r2 = play(next(r1, 5), () => true);
    expect(r2.gaps[miss.qid].right).toBe(1);
    const r3 = play(next(r2, 9), (n, c) => c.qid !== miss.qid);
    expect(r3.gaps[miss.qid]).toEqual({ topic: miss.topic, right: 0, round: 3 });
    expect(r3.fixed).toBe(0);
  });

  it('the quick check after a lesson counts as well', () => {
    const s0 = begin(4, newSmallState(), T5);
    const t = firstTopic(s0);
    let s = play(s0, (n, cur) => cur.topic !== t);
    s = finishLesson(openLesson(s), pool);
    const q = s.run!.current!;
    s = resolveAnswer(s, pool, false);
    expect(s.gaps[q.qid].topic).toBe(t);
    expect(s.log[t].slice(-1)).toEqual([0]);
  });

  it('the topic log keeps the last TOPIC_LOG answers and the miss log GAPS_MAX items', () => {
    let s = begin(2, { ...newSmallState(), log: { [firstTopic(begin(2, newSmallState(), T5))]: Array(TOPIC_LOG).fill(1) } }, T5);
    const t = firstTopic(s);
    s = resolveAnswer(s, pool, false);
    expect(s.log[t]).toHaveLength(TOPIC_LOG);
    expect(s.log[t][TOPIC_LOG - 1]).toBe(0);
    const many = Object.fromEntries(Array.from({ length: GAPS_MAX }, (_, i) => [`old${i}`, { topic: 'tx', right: 0, round: i === 0 ? 0 : 1 }]));
    const c = { ...begin(2, newSmallState(), T5), gaps: many };
    const after = resolveAnswer(c, pool, false);
    expect(Object.keys(after.gaps)).toHaveLength(GAPS_MAX);
    expect(after.gaps.old0).toBeUndefined();
  });

  it('a log item whose question left the content is dropped at the round start, `fixed` stays', () => {
    const st = { ...newSmallState(), fixed: 2, gaps: { 't1:choice:1': { topic: 't1', right: 0, round: 1 }, 'gone:q': { topic: 't1', right: 1, round: 1 } } };
    const s = startRound(st, TOPICS, pool, 3);
    expect(Object.keys(s.gaps)).toEqual(['t1:choice:1']);
    expect(s.fixed).toBe(2);
  });

  it('an old save (without the four new fields) loads and keeps its old fields; damaged new fields become empty', () => {
    const old = { v: 1, learned: ['t1'], clean: { t1: 2 }, seen: ['t1', 't2'], history: [80], recent: ['x'], rounds: 4, run: null };
    const s = parseSmallState(old);
    expect(s).toEqual({ ...old, gaps: {}, fixed: 0, log: {}, last: {} });
    const bad = parseSmallState({ ...old, gaps: { a: { topic: 't1', right: 'x', round: 1 }, b: { topic: 't2', right: 1, round: 2 } }, fixed: 'many', log: { t1: [1, 'x', 0, 2], t2: 'no' }, last: { t1: 3, t2: 'x' } });
    expect(bad.learned).toEqual(['t1']);
    expect(bad.gaps).toEqual({ b: { topic: 't2', right: 1, round: 2 } });
    expect(bad.fixed).toBe(0);
    expect(bad.log).toEqual({ t1: [1, 0] });
    expect(bad.last).toEqual({ t1: 3 });
    const round = JSON.parse(JSON.stringify(parseSmallState(JSON.parse(JSON.stringify(begin(3, newSmallState(), T5))))));
    expect(round.run.phase).toBe('ask');
  });
});

describe('small test: the weak and the other topics come in', () => {
  it('with every core topic learned, the open, the weak and the never seen topics come before the clean learned ones', () => {
    const ids = TOPICS.map((tp) => tp.id);
    const st: SmallState = {
      ...newSmallState(),
      learned: ids.slice(0, 7),
      seen: ids.slice(0, 7),
      rounds: 5,
      gaps: { 't3:choice:1': { topic: 't3', right: 0, round: 4 } },
      log: { t5: [1, 0, 0], t1: [1, 1, 1] },
      last: { t1: 4, t2: 3, t3: 4, t4: 2, t5: 4, t6: 1, t7: 5 },
    };
    const run = startRound(st, TOPICS, pool, 7).run!;
    const why = Object.fromEntries(run.topics.map((tp) => [tp.id, tp.why]));
    expect(run.topics).toHaveLength(6);
    expect(why.t3).toBe('gap');
    expect(why.t5).toBe('weak');
    expect(why.t8).toBe('new');
    // the other three: the ones that were in a round the longest ago
    expect(Object.keys(why).sort()).toEqual(['t2', 't3', 't4', 't5', 't6', 't8']);
    expect([why.t2, why.t4, why.t6]).toEqual(['repeat', 'repeat', 'repeat']);
    expect(startRound(st, TOPICS, pool, 7).last).toMatchObject({ t3: 6, t8: 6, t1: 4 });
  });

  it('open items and weak topics are all taken before the clean learned ones', () => {
    const learned = ['t1', 't2', 't3', 't4', 't5', 't6', 't7'];
    const st: SmallState = {
      ...newSmallState(),
      rounds: 3,
      learned,
      seen: [...learned, 't8'],
      gaps: { 't1:choice:1': { topic: 't1', right: 0, round: 2 }, 't2:choice:1': { topic: 't2', right: 0, round: 2 }, 't2:choice:2': { topic: 't2', right: 0, round: 2 } },
      log: { t6: [1, 0, 0, 0], t7: [1, 1, 0] },
      last: Object.fromEntries([...learned, 't8'].map((id) => [id, 2])),
    };
    const why = Object.fromEntries(startRound(st, TOPICS, pool, 1).run!.topics.map((tp) => [tp.id, tp.why]));
    expect(why).toMatchObject({ t1: 'gap', t2: 'gap', t6: 'weak', t7: 'weak' });
    expect(Object.values(why).filter((w) => w === 'repeat')).toHaveLength(2);
    // a 4th answer in a topic above the line is not weak: 4 of 5 is exactly 80%
    expect(startRound({ ...st, gaps: {}, log: { t6: [1, 1, 1, 1, 0] } }, TOPICS, pool, 1).run!.topics.every((tp) => tp.why === 'repeat')).toBe(true);
  });
  it('seen unlearned core topics: the one with an open miss and the weak one are picked among more than 6', () => {
    const ids = TOPICS.map((tp) => tp.id);
    const core = ids.map((id) => ({ id, core: true }));
    const st: SmallState = {
      ...newSmallState(),
      rounds: 3,
      seen: ids,
      gaps: { 't7:choice:1': { topic: 't7', right: 0, round: 2 } },
      log: { t8: [1, 0, 0, 1, 1] },
      last: Object.fromEntries(ids.map((id) => [id, 2])),
    };
    for (let seed = 1; seed <= 8; seed++) {
      const run = startRound(st, core, pool, seed).run!;
      const why = Object.fromEntries(run.topics.map((tp) => [tp.id, tp.why]));
      expect(run.topics).toHaveLength(6);
      expect(why.t7).toBe('gap');
      expect(why.t8).toBe('weak');
    }
  });

  it('an unseen core topic still comes before a seen one with an open miss when the places are short', () => {
    const ids = Array.from({ length: 7 }, (_, i) => `u${i}`);
    const core = ids.map((id) => ({ id, core: true }));
    const st: SmallState = { ...newSmallState(), rounds: 1, seen: ['u6'], gaps: { [`u6:${TYPES[0]}:1`]: { topic: 'u6', right: 0, round: 1 } } };
    for (let seed = 1; seed <= 8; seed++) {
      expect(startRound(st, core, pool, seed).run!.topics.map((tp) => tp.id)).not.toContain('u6');
    }
  });

  it('topicWhy falls back to isNew for a run saved before the miss log', () => {
    expect(topicWhy({ isNew: true })).toBe('new');
    expect(topicWhy({ isNew: false })).toBe('repeat');
    expect(topicWhy({ isNew: false, why: 'gap' })).toBe('gap');
  });
});

describe('small test: the hard types of a learned topic', () => {
  it('a learned topic asks a writing type as the base question when it has one', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = begin(seed, { ...newSmallState(), learned: ['t1'] }, [{ id: 't1', core: true }]);
      expect(HARD_TYPES).toContain(s.run!.current!.type);
    }
    // an unlearned topic gets all the types
    const types = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) types.add(begin(seed, newSmallState(), [{ id: 't1', core: true }]).run!.current!.type);
    expect(types.size).toBeGreaterThan(2);
  });

  it('without a writing type any type comes', () => {
    const choiceOnly: SmallPool = (topic) => [1, 2, 3, 4].map((n) => ({ id: `${topic}:choice:${n}`, type: 'choice' as const }));
    const s = beginRound(startRound({ ...newSmallState(), learned: ['t1'] }, [{ id: 't1', core: true }], choiceOnly, 3), choiceOnly);
    expect(s.run!.current!.type).toBe('choice');
  });
});

describe('small test: the practice after a round', () => {
  // the round: the first topic is missed on the base and f2, right on f1 and f3
  const missed = () => {
    const s0 = begin(3, newSmallState(), T5);
    const t = firstTopic(s0);
    return { t, s: play(s0, (n, cur) => !(n === 0 || cur.role === 'f2')) };
  };

  it('lists every miss in the order of the answers, then DRILL_EXTRA new questions of a topic with 2+ misses', () => {
    const { t, s } = missed();
    const list = drillList(s, pool);
    const wrong = s.run!.answers.filter((a) => !a.ok).map((a) => a.qid);
    expect(wrong).toHaveLength(2);
    expect(list.map((c) => c.qid).slice(0, 2)).toEqual(wrong);
    expect(list).toHaveLength(2 + DRILL_EXTRA);
    expect(list.every((c) => c.role === 'drill' && c.topic === t)).toBe(true);
    const asked = s.run!.answers.map((a) => a.qid);
    for (const extra of list.slice(2)) {
      expect(asked).not.toContain(extra.qid);
      expect(HARD_TYPES).toContain(extra.type);
    }
  });

  it('a single miss gives just that question; no miss gives an empty list and no practice', () => {
    const one = play(begin(2, newSmallState(), T5), (n) => n !== 0);
    expect(drillList(one, pool)).toHaveLength(1);
    const clean = play(begin(2, newSmallState(), T5), () => true);
    expect(drillList(clean, pool)).toEqual([]);
    expect(startDrill(clean, pool)).toBe(clean);
  });

  it('is cut at DRILL_MAX; a question that left the content is left out', () => {
    const s = play(begin(2, newSmallState(), T5), () => true);
    const allWrong = { ...s, run: { ...s.run!, answers: s.run!.answers.map((a) => ({ ...a, ok: false })) } };
    expect(drillList(allWrong, pool)).toHaveLength(DRILL_MAX);
    const gone = allWrong.run!.answers[0].qid;
    const noGone: SmallPool = (topic) => pool(topic).filter((q) => q.id !== gone);
    expect(drillList(allWrong, noGone).map((c) => c.qid)).not.toContain(gone);
  });

  it('the practice runs end phase -> drill -> end; a miss in it is a log item, the log and the learned state stay', () => {
    const { s } = missed();
    const list = drillList(s, pool);
    let d = startDrill(s, pool);
    expect(d.run!.phase).toBe('drill');
    expect(d.run!.current).toEqual(list[0]);
    expect(d.run!.drill).toEqual({ list, i: 0, right: 0 });
    const before = { log: s.log, learned: s.learned, clean: s.clean, history: s.history, fixed: s.fixed };
    d = resolveDrill(d, pool, false);
    expect(d.gaps[list[0].qid]).toEqual({ topic: list[0].topic, right: 0, round: 1 });
    expect(d.run!.current).toEqual(list[1]);
    for (let i = 1; i < list.length; i++) d = resolveDrill(d, pool, true);
    expect(d.run!.phase).toBe('end');
    expect(d.run!.current).toBeNull();
    expect(d.run!.drilled).toEqual({ right: list.length - 1, total: list.length });
    expect({ log: d.log, learned: d.learned, clean: d.clean, history: d.history, fixed: d.fixed }).toEqual(before);
    // a right answer in the practice does not touch the log item of the same round
    expect(d.gaps[list[1].qid]).toEqual(s.gaps[list[1].qid]);
    // it is not asked twice
    expect(startDrill(d, pool).run!.phase).toBe('drill');
  });

  it('an answer in the practice that was left on the result card is settled with the saved answer', () => {
    const { s } = missed();
    let d = startDrill(s, pool);
    d = markShown(d, false);
    const settled = settleShown(d, pool);
    expect(settled.run!.drill!.i).toBe(1);
    expect(Object.keys(settled.gaps)).toContain(d.run!.current!.qid);
  });

  it('closing and a new round work without the practice; the saved practice survives a reload and a repair', () => {
    const { s } = missed();
    expect(closeRound(s).run).toBeNull();
    expect(startRound(closeRound(s), T5, pool, 8).run!.phase).toBe('intro');
    const d = startDrill(s, pool);
    const loaded = parseSmallState(JSON.parse(JSON.stringify(d)));
    expect(loaded.run!.phase).toBe('drill');
    expect(repairSmallRun(loaded, pool)).toBe(loaded);
    // the current question left the content: the next one comes
    const gone = d.run!.current!.qid;
    const noGone: SmallPool = (topic) => pool(topic).filter((q) => q.id !== gone);
    const fixed = repairSmallRun(loaded, noGone);
    // the question that left the content is dropped from the list, so the count only holds questions really asked
    expect(fixed.run!.drill!.i).toBe(0);
    expect(fixed.run!.drill!.list).toHaveLength(d.run!.drill!.list.length - 1);
    expect(fixed.run!.current).toEqual(d.run!.drill!.list[1]);
    // all of them left: the practice ends
    const nothing: SmallPool = () => [];
    const ended = repairSmallRun(loaded, nothing);
    expect(ended.run!.phase).toBe('end');
    expect(ended.run!.drilled!.right).toBe(0);
    // a saved drill phase without a drill list falls back to the end screen
    const broken = JSON.parse(JSON.stringify(d));
    delete broken.run.drill;
    expect(parseSmallState(broken).run!.phase).toBe('end');
  });

  it('the logic has no randomness of its own: the same input gives the same practice', () => {
    expect(drillList(missed().s, pool)).toEqual(drillList(missed().s, pool));
  });
});

describe('small test: review fixes', () => {
  const wrongRound = () => {
    const s0 = begin(3, newSmallState(), T5);
    return play(s0, (n, cur) => !(n === 0 || cur.role === 'f2'));
  };

  it('of two weak topics the one with the lower accuracy is taken first (one place left in the round)', () => {
    const ids = ['t1', 't2', 't3', 't4', 't5', 't6', 't7'];
    const topics = ids.map((id) => ({ id, core: false }));
    // 5 topics have an open miss, t1 (1 of 4) and t2 (3 of 5) are weak and compete for the last place; t2 is listed first
    const gaps = Object.fromEntries(['t3', 't4', 't5', 't6', 't7'].map((t) => [`${t}:${TYPES[0]}:1`, { topic: t, right: 0, round: 1 }]));
    const st: SmallState = { ...newSmallState(), rounds: 2, learned: ids, seen: ids, gaps, log: { t1: [1, 0, 0, 0], t2: [1, 1, 1, 0, 0] } };
    for (let seed = 1; seed <= 6; seed++) {
      const got = startRound(st, [topics[1], topics[0], ...topics.slice(2)], pool, seed).run!.topics.map((tp) => tp.id);
      expect(got).toContain('t1');
      expect(got).not.toContain('t2');
    }
  });

  it('a miss-log question is the base question even when it is in `recent` and the type rotation would give another', () => {
    const gapType = TYPES.find((ty) => !HARD_TYPES.includes(ty)) ?? TYPES[0];
    const qid = `t1:${gapType}:2`;
    const st: SmallState = { ...newSmallState(), rounds: 1, learned: ['t1'], seen: ['t1'], recent: [qid], gaps: { [qid]: { topic: 't1', right: 0, round: 1 } } };
    for (let seed = 1; seed <= 6; seed++) {
      const s = begin(seed, st, [{ id: 't1', core: true }]);
      expect(s.run!.current).toMatchObject({ qid, role: 'base' });
    }
  });

  it('a stopped topic: the practice has the wrong quick-check answer after the last miss, extras skip the quick-check questions', () => {
    const s0 = begin(4);
    const t = firstTopic(s0);
    let s = play(s0, (_n, cur) => cur.topic !== t);
    s = finishLesson(openLesson(s), pool);
    const asked = s.run!.mini!.cur.map((q) => q.qid);
    const miniWrong = asked[0];
    for (let i = 0; i < MINI_CHECK_SIZE; i++) s = resolveAnswer(s, pool, i !== 0);
    const done = play(s, () => true);
    expect(done.run!.phase).toBe('end');
    expect(done.run!.mini).toBeNull();
    expect(done.run!.miniAnswers).toHaveLength(MINI_CHECK_SIZE);
    const list = drillList(done, pool).map((c) => c.qid);
    const misses = done.run!.answers.filter((a) => !a.ok).map((a) => a.qid);
    expect(misses).toHaveLength(3);
    expect(list.slice(0, 3)).toEqual(misses);
    expect(list[3]).toBe(miniWrong);
    expect(list.length).toBeGreaterThan(4);
    for (const q of list.slice(4)) expect(asked).not.toContain(q);
    expect(new Set(list).size).toBe(list.length);
    // the answers of the round are untouched
    expect(done.run!.answers).toHaveLength(SMALL_TEST_SIZE);
  });

  it('a miss in the practice does not let the log grow over GAPS_MAX', () => {
    const d = startDrill(wrongRound(), pool);
    const many = Object.fromEntries(Array.from({ length: GAPS_MAX }, (_, i) => [`old${i}`, { topic: 'tx', right: 0, round: i === 0 ? 0 : 1 }]));
    const after = resolveDrill({ ...d, gaps: many }, pool, false);
    expect(Object.keys(after.gaps)).toHaveLength(GAPS_MAX);
    expect(after.gaps.old0).toBeUndefined();
    expect(after.gaps[d.run!.current!.qid]).toBeDefined();
  });

  it('a damaged practice in a save: bad list items drop out, a bad index or an empty list ends it, a bad `drilled` is dropped', () => {
    const d = startDrill(wrongRound(), pool);
    const raw = () => JSON.parse(JSON.stringify(d));
    const items = d.run!.drill!.list.length;
    const bad = raw();
    bad.run.drill.list = ['x', null, { topic: 't1' }, ...bad.run.drill.list];
    const a = parseSmallState(bad);
    expect(a.run!.phase).toBe('drill');
    expect(a.run!.drill!.list).toHaveLength(items);
    expect(a.run!.drill!.i).toBe(0);
    for (const patch of [{ i: -1 }, { i: 99 }, { i: 'x' }, { right: -2 }, { right: null }, { list: [] }]) {
      const r = raw();
      Object.assign(r.run.drill, patch);
      const e = parseSmallState(r);
      expect(e.run!.phase).toBe('end');
      expect(e.run!.current).toBeNull();
      expect(e.run!.drill).toBeUndefined();
    }
    let fin = startDrill(wrongRound(), pool);
    for (let i = 0; i < items; i++) fin = resolveDrill(fin, pool, true);
    expect(parseSmallState(JSON.parse(JSON.stringify(fin))).run!.drilled).toEqual({ right: items, total: items });
    for (const drilled of [{ right: 'x', total: 3 }, { right: 1, total: -1 }, { right: 1 }, 'no']) {
      const r = JSON.parse(JSON.stringify(fin));
      r.run.drilled = drilled;
      const e = parseSmallState(r);
      expect(e.run!.phase).toBe('end');
      expect(e.run!.drilled).toBeUndefined();
    }
  });

  it('an old save without `miniAnswers` keeps its run', () => {
    const s = begin(3, newSmallState(), T5);
    const raw = JSON.parse(JSON.stringify(s));
    delete raw.run.miniAnswers;
    const loaded = parseSmallState(raw);
    expect(loaded.run).not.toBeNull();
    expect(loaded.run!.phase).toBe('ask');
    expect(drillList(loaded, pool)).toEqual([]);
  });
});

describe('small test: clean level', () => {
  const ids = TOPICS.map((tp) => tp.id);
  const done = { ...newSmallState(), learned: ids };
  it('counts the open miss items', () => {
    expect(gapCount(newSmallState())).toBe(0);
    expect(gapCount({ ...done, gaps: { a: { topic: 't1', right: 0, round: 1 } } })).toBe(1);
  });

  it('is clean only when done, no open item, all usable topics learned and none weak', () => {
    expect(isLevelClean(done, ids, ids.slice(0, 7))).toBe(true);
    expect(isLevelClean({ ...done, learned: ids.slice(0, 7) }, ids, ids.slice(0, 7))).toBe(false);
    expect(isLevelClean({ ...done, learned: ids.slice(0, 7) }, ids.slice(0, 7), ids.slice(0, 7))).toBe(true);
    expect(isLevelClean({ ...done, gaps: { a: { topic: 't1', right: 0, round: 1 } } }, ids, ids.slice(0, 7))).toBe(false);
    expect(isLevelClean({ ...done, log: { t8: [1, 0, 0] } }, ids, ids.slice(0, 7))).toBe(false);
    expect(isLevelClean({ ...done, log: { t8: [1, 1, 1, 1, 0] } }, ids, ids.slice(0, 7))).toBe(true);
    expect(isLevelClean({ ...done, log: { t8: [0, 0] } }, ids, ids.slice(0, 7))).toBe(true);
    expect(isLevelClean(newSmallState(), ids, ids.slice(0, 7))).toBe(false);
  });
});