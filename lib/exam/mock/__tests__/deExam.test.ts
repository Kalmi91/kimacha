// The German practice exam: target de is a MockTarget. A1 / A2 = the speaking paper only, B1-C1 = reading, listening, writing and
// speaking like the Hungarian direction; the papers are written in German (data/exams/mock/de-*.json) in the structure of the
// Goethe-Zertifikat modules (Lesen / Hören with 30 items from B1 on, the number of plays of each recording, the Schreiben tasks).
// All 14 papers are wired; a level whose files are missing or empty would be "not written yet" and is not offered.

import { MOCK_AUTHORED } from '@/data/exams/mock';
import type { PcicItem } from '@/data/pcic';
import { authoredTasks } from '../authored';
import { getMockBlueprint, MOCK_LEVELS, mockAvailable } from '../blueprint';
import { buildMockExam } from '../build';
import { buildGlossaryIndex, mockGlossary } from '../glossary';
import { scoreMockExam } from '../score';
import { mockTaskItemCount, TASK_PREFIX, type AuthoredPaperFile, type AuthoredTask, type MockAnswers, type MockLevel, type MockReadMcTask } from '../types';
import { fold, isNonsenseToken } from '../writing';

const deFiles = MOCK_AUTHORED.filter((f) => f.target === 'de');
const file = (level: string, paper: string) => deFiles.find((f) => f.level === level && f.paper === paper)!;

describe('de: levels, papers, names, rule', () => {
  it('every level is offered', () => {
    expect(MOCK_LEVELS.de).toEqual(['A1', 'A2', 'B1', 'B2', 'C1']);
  });

  it('A1 / A2 are the speaking paper only (not a placeholder), minutes as in es', () => {
    for (const [level, minutes] of [['A1', 10], ['A2', 12]] as const) {
      const bp = getMockBlueprint('de', level);
      expect(bp.papers.map((p) => [p.id, p.name, p.minutes, p.skills, !!p.placeholder])).toEqual([['speaking', 'Sprechen', minutes, ['speaking'], false]]);
    }
  });

  it('B1-C1: Lesen, Hören, Schreiben, Sprechen with the Goethe minutes and German names; the speaking is a placeholder while it is empty', () => {
    const shapeOf = (level: MockLevel) => getMockBlueprint('de', level).papers.map((p) => [p.id, p.name, p.minutes, !!p.placeholder]);
    expect(shapeOf('B1')).toEqual([['reading', 'Lesen', 65, false], ['listening', 'Hören', 40, false], ['writing', 'Schreiben', 60, false], ['speaking', 'Sprechen', 15, true]]);
    expect(shapeOf('B2')).toEqual([['reading', 'Lesen', 65, false], ['listening', 'Hören', 40, false], ['writing', 'Schreiben', 75, false], ['speaking', 'Sprechen', 15, true]]);
    expect(shapeOf('C1')).toEqual([['reading', 'Lesen', 65, false], ['listening', 'Hören', 40, false], ['writing', 'Schreiben', 75, false], ['speaking', 'Sprechen', 20, true]]);
  });

  it('the rule is the approximate average against 60 percent (the Goethe pass mark), the exam is labelled as a sample, the skill names are German', () => {
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1'] as const) {
      const bp = getMockBlueprint('de', level);
      expect(bp.official).toBe(false);
      expect(bp.rule).toMatchObject({ kind: 'average', passPct: 60, approximate: true });
      expect(bp.skillNames.speaking).toBe('Sprechen');
    }
  });
});

describe('de: the entry point is offered once the papers are written', () => {
  it('A1 / A2 need an authored speaking form (they are the whole exam); B1-C1 need reading, listening and writing', () => {
    expect(mockAvailable('de', 'A1', [])).toBe(false);
    expect(mockAvailable('de', 'B1', [])).toBe(false);
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1'] as const) expect(mockAvailable('de', level)).toBe(true);
  });

  it('not written yet (an empty forms list) = the level is not offered, the exam is empty', () => {
    const empty = (level: MockLevel, paper: string): AuthoredPaperFile => ({ target: 'de', level, paper, forms: [] });
    const b2 = ['reading', 'listening', 'writing'].map((p) => empty('B2', p));
    expect(mockAvailable('de', 'B2', b2)).toBe(false);
    expect(buildMockExam({ target: 'de', level: 'B2', items: [], seed: 1, authored: b2 }).papers.every((p) => p.tasks.length === 0)).toBe(true);
  });

  it('the files of another direction do not count for de', () => {
    expect(mockAvailable('de', 'B1', MOCK_AUTHORED.filter((f) => f.target === 'es'))).toBe(false);
  });
});

describe('de: the built exam', () => {
  it('tasks are numbered TEIL n.; an authored TAREA / PART / FELADAT / TEIL prefix is replaced, not doubled', () => {
    const task: AuthoredTask = { kind: 'passage_mc', skill: 'reading', instruction: 'TAREA 7. Lesen Sie.', text: 'Text.', questions: [{ stem: 'Was?', options: ['a', 'b', 'c'], correct: 0 }] };
    const f: AuthoredPaperFile = { target: 'de', level: 'B1', paper: 'reading', forms: [{ id: 'f1', tasks: [task, { ...task, instruction: 'TEIL 2. Lesen Sie.' }, { ...task, instruction: 'FELADAT 3. Lesen Sie.' }] }] };
    expect(authoredTasks('de', 'B1', 'reading', 0, 1, [f]).map((t) => t.instruction)).toEqual(['TEIL 1. Lesen Sie.', 'TEIL 2. Lesen Sie.', 'TEIL 3. Lesen Sie.']);
    expect(TASK_PREFIX.test('TEIL 4. x')).toBe(true);
  });

  it.each(['A1', 'A2'] as const)('%s: one speaking paper with three tasks', (level) => {
    const exam = buildMockExam({ target: 'de', level, items: [], seed: 3 });
    expect(exam.papers.map((p) => [p.id, p.placeholder])).toEqual([['speaking', false]]);
    const tasks = exam.papers[0].tasks;
    expect(tasks.map((t) => t.id)).toEqual(['speaking-1', 'speaking-2', 'speaking-3']);
    expect(tasks.every((t, i) => t.kind === 'speaking' && t.instruction.startsWith(`TEIL ${i + 1}. `))).toBe(true);
  });

  it('the speaking model answers earn every point and the exam is scored by the de rule (the speaking skill alone at A1 / A2)', () => {
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1'] as const) {
      const exam = buildMockExam({ target: 'de', level, items: [], seed: 2 });
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
      if (level === 'A1' || level === 'A2') {
        expect(result.rule).toMatchObject({ kind: 'average', pct: 100, passed: true });
        expect(result.passed).toBe(true);
      }
    }
  });
});

describe('de: German writing is not mistaken for nonsense', () => {
  it('ß folds to ss and the German consonant clusters (sch, tsch, ch, ck, pf, ng) do not count as a run of consonants', () => {
    expect(fold('Straße')).toBe('strasse');
    for (const word of ['Gesellschaft', 'Landschaft', 'Handschrift', 'Freundschaft', 'Wirtschaftsprüfung', 'Angstschweiß', 'Deutschstunde']) expect(isNonsenseToken(fold(word).replace(/[^a-z]/g, ''))).toBe(false);
    for (const mash of ['bcdfghk', 'qwertz', 'asdfgh', 'aaaaa']) expect(isNonsenseToken(mash)).toBe(true);
  });
});

describe('de: the glossary of a de exam gives the meaning in the learner language', () => {
  const item = { id: 'd1', es: 'la casa', en: 'the house', hu: 'a ház', de: 'das Haus', kind: 'word', section: '', order: 0 } as PcicItem;
  const task: MockReadMcTask = { id: 'reading-1', skill: 'reading', kind: 'read_mc', instruction: 'TEIL 1.', passages: [{ text: 'Das Haus ist groß.', options: ['a', 'b', 'c'], correct: 0 }] };

  it.each([['es', 'la casa'], ['en', 'the house'], ['hu', 'a ház'], [null, 'the house']] as const)('source %s -> %s', (source, meaning) => {
    const index = buildGlossaryIndex([item], 'de', source);
    expect(mockGlossary(task, index, new Set())).toEqual([{ itemId: 'd1', term: 'haus', meaning }]);
  });
});

describe('de: the shipped papers', () => {
  it('all 14 papers are wired (A1 / A2 speaking, four papers each of B1, B2 and C1), one form each', () => {
    const wanted = [
      ...['A1', 'A2'].map((l) => `${l}-speaking`),
      ...['B1', 'B2', 'C1'].flatMap((l) => ['reading', 'listening', 'writing', 'speaking'].map((p) => `${l}-${p}`)),
    ];
    expect(deFiles.map((f) => `${f.level}-${f.paper}`).sort()).toEqual([...wanted].sort());
    for (const f of deFiles) expect(f.forms).toHaveLength(1);
  });

  it('reading and listening of B1-C1 have 30 items like the Goethe modules', () => {
    for (const f of deFiles.filter((x) => x.level !== 'A1' && x.level !== 'A2' && (x.paper === 'reading' || x.paper === 'listening'))) {
      const items = f.forms[0].tasks.reduce((n, t) => n + mockTaskItemCount({ ...t, id: 'x' } as never), 0);
      expect([`${f.level}-${f.paper}`, items]).toEqual([`${f.level}-${f.paper}`, 30]);
    }
  });

  it('the listening papers play each recording as often as the Goethe module does', () => {
    const plays = (level: string) => file(level, 'listening').forms[0].tasks.map((t) => (t as { plays?: number }).plays);
    expect(plays('B1')).toEqual([2, 1, 1, 1]);
    expect(plays('B2')).toEqual([1, 2, 1, 2]);
    expect(plays('C1')).toEqual([1, 2, 1, 2]);
  });

  it.each(deFiles.map((f) => [`${f.level}-${f.paper}`, f] as const))('%s: no em dash, no Austrian ss-for-ß slips in the instructions, every instruction non-empty and in German', (_name, f) => {
    const text = JSON.stringify(f);
    expect(text).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`));
    for (const form of f.forms) {
      for (const task of form.tasks) {
        expect(task.instruction.trim().length).toBeGreaterThan(10);
        expect(task.instruction).not.toMatch(/^(TAREA|PART|FELADAT|TEIL) \d/);
      }
    }
  });

  it.each(deFiles.map((f) => [`${f.level}-${f.paper}`, f] as const))('%s: every answer key points to an existing option', (_name, f) => {
    for (const form of f.forms) {
      for (const task of form.tasks) {
        if (task.kind === 'passage_mc') for (const q of task.questions) expect(q.correct).toBeLessThan(q.options.length);
        if (task.kind === 'clips_mc') for (const c of task.clips) for (const q of c.questions) expect(q.correct).toBeLessThan(q.options.length);
        if (task.kind === 'match_pool') {
          const ids = task.options.map((o) => o.id);
          for (const p of task.prompts) expect(ids).toContain(task.answer[p.id]);
          if (task.unique) expect(new Set(Object.values(task.answer)).size).toBe(task.prompts.length);
        }
        if (task.kind === 'gapped_text') for (const id of Object.values(task.answer)) expect(task.fragments.map((x) => x.id)).toContain(id);
        if (task.kind === 'cloze') for (const g of task.gaps) if ('options' in g) expect(g.correct).toBeLessThan(g.options.length);
      }
    }
  });

  it('the right answers are spread over the positions: no option position holds more than half of the multiple-choice keys of a paper', () => {
    for (const f of deFiles.filter((x) => x.paper === 'reading' || x.paper === 'listening')) {
      const keys: number[] = [];
      for (const task of f.forms[0].tasks) {
        if (task.kind === 'passage_mc') for (const q of task.questions) if (q.options.length === 3) keys.push(q.correct);
        if (task.kind === 'clips_mc') for (const c of task.clips) for (const q of c.questions) if (q.options.length === 3) keys.push(q.correct);
        if (task.kind === 'cloze') for (const g of task.gaps) if ('options' in g) keys.push(g.correct);
      }
      if (keys.length < 6) continue;
      for (const position of [0, 1, 2]) expect(keys.filter((k) => k === position).length).toBeLessThanOrEqual(Math.ceil(keys.length / 2));
    }
  });
});
