// Scoring of the authored B1-C1 task kinds (marks, open answers, essay) and the scale rule of the English B1 / B2 / C1
// exams: the hit ratio of a skill -> the raw score of the real paper -> the scale score along the anchors -> the average.

import { getMockBlueprint } from '../blueprint';
import { scaleScore, scoreMockExam, scoreMockTask } from '../score';
import { MOCK_EXAM_PROGRESS_KEY, readMockOverview, saveMockLast } from '../session';
import { mockTaskItemCount, mockTaskMarks, type MockAnswers, type MockExam, type MockSkill, type MockTask, type MockTaskAnswer } from '../types';

const q = (correct = 0) => ({ stem: 'Which one?', options: ['a', 'b', 'c'], correct });
const base = (id: string, skill: MockSkill) => ({ id, skill, instruction: 'Do it.' });

function mcTask(id: string, skill: MockSkill, n: number, marks?: number): MockTask {
  return { ...base(id, skill), kind: 'passage_mc', text: 'A text.', questions: Array.from({ length: n }, () => q()), ...(marks ? { marks } : {}) };
}
/** The first k questions answered right (option 0). */
const hits = (k: number): MockTaskAnswer => Object.fromEntries(Array.from({ length: k }, (_, i) => [String(i), 0]));
const run = (task: MockTask, answer: MockTaskAnswer = {}) => scoreMockTask(task, answer);
const flags = (task: MockTask, answer: MockTaskAnswer = {}) => run(task, answer).items.map((i) => i.ok);

describe('item and mark counts of the authored kinds', () => {
  const tasks: [MockTask, number][] = [
    [mcTask('a', 'reading', 6), 6],
    [{ ...base('b', 'reading'), kind: 'clips_mc', clips: [{ text: 'x', questions: [q(), q()] }, { text: 'y', questions: [q()] }] }, 3],
    [{ ...base('c', 'reading'), kind: 'match_pool', prompts: [{ id: 'p1', text: 'x' }, { id: 'p2', text: 'y' }], options: [{ id: 'a', text: 'A' }], answer: { p1: 'a', p2: 'a' }, unique: false }, 2],
    [{ ...base('d', 'reading'), kind: 'gapped_text', text: '{{1}} {{2}} {{3}}', fragments: [], answer: { '1': 'a', '2': 'b', '3': 'c' } }, 3],
    [{ ...base('e', 'use'), kind: 'cloze', text: '{{1}} {{2}}', gaps: [{ options: ['a', 'b'], correct: 0 }, { answers: ['x'] }] }, 2],
    [{ ...base('f', 'listening'), kind: 'pick_statements', statements: ['a', 'b', 'c', 'd'], correct: [0, 3], pick: 2 }, 2],
    [{ ...base('g', 'use'), kind: 'transform', items: [{ first: 'f', key: 'K', before: 'b', after: 'a', answers: ['x'] }] }, 1],
    [{ ...base('h', 'writing'), kind: 'essay', choices: [{ id: 'a', title: 't', prompt: 'p', minWords: 1, maxWords: 2, points: [{ id: 'x', label: 'l', keywords: ['k'] }, { id: 'y', label: 'l', keywords: ['k'] }] }] }, 3],
  ];

  it('one item per question / prompt / gap / right statement / item; an essay: content points + the word count', () => {
    for (const [task, count] of tasks) expect(mockTaskItemCount(task)).toBe(count);
  });

  it('the marks are the items x the marks per item (default 1)', () => {
    for (const [task, count] of tasks) expect(mockTaskMarks(task)).toBe(count);
    expect(mockTaskMarks(mcTask('a', 'reading', 6, 2))).toBe(12);
  });
});

describe('multiple-choice kinds', () => {
  it('passage_mc: a hit per question, an unanswered or wrong one is not', () => {
    const t = mcTask('p', 'reading', 4);
    expect(flags(t, { '0': 0, '1': 1, '2': 0 })).toEqual([true, false, true, false]);
    expect(run(t, hits(3))).toMatchObject({ correct: 3, total: 4 });
  });

  it('clips_mc: the question index counts across the clips', () => {
    const t: MockTask = { ...base('c', 'listening'), kind: 'clips_mc', clips: [{ audio: [{ text: 'x' }], questions: [q(1), q(0)] }, { audio: [{ text: 'y' }], questions: [q(2)] }] };
    expect(flags(t, { '0': 1, '1': 0, '2': 2 })).toEqual([true, true, true]);
    expect(flags(t, { '0': 0, '2': 2 })).toEqual([false, false, true]);
  });

  it('marks weigh the items: a 2-mark task counts double in the task and in the skill', () => {
    const t = mcTask('p', 'reading', 3, 2);
    expect(run(t, hits(2))).toMatchObject({ correct: 4, total: 6 });
    const exam = examOf('B1', [mcTask('a', 'reading', 4), t]);
    const answers: MockAnswers = { a: hits(4), p: {} };
    expect(scoreMockExam(exam, answers).skills[0]).toMatchObject({ skill: 'reading', correct: 4, total: 10 });
  });
});

describe('matching kinds', () => {
  it('match_pool: the chosen option id per prompt id', () => {
    const t: MockTask = {
      ...base('m', 'reading'),
      kind: 'match_pool',
      prompts: [{ id: 'p1', text: 'one' }, { id: 'p2', audio: [{ text: 'two' }, { text: 'heard' }] }],
      options: [{ id: 'a', text: 'Option A' }, { id: 'b', text: 'Option B' }],
      answer: { p1: 'a', p2: 'b' },
      unique: true,
    };
    expect(flags(t, { p1: 'a', p2: 'a' })).toEqual([true, false]);
    const r = run(t, { p1: 'b' });
    expect(r.items[0]).toMatchObject({ label: 'one', given: 'Option B', expected: 'Option A', ok: false });
    expect(r.items[1].label).toBe('two heard');
  });

  it('gapped_text: the fragment id per gap number, in gap order', () => {
    const t: MockTask = {
      ...base('g', 'reading'),
      kind: 'gapped_text',
      text: 'a {{1}} b {{2}} c {{10}}',
      fragments: [{ id: 'A', text: 'first' }, { id: 'B', text: 'second' }, { id: 'C', text: 'third' }, { id: 'D', text: 'extra' }],
      answer: { '10': 'C', '2': 'B', '1': 'A' },
    };
    expect(run(t, { '1': 'A', '2': 'B', '10': 'C' })).toMatchObject({ correct: 3, total: 3 });
    expect(run(t).items.map((i) => i.label)).toEqual(['1', '2', '10']);
    expect(flags(t, { '1': 'B', '2': 'B', '10': 'D' })).toEqual([false, true, false]);
  });
});

describe('cloze and transform', () => {
  const cloze: MockTask = {
    ...base('c', 'use'),
    kind: 'cloze',
    text: '{{1}} {{2}} {{3}}',
    gaps: [{ options: ['x', 'y', 'z'], correct: 2 }, { answers: ["don't", 'do not'] }, { answers: ['beautiful'], stem: 'BEAUTY' }],
  };

  it('a multiple-choice gap by option index, an open gap by the typed text', () => {
    expect(flags(cloze, { '0': 2, '1': "don't", '2': 'beautiful' })).toEqual([true, true, true]);
    expect(flags(cloze, { '0': 1, '1': 'did', '2': 'beauty' })).toEqual([false, false, false]);
  });

  it('open answers: case, spaces and punctuation do not matter; any accepted answer counts; an empty one never', () => {
    expect(flags(cloze, { '1': 'DON T' })).toEqual([false, true, false]);
    expect(flags(cloze, { '1': '  Dont ' })[1]).toBe(true);
    expect(flags(cloze, { '1': 'DO  NOT.' })[1]).toBe(true);
    expect(flags(cloze, { '2': 'Beautiful!' })[2]).toBe(true);
    expect(flags(cloze, { '1': '', '2': '   ' })).toEqual([false, false, false]);
    expect(run(cloze, { '1': "don't" }).items[1]).toMatchObject({ given: "don't", expected: "don't" });
  });

  it('transform: the whole accepted filling, marks per item', () => {
    const t: MockTask = {
      ...base('t', 'use'),
      kind: 'transform',
      marks: 2,
      items: [
        { first: 'I have not seen her for a year.', key: 'LAST', before: 'The last time I', after: 'a year ago.', answers: ['saw her', 'saw her was'] },
        { first: 'She runs fast.', key: 'QUICK', before: 'She is a', after: '.', answers: ['quick runner'] },
      ],
    };
    expect(flags(t, { '0': 'Saw  her', '1': 'quick runner' })).toEqual([true, true]);
    expect(flags(t, { '0': 'saw', '1': 'a quick runner' })).toEqual([false, false]);
    expect(run(t, { '0': 'saw her' })).toMatchObject({ correct: 2, total: 4 });
  });
});

describe('pick_statements', () => {
  const t: MockTask = { ...base('s', 'listening'), kind: 'pick_statements', audio: [{ text: 'x' }], statements: ['s0', 's1', 's2', 's3', 's4'], correct: [0, 2], pick: 2 };

  it('one mark for each right statement that was picked', () => {
    expect(flags(t, { '0': true, '2': true })).toEqual([true, true]);
    expect(flags(t, { '0': true, '1': true })).toEqual([true, false]);
    expect(run(t, { '1': true, '3': true })).toMatchObject({ correct: 0, total: 2 });
    expect(run(t, { '0': false })).toMatchObject({ correct: 0, total: 2 });
  });

  it('the score never goes above pick (the right statements are the items)', () => {
    expect(run(t, { '0': true, '1': true, '2': true, '3': true, '4': true })).toMatchObject({ correct: 2, total: 2 });
  });
});

/** n distinct pronounceable words (consonant + vowel syllable pairs), none of which is a nonsense token. */
function distinctWords(n: number, from = 0): string[] {
  const syl = [...'bdfgklmnprstvz'].flatMap((c) => [...'aeiou'].map((v) => c + v));
  return Array.from({ length: n }, (_, i) => {
    const k = from + i;
    return syl[k % syl.length] + syl[Math.floor(k / syl.length) % syl.length] + syl[(k * 7 + 3) % syl.length];
  });
}

describe('essay', () => {
  const essay: MockTask = {
    ...base('e', 'writing'),
    kind: 'essay',
    choices: [
      {
        id: 'a',
        title: 'A',
        prompt: 'Describe the best holiday of your life and explain why it was so good for you.',
        input: 'Your teacher asked for a short report about a memorable journey abroad.',
        minWords: 10,
        maxWords: 20,
        points: [{ id: 'p1', label: 'first', keywords: ['bamo'] }, { id: 'p2', label: 'second', keywords: ['nothere', 'zuli'] }],
      },
      { id: 'b', title: 'B', prompt: 'Write about your favourite meal and where you usually eat it.', minWords: 5, maxWords: 8, points: [{ id: 'q1', label: 'meal', keywords: ['kemo'] }] },
    ],
  };
  const text = (n: number, ...keywords: string[]) => [...keywords, ...distinctWords(n - keywords.length, 100)].join(' ');

  it('the content points by keyword + one for the word count, for the chosen task', () => {
    const r = run(essay, { choice: 'a', text: text(12, 'bamo', 'zuli') });
    expect(r.items.map((i) => i.ok)).toEqual([true, true, true]);
    expect(r).toMatchObject({ correct: 3, total: 3 });
    expect(flags(essay, { choice: 'a', text: text(12, 'bamo') })).toEqual([true, false, true]);
    expect(flags(essay, { choice: 'b', text: text(6, 'kemo') })).toEqual([true, true]);
  });

  it('no choice yet: the first task is scored and nothing is earned', () => {
    expect(run(essay)).toMatchObject({ correct: 0, total: 3 });
    expect(run(essay, { text: text(12, 'bamo', 'zuli') }).items).toHaveLength(3);
  });

  it('the word count counts from the minimum up to the maximum x 1.2', () => {
    const at = (n: number) => flags(essay, { choice: 'a', text: text(n, 'bamo', 'zuli') })[2];
    expect(at(9)).toBe(false);
    expect(at(10)).toBe(true);
    expect(at(20)).toBe(true);
    expect(at(24)).toBe(true);
    expect(at(25)).toBe(false);
  });

  it('a content point needs at least half of the minimum words', () => {
    expect(flags(essay, { choice: 'a', text: text(4, 'bamo', 'zuli') })).toEqual([false, false, false]);
    expect(flags(essay, { choice: 'a', text: text(5, 'bamo', 'zuli') })).toEqual([true, true, false]);
  });

  it('meaningless text earns nothing: nonsense, a repeated word, the pasted task text', () => {
    expect(run(essay, { choice: 'a', text: 'qwer asdf zxcv qwer asdf zxcv qwer asdf zxcv qwer asdf zxcv bamo zuli' }).correct).toBe(0);
    expect(run(essay, { choice: 'a', text: Array(14).fill('bamo').join(' ') }).correct).toBe(0);
    const pasted = 'Describe the best holiday of your life and explain why it was so good for you';
    expect(run(essay, { choice: 'a', text: `${pasted} bamo zuli` }).correct).toBeLessThan(3);
    const fromInput = 'Your teacher asked for a short report about a memorable journey abroad';
    expect(flags(essay, { choice: 'a', text: `${fromInput} bamo zuli` })[2]).toBe(false);
  });

  it('with a dictionary the text must be mostly known words', () => {
    const lexicon = new Set(['hello']);
    expect(scoreMockTask(essay, { choice: 'a', text: text(12, 'bamo', 'zuli') }, { lexicon }).correct).toBe(0);
  });
});

// ---------------------------------------------------------------- scale rule

function examOf(level: 'B1' | 'B2' | 'C1', tasks: MockTask[]): MockExam {
  const bp = getMockBlueprint('en', level);
  return {
    target: 'en',
    level,
    seed: 1,
    official: false,
    skillNames: bp.skillNames,
    rule: bp.rule,
    papers: [
      { id: 'all', name: 'All', minutes: 60, points: 100, placeholder: false, tasks },
      { id: 'speaking', name: 'Speaking', minutes: 10, points: 25, placeholder: true, tasks: [] },
    ],
  };
}

/** An exam with one task per scored skill of the level's rule, with as many questions as the real paper has marks. */
function scaleExam(level: 'B1' | 'B2' | 'C1'): MockExam {
  const rule = getMockBlueprint('en', level).rule;
  if (rule.kind !== 'scale') throw new Error('not a scale rule');
  return examOf(level, (Object.entries(rule.skills) as [MockSkill, { officialMax: number }][]).map(([skill, c]) => mcTask(skill, skill, c.officialMax)));
}
const answersFor = (raw: Partial<Record<MockSkill, number>>): MockAnswers => Object.fromEntries(Object.entries(raw).map(([skill, k]) => [skill, hits(k!)]));
const scaleOf = (exam: MockExam, raw: Partial<Record<MockSkill, number>>) => scoreMockExam(exam, answersFor(raw));
const skillScale = (r: ReturnType<typeof scoreMockExam>, skill: MockSkill) => r.skills.find((s) => s.skill === skill)?.scale;

describe('scaleScore: linear between the anchors, the end segments continue outside', () => {
  const anchors: [number, number][] = [[10, 100], [20, 120], [40, 140]];

  it('exactly the scale score on an anchor, a straight line in between', () => {
    expect(scaleScore(anchors, 50, 10)).toBe(100);
    expect(scaleScore(anchors, 50, 20)).toBe(120);
    expect(scaleScore(anchors, 50, 40)).toBe(140);
    expect(scaleScore(anchors, 50, 15)).toBe(110);
    expect(scaleScore(anchors, 50, 30)).toBe(130);
  });

  it('outside the anchors the first / last segment continues, cut at 0 and the paper maximum', () => {
    expect(scaleScore(anchors, 50, 5)).toBe(90);
    expect(scaleScore(anchors, 50, 0)).toBe(80);
    expect(scaleScore(anchors, 50, -3)).toBe(80);
    expect(scaleScore(anchors, 50, 50)).toBe(150);
    expect(scaleScore(anchors, 50, 99)).toBe(150);
  });
});

describe('scale rule (English B1 / B2 / C1)', () => {
  it('on every anchor of every level the skill gets exactly the anchor scale score', () => {
    for (const level of ['B1', 'B2', 'C1'] as const) {
      const exam = scaleExam(level);
      const rule = getMockBlueprint('en', level).rule;
      if (rule.kind !== 'scale') throw new Error('not a scale rule');
      for (const [skill, conv] of Object.entries(rule.skills) as [MockSkill, NonNullable<(typeof rule.skills)[MockSkill]>][]) {
        for (const [raw, scale] of conv.anchors) {
          expect(skillScale(scaleOf(exam, { [skill]: raw }), skill)).toBe(scale);
        }
      }
    }
  });

  it('B1 reading 23 of 32 is 140, between the anchors it is interpolated', () => {
    const exam = scaleExam('B1');
    expect(skillScale(scaleOf(exam, { reading: 23 }), 'reading')).toBe(140);
    expect(skillScale(scaleOf(exam, { reading: 18 }), 'reading')).toBe(130);
    expect(skillScale(scaleOf(exam, { reading: 26 }), 'reading')).toBe(150);
  });

  it('the hit ratio is scaled to the real paper maximum, however many questions the task set has', () => {
    // 8 questions stand for the 32-mark reading: 6 right = 75% = raw 24 -> 143 (on the 23 -> 140, 29 -> 160 segment).
    const short = examOf('B1', [mcTask('reading', 'reading', 8), mcTask('writing', 'writing', 4), mcTask('listening', 'listening', 5)]);
    expect(skillScale(scoreMockExam(short, answersFor({ reading: 6 })), 'reading')).toBe(143);
  });

  it('beyond the ends of the paper the score stays on the extended line, never negative', () => {
    const exam = scaleExam('B1');
    expect(skillScale(scaleOf(exam, { reading: 32 }), 'reading')).toBe(170);
    expect(skillScale(scaleOf(exam, {}), 'reading')).toBe(91);
  });

  it('the pass is the rounded average of the counted skills against the needed score, no per-skill minimum', () => {
    const exam = scaleExam('B1');
    // the three skills exactly on 140
    const at140 = scaleOf(exam, { reading: 23, writing: 24, listening: 18 });
    expect(at140.rule).toMatchObject({ kind: 'scale', points: 140, needed: 140, approximate: true, passed: true });
    expect(at140.passed).toBe(true);
    expect(at140.scaleTotal).toBe(140);
    // reading 22 -> 138: the average 139.33 rounds to 139, not passed
    const below = scaleOf(exam, { reading: 22, writing: 24, listening: 18 });
    expect(below.rule).toMatchObject({ points: 139, passed: false });
    expect(below.passed).toBe(false);
    // one weak skill is made up by a strong one
    const compensated = scaleOf(exam, { reading: 32, writing: 10, listening: 25 });
    expect(skillScale(compensated, 'writing')).toBe(102);
    expect(compensated.rule).toMatchObject({ points: 147, passed: true });
  });

  it('every counted skill has a scale score, the missing speaking is left out and the result is provisional', () => {
    const r = scaleOf(scaleExam('B2'), { reading: 24, use: 18, writing: 24, listening: 18 });
    expect(r.skills.map((s) => [s.skill, s.included, s.scale])).toEqual([
      ['reading', true, 160],
      ['use', true, 160],
      ['writing', true, 160],
      ['listening', true, 160],
      ['speaking', false, undefined],
    ]);
    expect(r.provisional).toBe(true);
    expect(r.rule).toMatchObject({ points: 160, needed: 160, passed: true, provisional: true });
  });

  it('Use of English is a skill only in an exam that has such a task', () => {
    expect(scaleOf(scaleExam('B1'), {}).skills.map((s) => s.skill)).toEqual(['reading', 'writing', 'listening', 'speaking']);
    expect(scaleOf(scaleExam('C1'), {}).skills.map((s) => s.skill)).toEqual(['reading', 'use', 'writing', 'listening', 'speaking']);
    expect(scaleOf(scaleExam('C1'), {}).skills[1].name).toBe('Use of English');
  });

  it('a skill with marks per item: the raw ratio is weighted by the marks', () => {
    // use: one 1-mark task (4 questions) + one 2-mark task (4 questions) = 12 marks; the 2-mark task right = 8/12
    const exam = examOf('B2', [mcTask('use1', 'use', 4), mcTask('use2', 'use', 4, 2), mcTask('reading', 'reading', 2), mcTask('writing', 'writing', 2), mcTask('listening', 'listening', 2)]);
    const r = scoreMockExam(exam, { use2: hits(4) });
    expect(r.skills.find((s) => s.skill === 'use')).toMatchObject({ correct: 8, total: 12 });
    // raw = 8/12 x 28 = 18.67 -> between 18 (160) and 24 (180): 160 + 0.67 x 20/6 = 162.2
    expect(skillScale(r, 'use')).toBe(162);
  });

  it('the scale result of the exam is kept as a latest result with the scale points', async () => {
    const rows = new Map<string, { itemId: string; state: string; data: unknown }>();
    const store = {
      async getGameProgress(gameId: string) {
        return [...rows.entries()].filter(([k]) => k.startsWith(`${gameId}|`)).map(([, v]) => v);
      },
      async setGameProgress(gameId: string, itemId: string, state: string, data?: unknown) {
        rows.set(`${gameId}|${itemId}`, { itemId, state, data: JSON.parse(JSON.stringify(data)) });
      },
    };
    const result = scaleOf(scaleExam('B1'), { reading: 23, writing: 24, listening: 18 });
    const last = await saveMockLast(store, 'en', 'B1', result, '2026-10-22');
    expect(last).toMatchObject({ passed: true, provisional: true, groups: [{ points: 140, needed: 140 }] });
    const overview = await readMockOverview(store, 'en', ['B1', 'B2']);
    expect(overview.B1?.last?.passed).toBe(true);
    expect(overview.B2?.last).toBeUndefined();
    expect(MOCK_EXAM_PROGRESS_KEY).toBe('mock-exam');
  });
});
