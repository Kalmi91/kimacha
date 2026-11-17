import {
  SMALL_TEST_SIZE,
  MINI_CHECK_SIZE,
  beginRound,
  finishLesson,
  isLevelDone,
  levelProgress,
  loadSmallState,
  newSmallState,
  openLesson,
  parseSmallState,
  repairSmallRun,
  resolveAnswer,
  roundRows,
  saveSmallState,
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

  it('mixed follow-ups (1 right, 1 wrong): a 3rd question; right -> learned', () => {
    const s0 = begin(3);
    const t = firstTopic(s0);
    const s = play(s0, (n, cur) => !(n === 0 || cur.role === 'f2'));
    expect(roles(s, t).map((r) => r.role)).toEqual(['base', 'f1', 'f2', 'f3']);
    expect(s.learned).toContain(t);
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
