// The grammar level test engine (lib/grammar/levelTest.ts): which topic comes next (core first, lowest percent first,
// no immediate repeat), which question of the topic, the level percent and the done state.

import type { GrammarKind } from '@/lib/games/content';
import { SEEN_CAP, appendEvidence, seenIds, topicPercent, topicTicked, type EvidenceAnswer, type PickTopic, type TopicEvidence } from '@/lib/grammar/randomRound';
import {
  LEVEL_ROUND_SIZE,
  levelDone,
  levelPercent,
  levelRoundKey,
  levelShownKey,
  nextShownPct,
  parseLevelRound,
  parseShownPct,
  pickLevelNext,
  pickLevelQuestion,
  pickLevelTopic,
  recordRoundAnswer,
  roundTopicRows,
  shownLabel,
  shownPctOf,
  hasTopicPercent,
  weakestTopic,
  weakestTopics,
  type LevelTestCtx,
} from '@/lib/grammar/levelTest';

// every topic of these tests has two kinds (the usual case); the one-kind case has its own tests below
const TWO = () => 2;
const pick = (topics: PickTopic[], ev: Map<string, TopicEvidence>, prev?: string) => pickLevelTopic(topics, ev, TWO, prev);
const done = (ids: string[], ev: Map<string, TopicEvidence>) => levelDone(ids, ev, TWO);

const topic = (id: string, tier: PickTopic['tier']): PickTopic => ({ id, level: 'A1', tier });

// answers: 'c1' = right choice, 'x' = wrong choice, 'f' = right form; ids are numbered per call
const evOf = (spec: string[]): TopicEvidence => ({
  answers: spec.map((s, i) => ({ id: `e${i}`, kind: (s === 'f' ? 'form' : 'choice') as GrammarKind, ok: s !== 'x', at: '2026-11-01' })),
});
const ticked = (): TopicEvidence => evOf(['c', 'f', 'c', 'f', 'c']); // 5 answers, 100%, two kinds
const evidenceOf = (entries: Record<string, TopicEvidence>) => new Map(Object.entries(entries));

describe('levelPercent / levelDone', () => {
  it('is the average of the topic shares: from 3 answers the percent, with 1 or 2 the right ones over 3, none = 0', () => {
    const ev = evidenceOf({ a: evOf(['c', 'c', 'c', 'c']), b: evOf(['c', 'x']) /* 2 answers: no percent */, c: evOf(['c', 'c', 'x', 'x']) });
    // a 100, b 33 (1 right of 2), c 50, d no answers
    expect(levelPercent(['a', 'b', 'c', 'd'], ev)).toBe(Math.round(183 / 4));
    expect(levelPercent(['a'], ev)).toBe(100);
  });

  it('is 0 for no topics and for no answers', () => {
    expect(levelPercent([], new Map())).toBe(0);
    expect(levelPercent(['a', 'b'], new Map())).toBe(0);
  });

  it('is done only when every topic is ticked (and there is a topic)', () => {
    expect(done([], new Map())).toBe(false);
    expect(done(['a', 'b'], evidenceOf({ a: ticked() }))).toBe(false);
    expect(done(['a', 'b'], evidenceOf({ a: ticked(), b: ticked() }))).toBe(true);
    // 100% but one kind only: not ticked
    expect(done(['a'], evidenceOf({ a: evOf(['c', 'c', 'c', 'c', 'c']) }))).toBe(false);
  });
});

describe('a topic with one exercise kind', () => {
  // the reported case: es A2 indefinido-10-verbos has 50 transform items and no other kind
  const transformOnly = (n: number, oks: boolean[] = []): TopicEvidence => ({
    answers: Array.from({ length: n }, (_, i) => ({ id: `t${i}`, kind: 'transform' as GrammarKind, ok: oks[i] ?? true, at: '2026-11-01' })),
  });
  const kindsOf = (id: string) => (id === 'one' ? 1 : 2);

  it('ticks on answers and percent alone, so the level can be done', () => {
    const ids = ['a', 'one'];
    expect(levelDone(ids, evidenceOf({ a: ticked(), one: transformOnly(5) }), kindsOf)).toBe(true);
    expect(levelDone(ids, evidenceOf({ a: ticked(), one: transformOnly(5) }), () => 2)).toBe(false); // the old rule: stuck
    expect(levelDone(ids, evidenceOf({ a: ticked(), one: transformOnly(5, [true, false, false, true, true]) }), kindsOf)).toBe(false); // 60%
  });

  it('is out of the pool once ticked: the pick moves on to the other tiers, then the level runs on from the lowest', () => {
    const topics = [topic('one', 'core'), topic('core2', 'core'), topic('plain', 'full')];
    const ev = evidenceOf({ core2: ticked(), plain: evOf(['c', 'x', 'x', 'x']) });
    // not ticked yet: the one-kind core topic is the open core topic
    expect(pickLevelTopic(topics, evidenceOf({ ...Object.fromEntries(ev), one: transformOnly(4) }), kindsOf)).toBe('one');
    // ticked: the other tier comes (plain, 25%)
    expect(pickLevelTopic(topics, evidenceOf({ ...Object.fromEntries(ev), one: transformOnly(5) }), kindsOf)).toBe('plain');
    // with the old rule it never ticks and stays the only pick forever
    expect(pickLevelTopic(topics, evidenceOf({ ...Object.fromEntries(ev), one: transformOnly(5) }), () => 2)).toBe('one');
  });
});

describe('pickLevelTopic', () => {
  const topics = [topic('plain1', 'exam'), topic('core1', 'core'), topic('plus1', 'core-plus'), topic('plain2', 'full')];

  it('a topic without any answer comes first, core+ before core before the rest on a tie', () => {
    expect(pick(topics, new Map())).toBe('plus1');
    expect(pick([topic('x', 'full'), topic('y', 'core')], new Map())).toBe('y');
  });

  it('takes the unticked core topic with the lowest percent, whatever the other tiers need', () => {
    const ev = evidenceOf({
      plus1: evOf(['c', 'c', 'c', 'x']), // 75
      core1: evOf(['c', 'x', 'x', 'x']), // 25
      plain1: evOf(['x', 'x', 'x', 'x']), // 0, but not core
    });
    expect(pick(topics, ev)).toBe('core1');
  });

  it('a topic with 1-2 answers (no percent yet) ranks by its share of right answers, after the unanswered ones', () => {
    const ev = evidenceOf({ plus1: evOf(['x']), core1: evOf(['c', 'c']) });
    // all four unticked core: plus1 (0%) and core1 (100%); the others are not core
    expect(pick(topics, ev)).toBe('plus1');
    expect(pick(topics.slice(0, 3), evidenceOf({ plus1: evOf(['c']) }))).toBe('core1'); // core1 has no answer: below plus1
  });

  it('leaves the previous topic out when there is another candidate, takes it when it is the only one', () => {
    expect(pick(topics, new Map(), 'plus1')).toBe('core1');
    expect(pick([topic('only', 'core'), topic('p', 'full')], evidenceOf({ p: ticked() }), 'only')).toBe('only');
    expect(pick([topic('only', 'core')], new Map(), 'only')).toBe('only');
  });

  it('once every core topic is ticked the other tiers come, lowest percent first', () => {
    const ev = evidenceOf({
      plus1: ticked(),
      core1: ticked(),
      plain1: evOf(['c', 'c', 'c', 'x']), // 75
      plain2: evOf(['c', 'x', 'x', 'x']), // 25
    });
    expect(pick(topics, ev)).toBe('plain2');
  });

  it('when everything is ticked the whole level goes on, lowest percent first, core before the rest on a tie', () => {
    const lower = evOf(['c', 'f', 'c', 'f', 'c', 'x', 'c', 'f']); // 87.5 -> 88%, still ticked
    const ev = evidenceOf({ plus1: ticked(), core1: lower, plain1: ticked(), plain2: ticked() });
    expect(topicTicked(lower)).toBe(true);
    expect(pick(topics, ev)).toBe('core1');
    expect(pick(topics, evidenceOf({ plus1: ticked(), core1: ticked(), plain1: ticked(), plain2: ticked() }))).toBe('plus1');
  });

  it('the open topics take turns: the least recently asked first, a weak one keeps coming without starving the other', () => {
    let ev = new Map<string, TopicEvidence>();
    const answer = (id: string, ok: boolean, i: number, kind: GrammarKind = 'choice') => {
      const a: EvidenceAnswer = { id: `q${i}`, kind, ok, at: '2026-11-01' };
      ev = new Map(ev).set(id, appendEvidence(ev.get(id), a, i + 1));
    };
    const two = [topic('a', 'core'), topic('b', 'core')];
    expect(pick(two, ev)).toBe('a');
    answer('a', true, 0);
    expect(pick(two, ev)).toBe('b'); // b has no answer
    answer('b', false, 1);
    expect(pick(two, ev)).toBe('a'); // a was asked longer ago, although b is weaker
    expect(pick(two, ev, 'a')).toBe('b'); // never twice in a row while another one exists
    answer('a', true, 2);
    expect(pick(two, ev)).toBe('b'); // the weak topic comes every second question
    for (let i = 3; i < 13; i++) {
      const id = pick(two, ev)!;
      answer(id, id === 'a', i);
      expect(id).toBe(i % 2 === 1 ? 'b' : 'a');
    }
  });

  it('with equal stamps (evidence saved before) the lower percent goes first', () => {
    expect(pick([topic('a', 'core'), topic('b', 'core')], evidenceOf({ a: evOf(['c', 'c', 'c']), b: evOf(['x', 'x', 'c']) }))).toBe('b');
  });

  it('strictly core first: no other tier while a core topic is open, then the other tiers, then the whole level by lowest percent', () => {
    const topics = [topic('c', 'core'), topic('plain', 'exam'), topic('p', 'core-plus')];
    const ev = evidenceOf({ c: { ...evOf(['c', 'c', 'c']), stamp: 99 }, p: { ...evOf(['c', 'c', 'c']), stamp: 98 } });
    expect(pick(topics, ev, 'c')).toBe('p'); // plain was never asked, but it is not core
    expect(pick(topics, ev, 'p')).toBe('c');
    expect(pick(topics, evidenceOf({ c: ticked(), p: ticked() }))).toBe('plain');
    const lower = evOf(['c', 'f', 'c', 'f', 'c', 'x', 'c', 'f']); // 88%, still ticked
    expect(pick(topics, evidenceOf({ c: ticked(), p: ticked(), plain: lower }))).toBe('plain');
    expect(pick(topics, evidenceOf({ c: lower, p: ticked(), plain: ticked() }))).toBe('c');
  });

  it('a returning learner with one never asked topic gets it once, then the rotation goes on (no burst)', () => {
    const topics = Array.from({ length: 4 }, (_, i) => topic(`t${i}`, 'core'));
    let ev = evidenceOf({ t0: { ...evOf(['c', 'x']), stamp: 50 }, t1: { ...evOf(['x', 'x']), stamp: 10 }, t2: { ...evOf(['x']), stamp: 30 } });
    const got: string[] = [];
    let prev: string | undefined;
    for (let i = 0; i < 8; i++) {
      const id = pick(topics, ev, prev)!;
      got.push(id);
      ev = new Map(ev).set(id, appendEvidence(ev.get(id), { id: `n${i}`, kind: 'choice', ok: false, at: 'x' }, 100 + i));
      prev = id;
    }
    expect(got.slice(0, 4)).toEqual(['t3', 't1', 't2', 't0']); // never asked, then the oldest stamp first
    expect(got.slice(4)).toEqual(got.slice(0, 4));
  });

  it('is null for a level without topics', () => {
    expect(pick([], new Map())).toBeNull();
  });
});

describe('appendEvidence: stamp and the pass over the questions', () => {
  const a = (id: string): EvidenceAnswer => ({ id, kind: 'choice', ok: true, at: 'x' });

  it('keeps the stamp and the ids of the pass; a repeat alone (random round, no question list) does not reset it', () => {
    let ev: TopicEvidence | undefined;
    for (let i = 0; i < 12; i++) ev = appendEvidence(ev, a(`q${i}`), 7);
    expect(ev!.answers).toHaveLength(10);
    expect(ev!.stamp).toBe(7);
    expect(ev!.seen).toHaveLength(12);
    ev = appendEvidence(ev, a('q3'), 8);
    expect(ev.seen).toHaveLength(12);
    expect(ev.stamp).toBe(8);
  });

  it('with the question list: ids of questions that are gone are dropped, a finished pass starts again with this answer', () => {
    const ids = ['x', 'y', 'z'];
    let ev = appendEvidence(undefined, a('old-gone'), 1, ids);
    ev = appendEvidence(ev, a('x'), 2, ids);
    expect(ev.seen).toEqual(['x']); // the gone id was dropped on the next answer
    ev = appendEvidence(ev, a('y'), 3, ids);
    ev = appendEvidence(ev, a('z'), 4, ids);
    expect(ev.seen).toEqual(['x', 'y', 'z']);
    ev = appendEvidence(ev, a('y'), 5, ids); // every question was in: a new pass
    expect(ev.seen).toEqual(['y']);
  });

  it('caps the pass at SEEN_CAP ids (topics whose questions get new ids every visit)', () => {
    let ev: TopicEvidence | undefined;
    for (let i = 0; i < SEEN_CAP + 30; i++) ev = appendEvidence(ev, a(`s${i}`), i);
    expect(ev!.seen).toHaveLength(SEEN_CAP);
    expect(ev!.seen![SEEN_CAP - 1]).toBe(`s${SEEN_CAP + 29}`);
  });

  it('evidence saved before (no stamp, no seen) counts with its window', () => {
    const old: TopicEvidence = { answers: [a('x'), a('y')] };
    expect(seenIds(old)).toEqual(['x', 'y']);
    expect(seenIds(undefined)).toEqual([]);
    expect(appendEvidence(old, a('z'), 1).seen).toEqual(['x', 'y', 'z']);
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

  it('never runs dry: with every question in the window a new pass starts, not with the one just answered, with the kind balance', () => {
    const qs = [q('a', 'choice'), q('b', 'choice'), q('c', 'form')];
    const answers = ['b', 'c', 'a', 'c', 'a'].map((id) => ({ id, kind: (id === 'c' ? 'form' : 'choice') as GrammarKind, ok: true, at: 'x' }));
    // the window holds 3 choice and 2 form answers: b (choice) or c (form), form is the lesser kind
    for (let seed = 0; seed < 10; seed++) expect(pickLevelQuestion('t', ctxOf(qs, { answers }), seed)).toBe('c');
  });

  it('a new pass also balances the kinds, and ignores seen ids of questions that are gone', () => {
    const qs = [q('a', 'choice'), q('b', 'choice'), q('f1', 'form')];
    const ev: TopicEvidence = { answers: [{ id: 'a', kind: 'choice', ok: true, at: 'x' }], seen: ['a', 'b', 'f1', 'gone'] };
    // every current question was seen: the pass restarts; the window holds one choice answer, so the form question comes
    for (let seed = 0; seed < 10; seed++) expect(pickLevelQuestion('t', ctxOf(qs, ev), seed)).toBe('f1');
  });

  it('a pass over more questions than the window holds: none comes back before all were asked', () => {
    const qs = Array.from({ length: 25 }, (_, i) => q(`q${i}`, i % 2 ? 'choice' : 'form'));
    const ids = qs.map((x) => x.id);
    let ev: TopicEvidence | undefined;
    const got: string[] = [];
    for (let i = 0; i < 25; i++) {
      const id = pickLevelQuestion('t', ctxOf(qs, ev), i)!;
      got.push(id);
      ev = appendEvidence(ev, { id, kind: qs.find((x) => x.id === id)!.kind, ok: true, at: 'x' }, i, ids);
    }
    expect(new Set(got).size).toBe(25);
    const again = pickLevelQuestion('t', ctxOf(qs, ev), 99)!;
    expect(again).not.toBe(got[24]);
    expect(got.slice(15)).not.toContain(again);
  });

  it('a topic with a single question gives it every time (the data makes the repeat unavoidable)', () => {
    const ev = appendEvidence(undefined, { id: 'only', kind: 'choice', ok: true, at: 'x' }, 1, ['only']);
    expect(pickLevelQuestion('t', ctxOf([q('only', 'choice')], ev), 1)).toBe('only');
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

describe('rounds of 20 (FB581)', () => {
  it('the key is per language pair and level', () => {
    expect(levelRoundKey('en→es', 'A1')).not.toBe(levelRoundKey('en→es', 'A2'));
    expect(levelRoundKey('en→es', 'A1')).not.toBe(levelRoundKey('hu→es', 'A1'));
  });

  it('a saved round is read back; a damaged value starts a new round (null)', () => {
    expect(parseLevelRound({ n: 7, right: 5, startPct: 34 })).toEqual({ n: 7, right: 5, startPct: 34 });
    expect(parseLevelRound({ n: LEVEL_ROUND_SIZE, right: 0, startPct: 0 })).not.toBeNull();
    for (const bad of [
      null,
      undefined,
      'x',
      42,
      {},
      { n: 21, right: 3, startPct: 10 },
      { n: -1, right: 0, startPct: 10 },
      { n: 3, right: 4, startPct: 10 },
      { n: 3.5, right: 1, startPct: 10 },
      { n: 3, right: 1, startPct: 'x' },
      { n: 3, right: 1, startPct: NaN },
    ]) {
      expect(parseLevelRound(bad)).toBeNull();
    }
  });

  it('the weakest topic is the lowest percent (no percent = 0), ties in syllabus order', () => {
    const ev = new Map([
      ['a', evOf(['c', 'c', 'c', 'c'])],
      ['b', evOf(['c', 'c', 'x', 'x'])],
    ]);
    expect(weakestTopic(['a', 'b', 'c'], ev)).toEqual({ id: 'c', pct: 0 });
    expect(weakestTopic(['a', 'b'], ev)).toEqual({ id: 'b', pct: 50 });
    expect(weakestTopic(['d', 'c'], ev)).toEqual({ id: 'd', pct: 0 });
    expect(weakestTopic([], ev)).toBeNull();
  });

  it('weakestTopics: lowest percent first, ties in order, at most 3; ticked, unasked and no-percent topics left out', () => {
    const ev = new Map([
      ['a', evOf(['c', 'c', 'x', 'x', 'x'])], // 40
      ['b', evOf(['c', 'c', 'x', 'x', 'c'])], // 60
      ['c', ticked()], // 100, ticked
      ['d', evOf(['c', 'c', 'x', 'x', 'x'])], // 40, ties with a
      ['e', evOf(['x', 'x', 'x', 'x', 'x'])], // 0
      ['f', evOf(['x'])], // 1 answer: no percent yet, not listed
      ['h', evOf(['c', 'c'])], // 2 right answers: no percent yet, not listed
      ['i', evOf(['c', 'x', 'x'])], // 3 answers, 1 right: 33
    ]);
    expect(weakestTopics(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'], ev)).toEqual([
      { id: 'e', pct: 0 },
      { id: 'i', pct: 33 },
      { id: 'a', pct: 40 },
    ]);
    expect(weakestTopics(['f', 'h'], ev)).toEqual([]);
    expect(weakestTopics(['d', 'a', 'b'], ev, 2)).toEqual([{ id: 'd', pct: 40 }, { id: 'a', pct: 40 }]);
    expect(weakestTopics(['c', 'g'], ev)).toEqual([]);
    expect(weakestTopics(['a', 'b'], new Map())).toEqual([]);
    expect(hasTopicPercent(['g', 'f', 'h'], ev)).toBe(false);
    expect(hasTopicPercent(['g', 'f', 'c'], ev)).toBe(true);
  });
});

describe('levelPercent moves with every answer', () => {
  it('1 right of 1 counts 33, 2 right of 2 counts 67, 1 right of 2 counts 33, a wrong one 0; from 3 answers it is the topic percent', () => {
    const level = (spec: string[]) => levelPercent(['a'], new Map([['a', evOf(spec)]]));
    expect(level(['c'])).toBe(33);
    expect(level(['c', 'c'])).toBe(67);
    expect(level(['c', 'x'])).toBe(33);
    expect(level(['x'])).toBe(0);
    expect(level(['c', 'c', 'x'])).toBe(67);
    expect(level(['c', 'c', 'c'])).toBe(100);
    // the topic's own percent and the tick are not changed
    expect(topicPercent(evOf(['c', 'c']))).toBeNull();
  });
});

// FB593/FB594/FB616: the level's standing, the number on the test's bar, the test button and the syllabus header.
describe('the level standing (shown percent)', () => {
  it('a right answer adds 0.5 on top of the larger of the standing and the real percent; a wrong one changes nothing', () => {
    expect(nextShownPct(40, 38, true)).toBeCloseTo(40.5, 5);
    expect(nextShownPct(30, 38, true)).toBeCloseTo(38.5, 5); // the real percent overtook the stored standing
    expect(nextShownPct(40.5, 38, false)).toBe(40.5);
    expect(nextShownPct(0, 0, false)).toBe(0);
  });

  it('never goes down: a run of wrong answers and a falling real percent leave what is drawn where it was', () => {
    let shown = nextShownPct(0, 50, true);
    const peak = shownPctOf(shown, 50);
    for (let i = 0; i < 5; i++) shown = nextShownPct(shown, 20, false);
    expect(shownPctOf(shown, 20)).toBe(peak);
    // and a right answer afterwards still grows it, from the standing, not from the lower real percent
    expect(nextShownPct(shown, 20, true)).toBeGreaterThan(peak);
  });

  it('stops at 99 until the real percent is 100', () => {
    expect(nextShownPct(98.9, 60, true)).toBe(99);
    expect(nextShownPct(99, 60, true)).toBe(99);
    expect(nextShownPct(99, 99, true)).toBe(99);
    expect(nextShownPct(99, 100, true)).toBe(100);
    expect(nextShownPct(100, 100, true)).toBe(100);
  });

  it('a stored 100 stays 100 when the real percent fell below it: right or wrong answers never push it down', () => {
    expect(nextShownPct(100, 90, true)).toBe(100);
    expect(nextShownPct(100, 90, false)).toBe(100);
    expect(nextShownPct(99.5, 60, true)).toBe(99.5);
  });

  it('every right answer moves it (a small step each time), on the way from 0', () => {
    let shown = 0;
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      shown = nextShownPct(shown, 0, true);
      seen.push(shown);
    }
    expect(seen.every((v, i) => v > (seen[i - 1] ?? 0))).toBe(true);
    expect(shownLabel(seen[3])).toBe(2); // 2.0
  });

  it('draws the larger of the standing and the real percent; the label never rounds up to the next point', () => {
    expect(shownPctOf(null, 12)).toBe(12);
    expect(shownPctOf(41.3, 12)).toBe(41.3);
    expect(shownLabel(41.9)).toBe(41);
    expect(shownLabel(99)).toBe(99);
    expect(shownLabel(100)).toBe(100);
  });

  it('parses a saved standing and refuses damaged values; the key is per pair and level', () => {
    expect(parseShownPct(41.3)).toBe(41.3);
    for (const bad of [null, undefined, 'x', NaN, -1, 101, {}]) expect(parseShownPct(bad)).toBeNull();
    expect(levelShownKey('en→es', 'A1')).not.toBe(levelShownKey('en→es', 'A2'));
    expect(levelShownKey('en→es', 'A1')).not.toBe(levelShownKey('hu→es', 'A1'));
  });
});

// FB596: the round end's per-topic rows.
describe('the round end topic rows', () => {
  it('records asked, right and the topic share before its FIRST answer of the round', () => {
    let topics = recordRoundAnswer(undefined, 'a', true, 40);
    topics = recordRoundAnswer(topics, 'a', false, 67);
    topics = recordRoundAnswer(topics, 'b', true, 0);
    expect(topics).toEqual({ a: { n: 2, right: 1, start: 40 }, b: { n: 1, right: 1, start: 0 } });
  });

  it('one row per topic with right/asked and the change in points; weakest first; it can fall while others rise', () => {
    const topics = { a: { n: 4, right: 2, start: 75 }, b: { n: 3, right: 3, start: 33 }, c: { n: 2, right: 2, start: 100 } };
    const rows = roundTopicRows(topics, evidenceOf({ a: evOf(['c', 'c', 'x', 'x']), b: evOf(['c', 'c', 'c']), c: ticked() }));
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c']); // 50, 100 (b: 3 right of 3), 100 (c)
    expect(rows[0]).toEqual({ id: 'a', n: 4, right: 2, delta: -25 });
    expect(rows[1].delta).toBe(67);
    expect(rows[2].delta).toBe(0);
  });

  it('a topic with fewer than 3 answers has no point change (its share is right/3, not a percent): delta is null, right/asked stays', () => {
    const rows = roundTopicRows({ a: { n: 1, right: 1, start: 0 }, b: { n: 2, right: 2, start: 0 } }, evidenceOf({ a: evOf(['c']), b: evOf(['c', 'c']) }));
    expect(rows.map((r) => [r.id, r.n, r.right, r.delta])).toEqual([['a', 1, 1, null], ['b', 2, 2, null]]);
  });

  it('is empty for a round without a record (saved before) and parses with or without it', () => {
    expect(roundTopicRows(undefined, new Map())).toEqual([]);
    expect(parseLevelRound({ n: 3, right: 1, startPct: 10 })).toEqual({ n: 3, right: 1, startPct: 10 });
    const withTopics = parseLevelRound({ n: 3, right: 1, startPct: 10, topics: { a: { n: 2, right: 1, start: 5 }, bad: { n: 'x' } } });
    expect(withTopics?.topics).toEqual({ a: { n: 2, right: 1, start: 5 } });
  });
});
