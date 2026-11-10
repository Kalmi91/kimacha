// The pure engine of the exam round (lib/grammar/examRound.ts): gap weights, the pick of the round's texts, the scoring of a
// text and the saved run. No React, no DB. The files are not read: the texts are in-test fixtures.

import {
  examRoundAvailable,
  examRoundFile,
  examRunKey,
  gapWeight,
  nextSeen,
  parseExamRun,
  pickRoundTexts,
  scoreText,
  textScore,
  type ExamRoundText,
} from '@/lib/grammar/examRound';
import type { EvidenceAnswer, TopicEvidence } from '@/lib/grammar/randomRound';

const answers = (ok: number, total: number): TopicEvidence => ({
  answers: Array.from({ length: total }, (_, i): EvidenceAnswer => ({ id: `q${i}`, kind: 'choice', ok: i < ok, at: '2026-11-01' })),
});

// t1 0%, t2 20%, t3 40% (the three weakest), t4 60% (a percent under 80, not among the weakest), t5 100%, t6 no answers
const IDS = ['t1', 't2', 't3', 't4', 't5', 't6'];
const EVIDENCE = new Map<string, TopicEvidence>([
  ['t1', answers(0, 5)],
  ['t2', answers(1, 5)],
  ['t3', answers(2, 5)],
  ['t4', answers(3, 5)],
  ['t5', answers(5, 5)],
]);
const WEAK = ['t1', 't2', 't3'];

const text = (id: string, topics: string[]): ExamRoundText => ({
  id,
  title: id,
  text: topics.map((_, i) => `w{{${i + 1}}}`).join(' '),
  gaps: topics.map((topic, i) => ({ options: ['a', 'b', 'c'], correct: i % 3, topic })),
});

describe('gapWeight', () => {
  it('3 for a weakest topic, 2 for a percent under the tick, 1 without a percent, 0 at the tick or above', () => {
    expect(gapWeight('t1', EVIDENCE, WEAK)).toBe(3);
    expect(gapWeight('t3', EVIDENCE, WEAK)).toBe(3);
    expect(gapWeight('t4', EVIDENCE, WEAK)).toBe(2);
    expect(gapWeight('t6', EVIDENCE, WEAK)).toBe(1);
    expect(gapWeight('unknown', EVIDENCE, WEAK)).toBe(1);
    expect(gapWeight('t5', EVIDENCE, WEAK)).toBe(0);
  });

  it('1 or 2 answers are no percent yet: weight 1', () => {
    const few = new Map(EVIDENCE).set('t6', answers(0, 2));
    expect(gapWeight('t6', few, WEAK)).toBe(1);
  });

  it('a text scores the sum of its gaps', () => {
    expect(textScore(text('x', ['t1', 't1', 't4', 't5', 't6', 't6']), EVIDENCE, WEAK)).toBe(3 + 3 + 2 + 0 + 1 + 1);
  });
});

describe('pickRoundTexts', () => {
  const heavy = text('heavy', ['t1', 't2', 't3', 't1', 't2', 't3']); // 18
  const mid = text('mid', ['t4', 't4', 't6', 't6', 't5', 't5']); // 6
  const light = text('light', ['t5', 't5', 't5', 't5', 't5', 't5']); // 0
  const all = [light, mid, heavy];

  it('the weakest-heavy text comes first, then the next best', () => {
    expect(pickRoundTexts(all, IDS, EVIDENCE, [], 1).map((x) => x.id)).toEqual(['heavy', 'mid']);
  });

  it('texts not seen yet come before seen ones, however high the seen ones score', () => {
    expect(pickRoundTexts(all, IDS, EVIDENCE, ['heavy'], 1).map((x) => x.id)).toEqual(['mid', 'light']);
    expect(pickRoundTexts(all, IDS, EVIDENCE, ['heavy', 'mid'], 1).map((x) => x.id)).toEqual(['light', 'heavy']);
  });

  it('when every text was seen the best ones come again, two different texts', () => {
    const picked = pickRoundTexts(all, IDS, EVIDENCE, ['heavy', 'mid', 'light'], 1);
    expect(picked.map((x) => x.id)).toEqual(['heavy', 'mid']);
    expect(new Set(picked.map((x) => x.id)).size).toBe(2);
  });

  it('n texts, fewer if the file has fewer; the input is not changed', () => {
    const copy = [...all];
    expect(pickRoundTexts(all, IDS, EVIDENCE, [], 1, 3)).toHaveLength(3);
    expect(pickRoundTexts([heavy], IDS, EVIDENCE, [], 1)).toHaveLength(1);
    expect(all).toEqual(copy);
  });

  it('ties go in a seeded order: the same seed gives the same texts, the seeds give both orders', () => {
    const a = text('a', ['t6', 't6', 't6', 't6', 't6', 't6']);
    const b = text('b', ['t6', 't6', 't6', 't6', 't6', 't6']);
    const first = (seed: number) => pickRoundTexts([a, b], IDS, EVIDENCE, [], seed, 1)[0].id;
    expect(first(7)).toBe(first(7));
    const seen = new Set(Array.from({ length: 20 }, (_, s) => first(s)));
    expect(seen).toEqual(new Set(['a', 'b']));
  });
});

describe('nextSeen', () => {
  it('adds the finished texts', () => {
    expect(nextSeen(['a'], ['b', 'c'], ['a', 'b', 'c', 'd'])).toEqual(['a', 'b', 'c']);
  });
  it('when that covers every text, only the two just done stay', () => {
    expect(nextSeen(['a', 'b'], ['c', 'd'], ['a', 'b', 'c', 'd'])).toEqual(['c', 'd']);
  });
  it('a text done twice is listed once', () => {
    expect(nextSeen(['a', 'b'], ['b', 'c'], ['a', 'b', 'c', 'd'])).toEqual(['a', 'b', 'c']);
  });
});

describe('scoreText', () => {
  const tx = text('x', ['t1', 't2', 't1', 't3', 't4', 't5']); // correct: 0 1 2 0 1 2
  it('one row per gap: the picked and the right option, ok, topic', () => {
    const rows = scoreText(tx, { 0: 0, 1: 0, 2: 2, 3: 1, 4: 1, 5: 2 });
    expect(rows).toHaveLength(6);
    expect(rows[0]).toEqual({ n: 1, picked: 0, right: 0, ok: true, topic: 't1' });
    expect(rows[1]).toEqual({ n: 2, picked: 0, right: 1, ok: false, topic: 't2' });
    expect(rows.map((r) => r.ok)).toEqual([true, false, true, false, true, true]);
  });
  it('an open gap is wrong, with picked null', () => {
    const rows = scoreText(tx, { 0: 0 });
    expect(rows[1]).toMatchObject({ picked: null, ok: false });
  });
});

describe('parseExamRun', () => {
  const run = { texts: ['a', 'b'], index: 1, answers: { 0: 2, 3: 1 }, checked: true, seed: 12345, seen: ['c'] };
  it('a saved run comes back as it was', () => {
    expect(parseExamRun(JSON.parse(JSON.stringify(run)))).toEqual({ ...run, answers: { '0': 2, '3': 1 } });
  });
  it('a cleared run (no texts) keeps its seen list', () => {
    expect(parseExamRun({ texts: [], index: 0, answers: {}, checked: false, seed: 1, seen: ['a', 'b'] })).toMatchObject({ texts: [], seen: ['a', 'b'] });
  });
  it('missing or damaged values give null', () => {
    expect(parseExamRun(null)).toBeNull();
    expect(parseExamRun(undefined)).toBeNull();
    expect(parseExamRun('x')).toBeNull();
    expect(parseExamRun({ ...run, texts: ['a', 'b', 'c'] })).toBeNull();
    expect(parseExamRun({ ...run, texts: [1, 2] })).toBeNull();
    expect(parseExamRun({ ...run, index: 2 })).toBeNull();
    expect(parseExamRun({ ...run, index: 0.5 })).toBeNull();
    expect(parseExamRun({ ...run, checked: 'yes' })).toBeNull();
    expect(parseExamRun({ ...run, seed: NaN })).toBeNull();
    expect(parseExamRun({ ...run, seen: 'c' })).toBeNull();
    expect(parseExamRun({ ...run, answers: { 0: 'x' } })).toBeNull();
    expect(parseExamRun({ ...run, answers: { a: 1 } })).toBeNull();
    expect(parseExamRun({ ...run, answers: [1] })).toBeNull();
    const { seen: _seen, ...noSeen } = run;
    expect(parseExamRun(noSeen)).toBeNull();
  });
});

describe('the files', () => {
  it('a language and level without a file has none and is not available', () => {
    expect(examRoundFile('de', 'C1')).toBeUndefined();
    expect(examRoundAvailable('de', 'C1')).toBe(false);
  });
  it('the shipped Spanish A1 file is the A1 file; available only with at least 2 texts', () => {
    const file = examRoundFile('es', 'A1');
    expect(file).toMatchObject({ lang: 'es', level: 'A1' });
    expect(examRoundAvailable('es', 'A1')).toBe((file?.texts.length ?? 0) >= 2);
  });
  it('the resume key names the pair and the level', () => {
    expect(examRunKey('en→es', 'A1')).toBe('grammar-exam-round:en→es:A1');
  });
});
