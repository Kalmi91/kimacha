import {
  LONG_TEST_SIZE,
  SMALL_TEST_SIZE,
  beginRound,
  finishLesson,
  newSmallState,
  openLesson,
  parseSmallState,
  resolveAnswer,
  runSize,
  startRound,
  type SmallCur,
  type SmallPool,
  type SmallState,
} from '../smallTest';
import { TASK_TYPE_IDS } from '../taskTypes';

const TOPICS = Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, core: i < 4 }));
const TYPES = TASK_TYPE_IDS.slice(0, 4);
const pool: SmallPool = (topic) => TYPES.flatMap((type) => [1, 2, 3, 4].map((n) => ({ id: `${topic}:${type}:${n}`, type })));
const begin = (st = newSmallState(), seed = 11) => beginRound(startRound(st, TOPICS, pool, seed), pool, LONG_TEST_SIZE);
const play = (st: SmallState, ok: (cur: SmallCur, n: number) => boolean = () => true, questions = pool) => {
  let next = st;
  for (let n = 0; next.run!.phase === 'ask' && n < LONG_TEST_SIZE + 1; n++) {
    next = resolveAnswer(next, questions, ok(next.run!.current!, next.run!.answers.length));
  }
  expect(next.run!.phase).toBe('end');
  return next;
};

describe('long small test', () => {
  it('reaches 20 answers with follow-ups and keeps the intro topics', () => {
    const intro = startRound(newSmallState(), TOPICS, pool, 11);
    const started = beginRound(intro, pool, LONG_TEST_SIZE);
    const done = play(started, (_cur, n) => n > 1);
    expect(done.run!.topics).toEqual(intro.run!.topics);
    expect(done.run!.answers).toHaveLength(LONG_TEST_SIZE);
    expect(new Set(done.run!.answers.map((a) => a.qid)).size).toBe(LONG_TEST_SIZE);
    expect(runSize(done.run!)).toBe(LONG_TEST_SIZE);
  });

  it('gives new, weak and unlearned core topics multiple different task types, spaced apart', () => {
    const st = { ...newSmallState(), seen: ['t0', 't1', 't2'], log: { t0: [1, 0, 0] }, gaps: { [pool('t1')[0].id]: { topic: 't1', right: 0, round: 0 } } };
    const done = play(begin(st));
    for (const tp of done.run!.topics) {
      const answers = done.run!.answers.filter((a) => a.topic === tp.id);
      expect(answers.length).toBeGreaterThanOrEqual(2);
      expect(new Set(answers.slice(0, 3).map((a) => a.type)).size).toBe(Math.min(3, answers.length));
    }
    expect(done.run!.answers.every((a, i, all) => i === 0 || a.topic !== all[i - 1].topic)).toBe(true);
  });

  it('learns a topic after three right answers in the same round', () => {
    const done = play(begin());
    for (const tp of TOPICS) {
      expect(done.run!.answers.filter((a) => a.topic === tp.id && a.ok).length).toBeGreaterThanOrEqual(3);
      expect(done.learned).toContain(tp.id);
    }
  });

  it('fills three base questions for gap, weak, new and unlearned core topics and two for the others before any top-up', () => {
    const st = {
      ...newSmallState(),
      seen: ['t0', 't1', 't2', 't4', 't5'],
      learned: ['t0', 't1', 't5'],
      log: { t0: [1, 0, 0] },
      gaps: { [pool('t1')[0].id]: { topic: 't1', right: 0, round: 0 } },
    };
    const done = play(begin(st));
    // the budgets add up to 16: those come first, then the round tops up to 20
    const first = done.run!.answers.slice(0, 16);
    for (const tp of TOPICS) {
      const answers = first.filter((a) => a.topic === tp.id && a.role === 'base');
      expect(answers).toHaveLength(tp.id === 't4' || tp.id === 't5' ? 2 : 3);
      expect(new Set(answers.map((a) => a.type)).size).toBe(answers.length);
    }
    expect(done.run!.answers).toHaveLength(LONG_TEST_SIZE);
  });

  it('tops a clean six-topic round up to 20 after three questions per topic', () => {
    const done = play(begin());
    for (const tp of TOPICS) expect(done.run!.answers.slice(0, 18).filter((a) => a.topic === tp.id)).toHaveLength(3);
    expect(done.run!.answers).toHaveLength(LONG_TEST_SIZE);
  });

  it('prefers unused task types even when their questions were seen recently', () => {
    const recent = TOPICS.flatMap((tp) => pool(tp.id).filter((q) => q.type !== TYPES[0]).map((q) => q.id));
    const done = play(begin({ ...newSmallState(), recent }));
    for (const tp of TOPICS) {
      expect(new Set(done.run!.answers.filter((a) => a.topic === tp.id).slice(0, 3).map((a) => a.type)).size).toBe(3);
    }
  });

  it('keeps asking different questions when a topic has only one type', () => {
    const oneType: SmallPool = (topic) => pool(topic).filter((q) => q.type === TYPES[0]);
    const done = play(beginRound(startRound(newSmallState(), TOPICS, oneType, 11), oneType, LONG_TEST_SIZE), () => true, oneType);
    for (const tp of TOPICS) expect(done.run!.answers.filter((a) => a.topic === tp.id).length).toBeGreaterThanOrEqual(2);
    expect(new Set(done.run!.answers.map((a) => a.qid)).size).toBe(done.run!.answers.length);
  });

  it('ends when the available questions run out', () => {
    const tiny: SmallPool = (topic) => pool(topic).slice(0, 1);
    const done = play(beginRound(startRound(newSmallState(), TOPICS, tiny, 11), tiny, LONG_TEST_SIZE), () => true, tiny);
    expect(done.run!.answers).toHaveLength(TOPICS.length);
  });

  it('retains the miss follow-ups within five questions and the stop, lesson and quick check', () => {
    let st = begin(newSmallState(), 4);
    const topic = st.run!.current!.topic;
    for (let n = 0; st.run!.phase === 'ask' && n < LONG_TEST_SIZE; n++) st = resolveAnswer(st, pool, st.run!.current!.topic !== topic);
    expect(st.run!.phase).toBe('stop');
    const follow = st.run!.answers.map((a, i) => ({ ...a, i })).filter((a) => a.topic === topic);
    expect(follow.map((a) => a.role)).toEqual(['base', 'f1', 'f2']);
    expect(follow[1].i).toBeGreaterThanOrEqual(2);
    expect(follow[2].i - follow[1].i).toBeGreaterThanOrEqual(2);
    expect(follow[2].i).toBeLessThanOrEqual(5);
    const answered = st.run!.answers.length;
    st = finishLesson(openLesson(st), pool);
    expect(st.run!.phase).toBe('mini');
    for (let i = 0; i < 3; i++) st = resolveAnswer(st, pool, true);
    expect(st.run!.phase).toBe('ask');
    expect(st.run!.answers).toHaveLength(answered);
    expect(runSize(st.run!)).toBe(LONG_TEST_SIZE);
    expect(play(st).learned).not.toContain(topic);
  });

  it('parses an old run without size as 10 and a new saved run as 20', () => {
    const old = startRound(newSmallState(), TOPICS, pool, 11);
    expect(old.run!.size).toBeUndefined();
    expect(runSize(parseSmallState(JSON.parse(JSON.stringify(old))).run!)).toBe(SMALL_TEST_SIZE);
    let st = begin();
    st = resolveAnswer(resolveAnswer(st, pool, true), pool, true);
    const loaded = parseSmallState(JSON.parse(JSON.stringify(st)));
    expect(loaded.run!.size).toBe(LONG_TEST_SIZE);
    expect(loaded.run!.current).toEqual(st.run!.current);
    expect(loaded.run!.answers).toHaveLength(2);
  });

  it('normalizes a damaged size to 10 and does not resize a started round', () => {
    const st = begin();
    const damaged = { ...st, run: { ...st.run!, size: 99 } };
    expect(runSize(parseSmallState(damaged).run!)).toBe(SMALL_TEST_SIZE);
    expect(beginRound(st, pool, SMALL_TEST_SIZE)).toBe(st);
  });

  it('still ends a default short round at 10', () => {
    const done = play(beginRound(startRound(newSmallState(), TOPICS, pool, 11), pool));
    expect(done.run!.answers).toHaveLength(SMALL_TEST_SIZE);
    expect(runSize(done.run!)).toBe(SMALL_TEST_SIZE);
  });
});
