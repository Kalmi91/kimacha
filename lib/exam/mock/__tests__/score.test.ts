// Practice exam scoring and the pass rules.
// Per skill, the raw hits are scaled to the skill's 25 points; the exam's rule decides the pass:
//  - groups (es): 30 / 50 in both groups (reading + writing; listening + speaking), with a placeholder
//    speaking the 2nd group = listening x2, flagged "provisional";
//  - total (en A1): 50 out of 100, no per-skill minimum (compensating), the missing speaking is computed from the
//    ratio of the other three, "provisional";
//  - average (en A2): the percentage average of the skills against the approximate threshold, no per-skill minimum.
// Writing: the old keyword-based content scoring (for the tightening see writing.test.ts).

import { pcicItemsForLevel, setPcicTarget } from '@/data/pcic';
import { AVERAGE_PASS_PCT, TOTAL_PASS_POINTS } from '../blueprint';
import { buildMockExam } from '../build';
import { countWords, fold, scoreMockExam, scoreMockTask } from '../score';
import { mockTaskItemCount, type MockAnswers, type MockExam, type MockRule, type MockSkill, type MockTask } from '../types';

afterAll(() => setPcicTarget('es'));

const SKILL_NAMES: Record<MockSkill, string> = { reading: 'Reading', writing: 'Writing', listening: 'Listening', speaking: 'Speaking' };
const GROUPS: MockRule = {
  kind: 'groups',
  groups: [
    { skills: ['reading', 'writing'], needed: 30, of: 50 },
    { skills: ['listening', 'speaking'], needed: 30, of: 50 },
  ],
};
const TOTAL: MockRule = { kind: 'total', needed: TOTAL_PASS_POINTS, of: 100 };
const AVERAGE: MockRule = { kind: 'average', passPct: AVERAGE_PASS_PCT, approximate: true };

// One skill = one task with 25 items: hits = points, so the thresholds can be tested exactly.
function task25(skill: MockSkill): MockTask {
  const id = skill.slice(0, 1);
  if (skill === 'writing') return { id, skill, kind: 'form_fill', instruction: '', context: '', fields: Array.from({ length: 25 }, (_, i) => ({ id: `f${i}`, label: `f${i}`, type: 'text' as const })) };
  return { id, skill, kind: 'listen_mc', instruction: '', audio: [], questions: Array.from({ length: 25 }, () => ({ options: ['a', 'b'], correct: 0 })) };
}

/** Four skills; speaking is a placeholder (it has no task) unless requested. */
const synthetic = (rule: MockRule, withSpeaking = false): MockExam => ({
  target: 'en',
  level: 'A1',
  seed: 1,
  official: false,
  skillNames: SKILL_NAMES,
  rule,
  papers: [
    { id: 'written', name: 'Written', minutes: 60, points: 75, placeholder: false, tasks: [task25('reading'), task25('writing'), task25('listening')] },
    { id: 'speaking', name: 'Speaking', minutes: 5, points: 25, placeholder: !withSpeaking, tasks: withSpeaking ? [task25('speaking')] : [] },
  ],
});

function answers(reading: number, writing: number, listening: number, speaking = 0): MockAnswers {
  const out: MockAnswers = { r: {}, w: {}, l: {}, s: {} };
  for (let i = 0; i < reading; i++) out.r[String(i)] = 0;
  for (let i = 0; i < writing; i++) out.w[`f${i}`] = 'húngara';
  for (let i = 0; i < listening; i++) out.l[String(i)] = 0;
  for (let i = 0; i < speaking; i++) out.s[String(i)] = 0;
  return out;
}

const pointsOf = (e: MockExam, a: MockAnswers) => Object.fromEntries(scoreMockExam(e, a).skills.map((s) => [s.skill, s.points]));

describe('score per skill: independent of the papers, the hits scale to 25 points', () => {
  it('the skill score is the hit ratio x 25, however many papers its tasks are in', () => {
    expect(pointsOf(synthetic(TOTAL), answers(10, 20, 5))).toEqual({ reading: 10, writing: 20, listening: 5, speaking: 0 });
  });

  it('on a real task set: the hits of the first reading task scale proportionally', () => {
    setPcicTarget('es');
    const e = buildMockExam({ target: 'es', level: 'A1', items: pcicItemsForLevel('A1'), seed: 3 });
    const reading = e.papers.find((p) => p.id === 'reading')!;
    const total = reading.tasks.reduce((n, t) => n + mockTaskItemCount(t), 0);
    const first = reading.tasks[0];
    if (first.kind !== 'read_mc') throw new Error('nincs read_mc');
    const half: MockAnswers = {};
    first.passages.forEach((p, i) => ((half[first.id] ??= {})[String(i)] = p.correct));
    const result = scoreMockExam(e, half);
    const skill = result.skills.find((s) => s.skill === 'reading')!;
    expect(skill.correct).toBe(first.passages.length);
    expect(skill.total).toBe(total);
    expect(skill.points).toBe(Math.round((first.passages.length / total) * 25));
  });

  it('unanswered (clock ran out) = 0 points, the exam fails (under every rule)', () => {
    for (const rule of [GROUPS, TOTAL, AVERAGE]) {
      const r = scoreMockExam(synthetic(rule), {});
      expect(r.skills.map((s) => s.points)).toEqual([0, 0, 0, 0]);
      expect(r.passed).toBe(false);
    }
  });
});

describe('Spanish rule: 30 / 50 per group, listening x2 next to the spoken placeholder', () => {
  it('15 + 15 is the boundary (passes), 14 + 15 no longer', () => {
    const e = synthetic(GROUPS);
    const ok = scoreMockExam(e, answers(15, 15, 15));
    if (ok.rule.kind !== 'groups') throw new Error('nem csoport');
    expect(ok.rule.groups.map((g) => g.passed)).toEqual([true, true]);
    expect(ok.passed).toBe(true);
    const low = scoreMockExam(e, answers(14, 15, 25));
    if (low.rule.kind !== 'groups') throw new Error('nem csoport');
    expect(low.rule.groups[0]).toMatchObject({ points: 29, needed: 30, of: 50, passed: false });
    expect(low.passed).toBe(false);
  });

  it('the spoken placeholder: group 2 = listening x2, provisional; the spoken part does not count', () => {
    const r = scoreMockExam(synthetic(GROUPS), answers(25, 25, 15));
    expect(r.skills.find((s) => s.skill === 'speaking')).toMatchObject({ included: false, points: 0 });
    if (r.rule.kind !== 'groups') throw new Error('nem csoport');
    expect(r.rule.groups[1]).toMatchObject({ points: 30, of: 50, needed: 30, passed: true, provisional: true });
    expect(r.provisional).toBe(true);
    expect(r.passed).toBe(true);
    const fail = scoreMockExam(synthetic(GROUPS), answers(25, 25, 14));
    if (fail.rule.kind !== 'groups') throw new Error('nem csoport');
    expect(fail.rule.groups[1]).toMatchObject({ points: 28, passed: false });
    expect(fail.passed).toBe(false);
  });

  it('group 1 is not provisional, the total consists only of the counted skills (3 x 25)', () => {
    const r = scoreMockExam(synthetic(GROUPS), answers(25, 25, 25));
    if (r.rule.kind !== 'groups') throw new Error('nem csoport');
    expect(r.rule.groups[0].provisional).toBe(false);
    expect([r.totalPoints, r.totalMax]).toEqual([75, 75]);
  });
});

describe('English A1 rule: total 50 / 100, the skills compensate, the missing spoken part is made up proportionally', () => {
  it('with all four skills: 50 is the pass boundary, 49 no longer; there is no per-part minimum', () => {
    const e = synthetic(TOTAL, true);
    const pass = scoreMockExam(e, answers(25, 25, 0, 0));
    expect(pass.rule).toMatchObject({ kind: 'total', points: 50, needed: 50, of: 100, passed: true, provisional: false });
    expect(pass.provisional).toBe(false);
    expect(pass.passed).toBe(true);
    const fail = scoreMockExam(e, answers(25, 24, 0, 0));
    expect(fail.rule).toMatchObject({ points: 49, passed: false });
    // One skill can score zero if the others make up for it (no per-skill minimum).
    expect(scoreMockExam(e, answers(25, 25, 25, 0)).passed).toBe(true);
  });

  it('the spoken placeholder: the sum of the three skills scaled to the proportional 100 (sum / 75 x 100), provisional', () => {
    const e = synthetic(TOTAL);
    // 38 / 75 = 50.7 -> 51 (passes), 37 / 75 = 49.3 -> 49 (does not).
    const ok = scoreMockExam(e, answers(13, 13, 12));
    expect(ok.rule).toMatchObject({ kind: 'total', points: 51, passed: true, provisional: true });
    expect(ok.provisional).toBe(true);
    const no = scoreMockExam(e, answers(13, 12, 12));
    expect(no.rule).toMatchObject({ points: 49, passed: false, provisional: true });
  });

  it('compensation: one skill 0, the other two full = passes (67 / 100 proportionally)', () => {
    const r = scoreMockExam(synthetic(TOTAL), answers(25, 25, 0));
    expect(r.rule).toMatchObject({ points: 67, passed: true });
  });
});

describe('English A2 rule: the percentage average of the skills, approximate threshold, without a per-part minimum', () => {
  it('an average above the threshold passes, below it does not; the spoken (placeholder) is left out of the average, provisional', () => {
    const e = synthetic(AVERAGE);
    const ok = scoreMockExam(e, answers(18, 18, 18));
    expect(ok.rule).toMatchObject({ kind: 'average', pct: 72, passPct: AVERAGE_PASS_PCT, approximate: true, passed: true, provisional: true });
    const no = scoreMockExam(e, answers(17, 17, 17));
    expect(no.rule).toMatchObject({ pct: 68, passed: false });
    expect(no.passed).toBe(false);
  });

  it('compensation: next to one weak skill (40%), two full ones average 80%, passes', () => {
    const r = scoreMockExam(synthetic(AVERAGE), answers(25, 10, 25));
    expect(r.rule).toMatchObject({ pct: 80, passed: true });
  });

  it('with all four skills the average comes from all four', () => {
    const r = scoreMockExam(synthetic(AVERAGE, true), answers(25, 25, 0, 0));
    expect(r.rule).toMatchObject({ pct: 50, passed: false, provisional: false });
  });

  it('the threshold is a single constant (approximate value: 70%)', () => {
    expect(AVERAGE_PASS_PCT).toBe(70);
  });
});

describe('dictation: word-by-word scoring, a listening AND writing mark', () => {
  const dict = (text = 'We go shopping on Saturday. There are no buses.'): MockTask => ({
    id: 'd',
    skill: 'listening',
    kind: 'dictation',
    instruction: '',
    audio: [],
    text,
  });

  it('exactly written text = every mark, even without case and punctuation', () => {
    const r = scoreMockTask(dict(), { text: 'we go shopping on saturday there are no buses' });
    expect(r.correct).toBe(r.total);
    expect(r.total).toBe(2 * 9);
  });

  it('a misspelled or omitted word is not a point, the others are; empty = 0', () => {
    const typo = scoreMockTask(dict(), { text: 'We go shoping on Saturday. There are no buses.' });
    expect(typo.correct).toBe(typo.total - 2); // the listening and writing mark of "shopping"
    const missing = scoreMockTask(dict(), { text: 'We go shopping Saturday. There are buses.' });
    expect(missing.correct).toBe(missing.total - 4);
    expect(scoreMockTask(dict(), {}).correct).toBe(0);
    expect(scoreMockTask(dict(), { text: 'asdf' }).correct).toBe(0);
  });

  it('the words count toward the listening and the writing skill too (the spoken one not)', () => {
    const e: MockExam = {
      ...synthetic(TOTAL),
      papers: [{ id: 'written', name: 'Written', minutes: 60, points: 75, placeholder: false, tasks: [dict(), { ...task25('reading') }] }],
    };
    const r = scoreMockExam(e, { d: { text: 'We go shopping on Saturday. There are no buses.' } });
    const by = Object.fromEntries(r.skills.map((s) => [s.skill, s]));
    expect([by.listening.correct, by.listening.total]).toEqual([9, 9]);
    expect([by.writing.correct, by.writing.total]).toEqual([9, 9]);
    expect(by.listening.points).toBe(25);
    expect(by.writing.points).toBe(25);
  });
});

describe('typed gap', () => {
  const gaps: MockTask = {
    id: 'g',
    skill: 'reading',
    kind: 'gap_type',
    instruction: '',
    gaps: [
      { text: 'I ___ find my phone.', answer: "can't" },
      { text: 'We eat ___ on Fridays.', answer: 'fish' },
    ],
  };

  it('accepted even without case and apostrophe, empty and wrong are not', () => {
    expect(scoreMockTask(gaps, { '0': 'cant', '1': 'FISH' }).correct).toBe(2);
    expect(scoreMockTask(gaps, { '0': "can't", '1': 'meat' }).correct).toBe(1);
    expect(scoreMockTask(gaps, { '0': '', '1': '  ' }).correct).toBe(0);
  });
});

describe('real task sets: they pass with every right answer', () => {
  function solve(e: MockExam): MockAnswers {
    const all: MockAnswers = {};
    for (const p of e.papers) {
      for (const t of p.tasks) {
        const a: Record<string, string | number | boolean | null> = {};
        if (t.kind === 'read_mc') t.passages.forEach((x, i) => (a[String(i)] = x.correct));
        if (t.kind === 'gap_mc') t.gaps.forEach((x, i) => (a[String(i)] = x.correct));
        if (t.kind === 'gap_type') t.gaps.forEach((x, i) => (a[String(i)] = x.answer));
        if (t.kind === 'dictation') a.text = t.text;
        if (t.kind === 'listen_mc' || t.kind === 'listen_dialogue') t.questions.forEach((x, i) => (a[String(i)] = x.correct));
        if (t.kind === 'true_false') t.statements.forEach((x, i) => (a[String(i)] = x.answer));
        if (t.kind === 'match' || t.kind === 'listen_match') Object.assign(a, t.answer);
        if (t.kind === 'form_fill') for (const f of t.fields) a[f.id] = GOOD_FORM[f.check ?? 'word'];
        if (t.kind === 'short_message') a.text = `${t.points.map((x) => x.keywords[0]).join(' ')} ${DISTINCT_WORDS.slice(0, t.minWords).join(' ')}`;
        all[t.id] = a;
      }
    }
    return all;
  }

  const GOOD_FORM = { fullname: 'Ana Kovács', word: 'húngara', address: 'Calle Ficticia 123', age: '30', phone: '5500000000', email: 'ana@example.com', level: 'A1' };
  // 125 distinct "words" with vowels for the word-count mark (repeating a word is not text).
  const SYL = ['ba', 'de', 'fi', 'ko', 'mu'];
  const DISTINCT_WORDS = Array.from({ length: 125 }, (_, i) => `${SYL[i % 5]}${SYL[Math.floor(i / 5) % 5]}${SYL[Math.floor(i / 25) % 5]}n`);

  for (const [target, level] of [['es', 'A1'], ['es', 'A2'], ['en', 'A1'], ['en', 'A2']] as const) {
    it(`${target} ${level}`, () => {
      setPcicTarget(target);
      const e = buildMockExam({ target, level, items: pcicItemsForLevel(level), seed: 11 });
      const r = scoreMockExam(e, solve(e));
      expect(r.skills.filter((s) => s.included).map((s) => s.points)).toEqual([25, 25, 25]);
      expect(r.passed).toBe(true);
      expect(r.provisional).toBe(true);
    });
  }
});

describe('scoreMockTask: per item', () => {
  it('writing: keyword content points (accent- and case-insensitive) + word count', () => {
    const t: MockTask = {
      id: 'w',
      skill: 'writing',
      kind: 'short_message',
      instruction: '',
      prompt: '',
      minWords: 5,
      points: [
        { id: 'a', label: 'a', keywords: ['me llamo'] },
        { id: 'b', label: 'b', keywords: ['sábado'] },
      ],
    };
    expect(mockTaskItemCount(t)).toBe(3);
    const full = scoreMockTask(t, { text: 'ME LLAMO Ana y el SABADO voy a casa' });
    expect(full).toMatchObject({ correct: 3, total: 3 });
    const part = scoreMockTask(t, { text: 'Me llamo Ana' });
    expect(part.correct).toBe(1);
    expect(scoreMockTask(t, {}).correct).toBe(0);
  });

  it('form: filled in, and a number in a number field; true/false and matching per the key', () => {
    const form: MockTask = {
      id: 'f',
      skill: 'writing',
      kind: 'form_fill',
      instruction: '',
      context: '',
      fields: [
        { id: 'n', label: 'Nombre', type: 'text' },
        { id: 'e', label: 'Edad', type: 'number' },
      ],
    };
    expect(scoreMockTask(form, { n: 'Kálmán', e: 'treinta' }).correct).toBe(1);
    expect(scoreMockTask(form, { n: 'Kálmán', e: '30' }).correct).toBe(2);
    const tf: MockTask = { id: 't', skill: 'reading', kind: 'true_false', instruction: '', text: '', statements: [{ s: 'x', answer: true }, { s: 'y', answer: false }] };
    expect(scoreMockTask(tf, { '0': true, '1': true }).correct).toBe(1);
    const m: MockTask = {
      id: 'm',
      skill: 'reading',
      kind: 'match',
      instruction: '',
      prompts: [{ id: 'p1', text: 'hola' }],
      options: [{ id: 'a', text: 'hello' }, { id: 'b', text: 'bye' }],
      answer: { p1: 'a' },
    };
    expect(scoreMockTask(m, { p1: 'a' }).items[0]).toMatchObject({ label: 'hola', given: 'hello', expected: 'hello', ok: true });
    expect(scoreMockTask(m, { p1: 'b' }).correct).toBe(0);
  });

  it('helpers: fold and countWords', () => {
    expect(fold('  Sábado ’X’ ')).toBe("sabado 'x'");
    expect(countWords('  uno  dos tres ')).toBe(3);
    expect(countWords('')).toBe(0);
  });
});
