// The Hungarian practice exam (E90): target hu is a MockTarget. A1 / A2 = the speaking paper only, B1-C1 = reading,
// listening, writing and speaking like the Spanish direction; the papers are written in Hungarian (data/exams/mock/hu-*.json),
// every hu paper has the task kinds and counts of its Spanish counterpart. The B2 / C1 files are wired when they are written
// (an empty or missing file is "not written yet": the level is not offered).

import { MOCK_AUTHORED } from '@/data/exams/mock';
import photos from '@/data/exams/mock/photos.json';
import type { PcicItem } from '@/data/pcic';
import { authoredTasks } from '../authored';
import { getMockBlueprint, MOCK_LEVELS, mockAvailable } from '../blueprint';
import { buildMockExam } from '../build';
import { buildGlossaryIndex, mockGlossary } from '../glossary';
import { scoreMockExam } from '../score';
import { TASK_PREFIX, type AuthoredPaperFile, type AuthoredTask, type MockAnswers, type MockLevel, type MockReadMcTask } from '../types';

const huFiles = MOCK_AUTHORED.filter((f) => f.target === 'hu');
const esFile = (hu: AuthoredPaperFile) => MOCK_AUTHORED.find((f) => f.target === 'es' && f.level === hu.level && f.paper === hu.paper);

/** The structure of a task: the kind and every count the format fixes (not the text). */
function shape(task: AuthoredTask): unknown {
  switch (task.kind) {
    case 'passage_mc':
      return [task.kind, task.skill, task.questions.map((q) => q.options.length), !!task.audio];
    case 'clips_mc':
      return [task.kind, task.skill, task.clips.map((c) => c.questions.map((q) => q.options.length)), task.clips.map((c) => !!c.audio)];
    case 'match_pool':
      return [task.kind, task.skill, task.prompts.length, task.options.length, task.unique, task.prompts.map((p) => !!p.audio)];
    case 'gapped_text':
      return [task.kind, task.skill, Object.keys(task.answer).length, task.fragments.length];
    case 'cloze':
      return [task.kind, task.skill, task.gaps.map((g) => ('options' in g ? g.options.length : 'open'))];
    case 'pick_statements':
      return [task.kind, task.skill, task.statements.length, task.pick];
    case 'transform':
      return [task.kind, task.skill, task.items.length];
    case 'essay':
      return [task.kind, task.skill, task.choices.map((c) => [c.minWords, c.maxWords, c.points.length, !!c.audio])];
    case 'speaking':
      return [task.kind, task.prepSeconds ?? 0, task.talkMinutes, task.follows ?? 0, task.choices.map((c) => [c.turns.map((t) => t.points.length), c.photos?.length ?? 0])];
    default:
      return [(task as { kind: string }).kind];
  }
}

describe('hu: levels, papers, names, rule', () => {
  it('every level is offered', () => {
    expect(MOCK_LEVELS.hu).toEqual(['A1', 'A2', 'B1', 'B2', 'C1']);
  });

  it('A1 / A2 are the speaking paper only (not a placeholder), minutes as in es', () => {
    for (const [level, minutes] of [['A1', 10], ['A2', 12]] as const) {
      const bp = getMockBlueprint('hu', level);
      expect(bp.papers.map((p) => [p.id, p.name, p.minutes, p.skills, !!p.placeholder])).toEqual([['speaking', 'Beszédkészség', minutes, ['speaking'], false]]);
    }
  });

  it('B1-C1: reading, listening, writing, speaking with the es minutes and Hungarian names; the speaking is a placeholder while it is empty', () => {
    const shapeOf = (level: MockLevel) => getMockBlueprint('hu', level).papers.map((p) => [p.id, p.name, p.minutes, !!p.placeholder]);
    const names = ['Olvasott szöveg értése', 'Hallott szöveg értése', 'Íráskészség', 'Beszédkészség'];
    expect(shapeOf('B1')).toEqual([['reading', names[0], 70, false], ['listening', names[1], 40, false], ['writing', names[2], 60, false], ['speaking', names[3], 15, true]]);
    expect(shapeOf('B2')).toEqual([['reading', names[0], 70, false], ['listening', names[1], 40, false], ['writing', names[2], 80, false], ['speaking', names[3], 20, true]]);
    expect(shapeOf('C1')).toEqual([['reading', names[0], 90, false], ['listening', names[1], 50, false], ['writing', names[2], 80, false], ['speaking', names[3], 20, true]]);
  });

  it('the rule is the approximate average, the exam is labelled as a sample (not official), the skill names are in Hungarian', () => {
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1'] as const) {
      const bp = getMockBlueprint('hu', level);
      expect(bp.official).toBe(false);
      expect(bp.rule).toMatchObject({ kind: 'average', approximate: true });
      expect(bp.skillNames.speaking).toBe('Beszédkészség');
    }
  });
});

describe('hu: the entry point is offered once the papers are written', () => {
  it('A1 / A2 need an authored speaking form (they are the whole exam); B1 needs reading, listening and writing', () => {
    expect(mockAvailable('hu', 'A1', [])).toBe(false);
    expect(mockAvailable('hu', 'B1', [])).toBe(false);
    for (const level of ['A1', 'A2', 'B1'] as const) expect(mockAvailable('hu', level)).toBe(true);
  });

  it('not written yet (an empty forms list) = the level is not offered, the exam is empty', () => {
    const empty = (level: MockLevel, paper: string): AuthoredPaperFile => ({ target: 'hu', level, paper, forms: [] });
    const b2 = ['reading', 'listening', 'writing'].map((p) => empty('B2', p));
    expect(mockAvailable('hu', 'B2', b2)).toBe(false);
    expect(buildMockExam({ target: 'hu', level: 'B2', items: [], seed: 1, authored: b2 }).papers.every((p) => p.tasks.length === 0)).toBe(true);
  });

  it('the files of another direction do not count for hu', () => {
    expect(mockAvailable('hu', 'B1', MOCK_AUTHORED.filter((f) => f.target === 'es'))).toBe(false);
  });
});

describe('hu: the built exam', () => {
  it('tasks are numbered FELADAT n.; an authored TAREA / PART / FELADAT prefix is replaced, not doubled', () => {
    const task: AuthoredTask = { kind: 'passage_mc', skill: 'reading', instruction: 'TAREA 7. Olvassa el.', text: 'Szöveg.', questions: [{ stem: 'Mi?', options: ['a', 'b', 'c'], correct: 0 }] };
    const file: AuthoredPaperFile = { target: 'hu', level: 'B1', paper: 'reading', forms: [{ id: 'f1', tasks: [task, { ...task, instruction: 'FELADAT 2. Olvassa el.' }, { ...task, instruction: 'PART 3. Olvassa el.' }] }] };
    expect(authoredTasks('hu', 'B1', 'reading', 0, 1, [file]).map((t) => t.instruction)).toEqual(['FELADAT 1. Olvassa el.', 'FELADAT 2. Olvassa el.', 'FELADAT 3. Olvassa el.']);
    expect(TASK_PREFIX.test('FELADAT 4. x')).toBe(true);
  });

  it.each(['A1', 'A2'] as const)('%s: one speaking paper with the three tasks of the es A1 / A2 oral paper', (level) => {
    const exam = buildMockExam({ target: 'hu', level, items: [], seed: 3 });
    const es = buildMockExam({ target: 'es', level, items: [], seed: 3 });
    expect(exam.papers.map((p) => [p.id, p.placeholder])).toEqual([['speaking', false]]);
    const tasks = exam.papers[0].tasks;
    expect(tasks.map((t) => t.id)).toEqual(['speaking-1', 'speaking-2', 'speaking-3']);
    expect(tasks.every((t, i) => t.kind === 'speaking' && t.instruction.startsWith(`FELADAT ${i + 1}. `))).toBe(true);
    expect(tasks.map((t) => t.kind)).toEqual(es.papers.find((p) => p.id === 'speaking')!.tasks.map((t) => t.kind));
  });

  it('B1: reading, listening, writing and speaking papers with the task counts of the es B1 exam', () => {
    const hu = buildMockExam({ target: 'hu', level: 'B1', items: [], seed: 5 });
    const es = buildMockExam({ target: 'es', level: 'B1', items: [], seed: 5 });
    expect(hu.papers.map((p) => [p.id, p.tasks.length, p.placeholder])).toEqual(es.papers.map((p) => [p.id, p.tasks.length, p.placeholder]));
    expect(hu.papers.every((p) => p.tasks.length > 0 && p.tasks.every((t, i) => t.instruction.startsWith(`FELADAT ${i + 1}. `)))).toBe(true);
  });

  it('the speaking model answers earn every point and the exam is scored by the hu rule (the speaking skill alone at A1 / A2)', () => {
    for (const level of ['A1', 'A2', 'B1'] as const) {
      const exam = buildMockExam({ target: 'hu', level, items: [], seed: 2 });
      const answers: MockAnswers = {};
      for (const task of exam.papers.find((p) => p.id === 'speaking')!.tasks) {
        if (task.kind !== 'speaking') continue;
        const choice = task.choices[0];
        answers[task.id] = { choice: choice.id, ...Object.fromEntries(choice.turns.map((t) => [t.id, t.model])) };
      }
      const result = scoreMockExam(exam, answers);
      const speaking = result.skills.find((s) => s.skill === 'speaking')!;
      expect(speaking.included).toBe(true);
      expect(speaking.correct).toBe(speaking.total);
      expect(speaking.points).toBe(25);
      if (level !== 'B1') {
        expect(result.rule).toMatchObject({ kind: 'average', pct: 100, passed: true });
        expect(result.passed).toBe(true);
      }
    }
  });
});

describe('hu: the glossary of a hu exam gives the meaning in the learner language', () => {
  const item = { id: 'h1', es: 'la casa', en: 'the house', hu: 'a ház', kind: 'word', section: '', order: 0 } as PcicItem;
  const task: MockReadMcTask = { id: 'reading-1', skill: 'reading', kind: 'read_mc', instruction: 'FELADAT 1.', passages: [{ text: 'A ház nagy.', options: ['a', 'b', 'c'], correct: 0 }] };

  it.each([['es', 'la casa'], ['en', 'the house'], [null, 'the house']] as const)('source %s -> %s', (source, meaning) => {
    const index = buildGlossaryIndex([item], 'hu', source);
    expect(mockGlossary(task, index, new Set())).toEqual([{ itemId: 'h1', term: 'ház', meaning }]);
  });
});

describe('hu: the shipped papers', () => {
  it('at least the A1 / A2 speaking and the four B1 papers are wired, one form each', () => {
    const names = huFiles.map((f) => `${f.level}-${f.paper}`);
    for (const wanted of ['A1-speaking', 'A2-speaking', 'B1-reading', 'B1-listening', 'B1-writing', 'B1-speaking']) expect(names).toContain(wanted);
    for (const f of huFiles) expect(f.forms.length).toBeGreaterThanOrEqual(1);
  });

  it.each(huFiles.map((f) => [`${f.level}-${f.paper}`, f] as const))('%s has the task kinds, counts and format of its es counterpart', (_name, file) => {
    const es = esFile(file);
    expect(es).toBeDefined();
    for (const [i, form] of file.forms.entries()) {
      expect(form.tasks.map(shape)).toEqual(es!.forms[Math.min(i, es!.forms.length - 1)].tasks.map(shape));
    }
  });

  it.each(huFiles.map((f) => [`${f.level}-${f.paper}`, f] as const))('%s: Hungarian letters (ő ű, never õ û ô), no em dash, every instruction non-empty', (_name, file) => {
    const text = JSON.stringify(file);
    expect(text).not.toMatch(/[õûôÕÛÔ]/);
    expect(text).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`));
    for (const form of file.forms) for (const task of form.tasks) expect(task.instruction.trim().length).toBeGreaterThan(10);
  });

  it.each(huFiles.map((f) => [`${f.level}-${f.paper}`, f] as const))('%s: every answer key points to an existing option', (_name, file) => {
    for (const form of file.forms) {
      for (const task of form.tasks) {
        if (task.kind === 'passage_mc') for (const q of task.questions) expect(q.correct).toBeLessThan(q.options.length);
        if (task.kind === 'clips_mc') for (const c of task.clips) for (const q of c.questions) expect(q.correct).toBeLessThan(q.options.length);
        if (task.kind === 'match_pool') {
          const ids = task.options.map((o) => o.id);
          for (const p of task.prompts) expect(ids).toContain(task.answer[p.id]);
          if (task.unique) expect(new Set(Object.values(task.answer)).size).toBe(task.prompts.length);
        }
        if (task.kind === 'gapped_text') for (const id of Object.values(task.answer)) expect(task.fragments.map((f) => f.id)).toContain(id);
        if (task.kind === 'cloze') for (const g of task.gaps) if ('options' in g) expect(g.correct).toBeLessThan(g.options.length);
      }
    }
  });

  it('the speaking papers use the photos of the es papers of the same level, and they exist in the registry', () => {
    for (const file of huFiles.filter((f) => f.paper === 'speaking')) {
      const used = (f: AuthoredPaperFile) => [...new Set(f.forms.flatMap((form) => form.tasks.flatMap((t) => (t.kind === 'speaking' ? t.choices.flatMap((c) => c.photos ?? []) : []))))].sort();
      expect(used(file)).toEqual(used(esFile(file)!));
      for (const key of used(file)) expect(Object.keys(photos)).toContain(key);
    }
  });
});
