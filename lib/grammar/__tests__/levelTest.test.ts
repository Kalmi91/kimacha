// The grammar level test engine (lib/grammar/levelTest.ts): which topic comes next (core first, lowest percent first,
// no immediate repeat), which question of the topic, the level percent and the done state.

import type { GrammarKind } from '@/lib/games/content';
import { appendEvidence, topicTicked, type EvidenceAnswer, type PickTopic, type TopicEvidence } from '@/lib/grammar/randomRound';
import { levelDone, levelPercent, pickLevelNext, pickLevelQuestion, pickLevelTopic, type LevelTestCtx } from '@/lib/grammar/levelTest';

const topic = (id: string, tier: PickTopic['tier']): PickTopic => ({ id, level: 'A1', tier });

// answers: 'c1' = right choice, 'x' = wrong choice, 'f' = right form; ids are numbered per call
const evOf = (spec: string[]): TopicEvidence => ({
  answers: spec.map((s, i) => ({ id: `e${i}`, kind: (s === 'f' ? 'form' : 'choice') as GrammarKind, ok: s !== 'x', at: '2026-11-01' })),
});
const ticked = (): TopicEvidence => evOf(['c', 'f', 'c', 'f', 'c']); // 5 answers, 100%, two kinds
const evidenceOf = (entries: Record<string, TopicEvidence>) => new Map(Object.entries(entries));

describe('levelPercent / levelDone', () => {
  it('is the average of the topic percents, a topic without a percent counts 0', () => {
    const ev = evidenceOf({ a: evOf(['c', 'c', 'c', 'c']), b: evOf(['c', 'x']) /* 2 answers: no percent */, c: evOf(['c', 'c', 'x', 'x']) });
    // a 100, b 0 (no percent yet), c 50, d no answers
    expect(levelPercent(['a', 'b', 'c', 'd'], ev)).toBe(Math.round(150 / 4));
    expect(levelPercent(['a'], ev)).toBe(100);
  });

  it('is 0 for no topics and for no answers', () => {
    expect(levelPercent([], new Map())).toBe(0);
    expect(levelPercent(['a', 'b'], new Map())).toBe(0);
  });

  it('is done only when every topic is ticked (and there is a topic)', () => {
    expect(levelDone([], new Map())).toBe(false);
    expect(levelDone(['a', 'b'], evidenceOf({ a: ticked() }))).toBe(false);
    expect(levelDone(['a', 'b'], evidenceOf({ a: ticked(), b: ticked() }))).toBe(true);
    // 100% but one kind only: not ticked
    expect(levelDone(['a'], evidenceOf({ a: evOf(['c', 'c', 'c', 'c', 'c']) }))).toBe(false);
  });
});

describe('pickLevelTopic', () => {
  const topics = [topic('plain1', 'exam'), topic('core1', 'core'), topic('plus1', 'core-plus'), topic('plain2', 'full')];

  it('a topic without any answer comes first, core+ before core before the rest on a tie', () => {
    expect(pickLevelTopic(topics, new Map())).toBe('plus1');
    expect(pickLevelTopic([topic('x', 'full'), topic('y', 'core')], new Map())).toBe('y');
  });

  it('takes the unticked core topic with the lowest percent, whatever the other tiers need', () => {
    const ev = evidenceOf({
      plus1: evOf(['c', 'c', 'c', 'x']), // 75
      core1: evOf(['c', 'x', 'x', 'x']), // 25
      plain1: evOf(['x', 'x', 'x', 'x']), // 0, but not core
    });
    expect(pickLevelTopic(topics, ev)).toBe('core1');
  });

  it('a topic with 1-2 answers (no percent yet) ranks by its share of right answers, after the unanswered ones', () => {
    const ev = evidenceOf({ plus1: evOf(['x']), core1: evOf(['c', 'c']) });
    // all four unticked core: plus1 (0%) and core1 (100%); the others are not core
    expect(pickLevelTopic(topics, ev)).toBe('plus1');
    expect(pickLevelTopic(topics.slice(0, 3), evidenceOf({ plus1: evOf(['c']) }))).toBe('core1'); // core1 has no answer: below plus1
  });

  it('leaves the previous topic out when there is another candidate, takes it when it is the only one', () => {
    expect(pickLevelTopic(topics, new Map(), 'plus1')).toBe('core1');
    expect(pickLevelTopic([topic('only', 'core'), topic('p', 'full')], evidenceOf({ p: ticked() }), 'only')).toBe('only');
    expect(pickLevelTopic([topic('only', 'core')], new Map(), 'only')).toBe('only');
  });

  it('once every core topic is ticked the other tiers come, lowest percent first', () => {
    const ev = evidenceOf({
      plus1: ticked(),
      core1: ticked(),
      plain1: evOf(['c', 'c', 'c', 'x']), // 75
      plain2: evOf(['c', 'x', 'x', 'x']), // 25
    });
    expect(pickLevelTopic(topics, ev)).toBe('plain2');
  });

  it('when everything is ticked the whole level goes on, lowest percent first, core before the rest on a tie', () => {
    const lower = evOf(['c', 'f', 'c', 'f', 'c', 'x', 'c', 'f']); // 87.5 -> 88%, still ticked
    const ev = evidenceOf({ plus1: ticked(), core1: lower, plain1: ticked(), plain2: ticked() });
    expect(topicTicked(lower)).toBe(true);
    expect(pickLevelTopic(topics, ev)).toBe('core1');
    expect(pickLevelTopic(topics, evidenceOf({ plus1: ticked(), core1: ticked(), plain1: ticked(), plain2: ticked() }))).toBe('plus1');
  });

  it('evidence growth moves the pick: a wrong answer keeps a topic up front, right ones hand over to the next', () => {
    let ev = new Map<string, TopicEvidence>();
    const answer = (id: string, ok: boolean, i: number, kind: GrammarKind = 'choice') => {
      const a: EvidenceAnswer = { id: `q${i}`, kind, ok, at: '2026-11-01' };
      ev = new Map(ev).set(id, appendEvidence(ev.get(id), a));
    };
    const two = [topic('a', 'core'), topic('b', 'core')];
    expect(pickLevelTopic(two, ev)).toBe('a');
    answer('a', true, 0);
    expect(pickLevelTopic(two, ev)).toBe('b'); // b has no answer
    answer('b', false, 1);
    expect(pickLevelTopic(two, ev)).toBe('b'); // b 0% < a 100%
    expect(pickLevelTopic(two, ev, 'b')).toBe('a'); // ... but never twice in a row while another one exists
    answer('b', true, 2);
    answer('b', true, 3);
    answer('b', true, 4);
    expect(pickLevelTopic(two, ev)).toBe('b'); // b is at 75%, a (one answer, no percent yet) counts 100
    answer('a', false, 5);
    answer('a', false, 6);
    answer('a', false, 7);
    expect(pickLevelTopic(two, ev)).toBe('a'); // a fell to 25%: it moves to the front
  });

  it('is null for a level without topics', () => {
    expect(pickLevelTopic([], new Map())).toBeNull();
  });
});

describe('pickLevelQuestion', () => {
  const q = (id: string, kind: GrammarKind) => ({ id, kind });
  const ctxOf = (qs: { id: string; kind: GrammarKind }[], ev: TopicEvidence | undefined): LevelTestCtx => ({
    topics: [topic('t', 'core')],
    evidence: ev ? evidenceOf({ t: ev }) : new Map(),
    questionIds: () => qs,
  });

  it('is null for a topic without questions', () => {
    expect(pickLevelQuestion('t', ctxOf([], undefined), 1)).toBeNull();
  });

  it('asks a question that is not among the last answers first', () => {
    const qs = [q('a', 'choice'), q('b', 'choice'), q('c', 'choice')];
    const ev: TopicEvidence = { answers: [{ id: 'a', kind: 'choice', ok: true, at: 'x' }, { id: 'b', kind: 'choice', ok: false, at: 'x' }] };
    for (let seed = 0; seed < 20; seed++) expect(pickLevelQuestion('t', ctxOf(qs, ev), seed)).toBe('c');
  });

  it('prefers the kind the last answers hold least (a new kind first)', () => {
    const qs = [q('a', 'choice'), q('b', 'choice'), q('c', 'choice'), q('f1', 'form'), q('f2', 'form')];
    const ev: TopicEvidence = { answers: [{ id: 'a', kind: 'choice', ok: true, at: 'x' }, { id: 'b', kind: 'choice', ok: true, at: 'x' }] };
    for (let seed = 0; seed < 20; seed++) expect(['f1', 'f2']).toContain(pickLevelQuestion('t', ctxOf(qs, ev), seed));
    // no answers at all: any kind
    expect(['a', 'b', 'c', 'f1', 'f2']).toContain(pickLevelQuestion('t', ctxOf(qs, undefined), 3));
  });

  it('never runs dry: with every question in the window, the one answered longest ago comes back', () => {
    const qs = [q('a', 'choice'), q('b', 'choice'), q('c', 'form')];
    const answers = ['b', 'c', 'a', 'c', 'a'].map((id) => ({ id, kind: (id === 'c' ? 'form' : 'choice') as GrammarKind, ok: true, at: 'x' }));
    // last positions: b 0, c 3, a 4 -> b
    expect(pickLevelQuestion('t', ctxOf(qs, { answers }), 5)).toBe('b');
  });

  it('is repeatable for the same seed', () => {
    const qs = Array.from({ length: 8 }, (_, i) => q(`q${i}`, 'choice'));
    expect(pickLevelQuestion('t', ctxOf(qs, undefined), 42)).toBe(pickLevelQuestion('t', ctxOf(qs, undefined), 42));
  });
});

describe('pickLevelNext', () => {
  it('gives the topic and a question of it, null for an empty level or a level without questions', () => {
    const ctx: LevelTestCtx = {
      topics: [topic('a', 'core'), topic('b', 'core')],
      evidence: new Map(),
      questionIds: (id) => [{ id: `${id}-1`, kind: 'choice' }],
    };
    expect(pickLevelNext(ctx, undefined, 1)).toEqual({ topicId: 'a', qid: 'a-1' });
    expect(pickLevelNext(ctx, 'a', 1)).toEqual({ topicId: 'b', qid: 'b-1' });
    expect(pickLevelNext({ ...ctx, topics: [] }, undefined, 1)).toBeNull();
    expect(pickLevelNext({ ...ctx, questionIds: () => [] }, undefined, 1)).toBeNull();
  });
});
