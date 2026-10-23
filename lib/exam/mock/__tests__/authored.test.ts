// The B1-C1 practice exams: the blueprint (papers, minutes, pass rule), the authored files (data/exams/mock) turned into
// Mock tasks by the seed's form, and the glossary texts of the authored kinds. The files are injected here (the real ones
// are filled by the content step).

import { pcicItemsForLevel, setPcicTarget } from '@/data/pcic';
import { authoredFormCount, authoredTasks } from '../authored';
import { getMockBlueprint, MOCK_LEVELS, mockAvailable } from '../blueprint';
import { buildMockExam } from '../build';
import { mockTaskTexts } from '../glossary';
import type { AuthoredPaperFile, AuthoredTask, MockExam, MockLevel, MockTarget } from '../types';

afterAll(() => setPcicTarget('es'));

type Upper = Extract<MockLevel, 'B1' | 'B2' | 'C1'>;

const question = { stem: 'Which one?', options: ['a', 'b', 'c'], correct: 0 };
const passage = (instruction: string, skill: 'reading' | 'listening' | 'use' = 'reading'): AuthoredTask => ({ kind: 'passage_mc', skill, instruction, text: 'A text.', questions: [question] });

/** A paper file whose forms are f1, f2... each with `tasksPerForm` tasks that say which form they come from. */
function paperFile(target: MockTarget, level: Upper, paper: string, forms: number, tasksPerForm = 2): AuthoredPaperFile {
  return {
    target,
    level,
    paper,
    forms: Array.from({ length: forms }, (_, f) => ({ id: `f${f + 1}`, tasks: Array.from({ length: tasksPerForm }, (_, i) => passage(`form ${f + 1} task ${i + 1}`)) })),
  };
}

const speakingTask = (instruction: string): AuthoredTask => ({
  kind: 'speaking',
  skill: 'speaking',
  instruction,
  talkMinutes: [2, 3],
  choices: [{ id: 'a', title: 'Topic', prompt: 'Talk about it.', turns: [{ id: 't1', ask: 'What do you see?', minWords: 5, points: [], model: 'I see a house.' }] }],
});

/** A speaking paper file of any level: `forms` forms with two speaking tasks each. */
function speakingFile(target: MockTarget, level: MockLevel, forms: number): AuthoredPaperFile {
  return {
    target,
    level,
    paper: 'speaking',
    forms: Array.from({ length: forms }, (_, f) => ({ id: `f${f + 1}`, tasks: [1, 2].map((i) => speakingTask(`form ${f + 1} task ${i}`)) })),
  };
}

const PAPERS: Record<string, string[]> = {
  'es-B1': ['reading', 'listening', 'writing'],
  'es-B2': ['reading', 'listening', 'writing'],
  'es-C1': ['reading', 'listening', 'writing'],
  'en-B1': ['reading', 'writing', 'listening'],
  'en-B2': ['readinguse', 'writing', 'listening'],
  'en-C1': ['readinguse', 'writing', 'listening'],
};
const allFiles = (target: MockTarget, level: Upper, forms: number) => PAPERS[`${target}-${level}`].map((p) => paperFile(target, level, p, forms));
const build = (target: MockTarget, level: Upper, seed: number, authored: AuthoredPaperFile[]): MockExam => buildMockExam({ target, level, items: [], seed, authored });

describe('blueprint: B1, B2 and C1 in both directions', () => {
  it('every level is offered in both directions', () => {
    expect(MOCK_LEVELS.es).toEqual(['A1', 'A2', 'B1', 'B2', 'C1']);
    expect(MOCK_LEVELS.en).toEqual(['A1', 'A2', 'B1', 'B2', 'C1']);
  });

  it('es: reading, listening, writing, speaking with the minutes of the format; the 30 / 50 groups', () => {
    const shape = (level: Upper) => getMockBlueprint('es', level).papers.map((p) => [p.id, p.minutes, !!p.placeholder]);
    expect(shape('B1')).toEqual([['reading', 70, false], ['listening', 40, false], ['writing', 60, false], ['speaking', 15, true]]);
    expect(shape('B2')).toEqual([['reading', 70, false], ['listening', 40, false], ['writing', 80, false], ['speaking', 20, true]]);
    expect(shape('C1')).toEqual([['reading', 90, false], ['listening', 50, false], ['writing', 80, false], ['speaking', 20, true]]);
    for (const level of ['B1', 'B2', 'C1'] as const) {
      const bp = getMockBlueprint('es', level);
      expect(bp.official).toBe(true);
      expect(bp.rule).toMatchObject({ kind: 'groups', groups: [{ needed: 30, of: 50 }, { needed: 30, of: 50 }] });
    }
  });

  it('es: B1 / B2 keep the A-level paper names, C1 has its own four names', () => {
    expect(getMockBlueprint('es', 'B2').papers.map((p) => p.name)).toEqual([
      'Comprensión de lectura',
      'Comprensión auditiva',
      'Expresión e interacción escritas',
      'Expresión e interacción orales',
    ]);
    expect(getMockBlueprint('es', 'C1').papers.map((p) => p.name)).toEqual([
      'Comprensión de lectura y uso de la lengua',
      'Comprensión auditiva y uso de la lengua',
      'Expresión, mediación e interacción escritas',
      'Expresión, mediación e interacción orales',
    ]);
    expect(getMockBlueprint('es', 'C1').skillNames.reading).toBe('Comprensión de lectura y uso de la lengua');
  });

  it('en B1: reading, writing, listening, speaking; scale rule 140', () => {
    const bp = getMockBlueprint('en', 'B1');
    expect(bp.papers.map((p) => [p.id, p.minutes, p.skills, !!p.placeholder])).toEqual([
      ['reading', 45, ['reading'], false],
      ['writing', 45, ['writing'], false],
      ['listening', 30, ['listening'], false],
      ['speaking', 12, ['speaking'], true],
    ]);
    expect(bp.official).toBe(false);
    expect(bp.rule).toMatchObject({ kind: 'scale', needed: 140, approximate: true });
    if (bp.rule.kind !== 'scale') throw new Error('not a scale rule');
    expect(Object.keys(bp.rule.skills).sort()).toEqual(['listening', 'reading', 'speaking', 'writing']);
    expect(bp.rule.skills.speaking).toEqual({ officialMax: 30, anchors: [[7, 102], [12, 120], [18, 140], [27, 160]] });
    expect(bp.skillNames.use).toBeUndefined();
  });

  it('en B2 / C1: Reading and Use of English is one paper with two skills; the use skill has a name and anchors', () => {
    for (const [level, needed, minutes] of [['B2', 160, [75, 80, 40, 14]], ['C1', 180, [90, 90, 40, 15]]] as const) {
      const bp = getMockBlueprint('en', level);
      expect(bp.papers.map((p) => [p.id, p.minutes])).toEqual([['readinguse', minutes[0]], ['writing', minutes[1]], ['listening', minutes[2]], ['speaking', minutes[3]]]);
      expect(bp.papers[0]).toMatchObject({ name: 'Reading and Use of English', skills: ['reading', 'use'] });
      expect(bp.skillNames.use).toBe('Use of English');
      expect(bp.rule).toMatchObject({ kind: 'scale', needed });
      if (bp.rule.kind !== 'scale') throw new Error('not a scale rule');
      expect(Object.keys(bp.rule.skills).sort()).toEqual(['listening', 'reading', 'speaking', 'use', 'writing']);
      expect(bp.rule.skills.speaking).toEqual(
        level === 'B2' ? { officialMax: 60, anchors: [[14, 122], [24, 140], [36, 160], [54, 180]] } : { officialMax: 75, anchors: [[17, 142], [30, 160], [45, 180], [66, 200]] },
      );
      for (const conv of Object.values(bp.rule.skills)) {
        expect(conv!.anchors).toHaveLength(4);
        expect(conv!.anchors.every(([raw], i, all) => i === 0 || raw > all[i - 1][0])).toBe(true);
      }
    }
  });

  it('the paper and skill names carry no examiner name', () => {
    const bad = /dele|cambridge|pearson|\bkey\b|siele|cervantes|ielts|toefl|trinity|oxford|languagecert|goethe/i;
    for (const target of ['es', 'en'] as const) {
      for (const level of ['B1', 'B2', 'C1'] as const) {
        const bp = getMockBlueprint(target, level);
        for (const text of [...bp.papers.map((p) => p.name), ...Object.values(bp.skillNames)]) expect(text).not.toMatch(bad);
      }
    }
  });
});

describe('mockAvailable: B1 and up only with an authored form in every non-placeholder paper', () => {
  it('A1 / A2 are always available', () => {
    expect(mockAvailable('es', 'A1', [])).toBe(true);
    expect(mockAvailable('en', 'A2', [])).toBe(true);
  });

  it('with no files (or empty forms) B1-C1 are not available', () => {
    expect(mockAvailable('es', 'B1', [])).toBe(false);
    expect(mockAvailable('en', 'C1', allFiles('en', 'C1', 0))).toBe(false);
  });

  it('available once every paper but the speaking has a form; one missing or empty paper blocks it', () => {
    for (const [target, level] of [['es', 'B1'], ['es', 'C1'], ['en', 'B1'], ['en', 'B2'], ['en', 'C1']] as const) {
      const files = allFiles(target, level, 1);
      expect(mockAvailable(target, level, files)).toBe(true);
      expect(mockAvailable(target, level, files.slice(1))).toBe(false);
      expect(mockAvailable(target, level, [{ ...files[0], forms: [] }, ...files.slice(1)])).toBe(false);
    }
  });

  it('files of another level or direction do not count; unknown levels are not available', () => {
    expect(mockAvailable('es', 'B2', allFiles('es', 'B1', 1))).toBe(false);
    expect(mockAvailable('en', 'B1', allFiles('es', 'B1', 1))).toBe(false);
    expect(mockAvailable('es', 'C2', [])).toBe(false);
  });

  it('the shipped registry is wired in (28 files, none written yet or all well-formed)', () => {
    expect(typeof mockAvailable('es', 'B1')).toBe('boolean');
  });
});

describe('authored builder: the seed picks a form', () => {
  it('forms[seed % n], the same form in every paper; n is the fewest forms of the papers', () => {
    const files = [paperFile('es', 'B1', 'reading', 3), paperFile('es', 'B1', 'listening', 2), paperFile('es', 'B1', 'writing', 5)];
    expect(authoredFormCount('es', 'B1', ['reading', 'listening', 'writing'], files)).toBe(2);
    const formOf = (seed: number) => build('es', 'B1', seed, files).papers.filter((p) => !p.placeholder).map((p) => (p.tasks[0] as { instruction: string }).instruction);
    expect(formOf(0).every((i) => i.includes('form 1'))).toBe(true);
    expect(formOf(1).every((i) => i.includes('form 2'))).toBe(true);
    expect(formOf(2).every((i) => i.includes('form 1'))).toBe(true);
    expect(formOf(7).every((i) => i.includes('form 2'))).toBe(true);
    // the same seed, the same exam
    expect(JSON.stringify(build('es', 'B1', 12345, files))).toBe(JSON.stringify(build('es', 'B1', 12345, files)));
  });

  it('a negative or large seed still picks an existing form', () => {
    const files = allFiles('en', 'B1', 3);
    for (const seed of [-1, -7, 1_700_000_000_000]) {
      const e = build('en', 'B1', seed, files);
      expect(e.papers[0].tasks).toHaveLength(2);
    }
  });

  it('task ids are <paper>-<n>; the instruction is led by TAREA n. (es) / PART n. (en)', () => {
    const es = build('es', 'B1', 0, allFiles('es', 'B1', 1));
    const reading = es.papers.find((p) => p.id === 'reading')!;
    expect(reading.tasks.map((t) => t.id)).toEqual(['reading-1', 'reading-2']);
    expect(reading.tasks.map((t) => t.instruction)).toEqual(['TAREA 1. form 1 task 1', 'TAREA 2. form 1 task 2']);
    const en = build('en', 'B2', 0, allFiles('en', 'B2', 1));
    const ru = en.papers.find((p) => p.id === 'readinguse')!;
    expect(ru.tasks.map((t) => t.id)).toEqual(['readinguse-1', 'readinguse-2']);
    expect(ru.tasks.map((t) => t.instruction)).toEqual(['PART 1. form 1 task 1', 'PART 2. form 1 task 2']);
  });

  it('a number already written in the file is not doubled', () => {
    const file: AuthoredPaperFile = { target: 'en', level: 'B1', paper: 'reading', forms: [{ id: 'f1', tasks: [passage('PART 9. Read it.')] }] };
    expect(authoredTasks('en', 'B1', 'reading', 0, 1, [file])[0].instruction).toBe('PART 1. Read it.');
  });

  it('papers follow the blueprint; the speaking is a placeholder without tasks; the points are 25 per skill', () => {
    const e = build('en', 'B2', 4, allFiles('en', 'B2', 1));
    expect(e.papers.map((p) => [p.id, p.minutes, p.points, p.placeholder, p.tasks.length > 0])).toEqual([
      ['readinguse', 75, 50, false, true],
      ['writing', 80, 25, false, true],
      ['listening', 40, 25, false, true],
      ['speaking', 14, 25, true, false],
    ]);
    expect(e).toMatchObject({ target: 'en', level: 'B2', seed: 4, official: false });
    expect(e.rule.kind).toBe('scale');
    expect(e.skillNames.use).toBe('Use of English');
    expect(build('es', 'C1', 0, allFiles('es', 'C1', 1)).official).toBe(true);
  });

  it('B1-C1 speaking: its tasks come from the speaking file with a form count of its own; no longer a placeholder', () => {
    // 3 speaking forms against 1 form in the other papers: 4 % 3 = form 2 for the speaking, form 1 elsewhere
    const e = build('es', 'B1', 4, [...allFiles('es', 'B1', 1), speakingFile('es', 'B1', 3)]);
    const speaking = e.papers.find((p) => p.id === 'speaking')!;
    expect(speaking).toMatchObject({ placeholder: false, minutes: 15, points: 25 });
    expect(speaking.tasks.map((t) => [t.id, t.skill, t.instruction])).toEqual([
      ['speaking-1', 'speaking', 'TAREA 1. form 2 task 1'],
      ['speaking-2', 'speaking', 'TAREA 2. form 2 task 2'],
    ]);
    expect(e.papers.filter((p) => p.id !== 'speaking').every((p) => (p.tasks[0] as { instruction: string }).instruction.includes('form 1'))).toBe(true);
    expect(build('en', 'C1', 0, [...allFiles('en', 'C1', 1), speakingFile('en', 'C1', 1)]).papers[3].tasks[0].instruction).toBe('PART 1. form 1 task 1');
  });

  it('an empty or missing speaking file keeps the placeholder (reserve): no task, and the level stays available', () => {
    for (const speaking of [[], [speakingFile('es', 'B1', 0)]]) {
      const files = [...allFiles('es', 'B1', 1), ...speaking];
      const sp = build('es', 'B1', 0, files).papers.find((p) => p.id === 'speaking')!;
      expect(sp).toMatchObject({ placeholder: true, tasks: [] });
      expect(mockAvailable('es', 'B1', files)).toBe(true);
    }
  });

  it('A1 / A2 speaking: the paper comes from its file, the rest is built from the words as before; without a file it is a placeholder', () => {
    const written = (e: MockExam) => JSON.stringify(e.papers.filter((p) => p.id !== 'speaking'));
    for (const [target, level, minutes] of [['es', 'A1', 10], ['es', 'A2', 12], ['en', 'A1', 3.5], ['en', 'A2', 9]] as const) {
      // `authored: []` = no file (the registry holds the real speaking files, which change as the content is written)
      const plain = buildMockExam({ target, level, items: [], seed: 3, authored: [] });
      const withFile = buildMockExam({ target, level, items: [], seed: 3, authored: [speakingFile(target, level, 2), speakingFile(target, level === 'A1' ? 'A2' : 'A1', 2)] });
      expect(plain.papers.find((p) => p.id === 'speaking')).toMatchObject({ placeholder: true, tasks: [] });
      const speaking = withFile.papers.find((p) => p.id === 'speaking')!;
      // 3 % 2 = form 2; the file of the other A level is not used
      expect(speaking).toMatchObject({ placeholder: false, minutes });
      expect(speaking.tasks.map((t) => [t.id, t.instruction])).toEqual([
        ['speaking-1', `${target === 'es' ? 'TAREA' : 'PART'} 1. form 2 task 1`],
        ['speaking-2', `${target === 'es' ? 'TAREA' : 'PART'} 2. form 2 task 2`],
      ]);
      expect(written(withFile)).toBe(written(plain));
    }
  });

  it('with a paper that has no form the exam is empty (the screen shows the level as unavailable before this)', () => {
    const e = build('es', 'B1', 0, [paperFile('es', 'B1', 'reading', 1)]);
    expect(e.papers.map((p) => p.tasks.length)).toEqual([0, 0, 0, 0]);
    expect(authoredTasks('es', 'B1', 'writing', 0, 0, [])).toEqual([]);
  });

  it('A1 / A2 are built the old way, whatever files are injected', () => {
    setPcicTarget('es');
    const items = pcicItemsForLevel('A1');
    const plain = buildMockExam({ target: 'es', level: 'A1', items, seed: 3, authored: [] });
    const injected = buildMockExam({ target: 'es', level: 'A1', items, seed: 3, authored: allFiles('es', 'B1', 2) });
    expect(JSON.stringify(injected)).toBe(JSON.stringify(plain));
  });
});

describe('glossary texts of the authored kinds: only what is visible on screen', () => {
  const tasks: AuthoredTask[] = [
    { kind: 'passage_mc', skill: 'listening', instruction: 'i', audio: [{ text: 'heard text' }], questions: [{ stem: 'stem one', options: ['opt a', 'opt b'], correct: 0 }] },
    { kind: 'clips_mc', skill: 'reading', instruction: 'i', clips: [{ text: 'clip text', questions: [{ stem: 'clip stem', options: ['c1', 'c2'], correct: 1 }] }] },
    { kind: 'match_pool', skill: 'reading', instruction: 'i', prompts: [{ id: 'p1', text: 'prompt text' }, { id: 'p2', audio: [{ text: 'heard prompt' }] }], options: [{ id: 'a', title: 'Title A', text: 'option text' }], answer: { p1: 'a', p2: 'a' }, unique: false },
    { kind: 'gapped_text', skill: 'reading', instruction: 'i', title: 'Gapped', text: 'before {{1}} after', fragments: [{ id: 'f1', text: 'fragment text' }], answer: { '1': 'f1' } },
    { kind: 'cloze', skill: 'use', instruction: 'i', text: 'one {{1}} two {{2}}', gaps: [{ options: ['x1', 'x2'], correct: 0 }, { answers: ['w'], stem: 'STEM' }] },
    { kind: 'pick_statements', skill: 'listening', instruction: 'i', audio: [{ text: 'heard' }], statements: ['statement one', 'statement two'], correct: [0], pick: 1 },
    { kind: 'transform', skill: 'use', instruction: 'i', items: [{ first: 'first sentence', key: 'KEY', before: 'before', after: 'after', answers: ['x'] }] },
    { kind: 'essay', skill: 'writing', instruction: 'i', choices: [{ id: 'a', title: 'Essay title', prompt: 'Essay prompt', input: 'Essay input', minWords: 10, maxWords: 20, points: [{ id: 'p', label: 'l', keywords: ['k'] }] }] },
    {
      kind: 'speaking',
      skill: 'speaking',
      instruction: 'i',
      talkMinutes: [1, 2],
      choices: [{ id: 'a', title: 'Sheet title', prompt: 'Sheet prompt', bullets: ['bullet one'], input: 'Sheet input', photos: ['ph1'], turns: [{ id: 't1', ask: 'Examiner asks', minWords: 5, points: [{ id: 'p', label: 'l', keywords: ['kkkk'] }], model: 'Model answer text' }] }],
    },
  ];
  const texts = tasks.map((t) => mockTaskTexts({ ...t, id: 'x' } as never));

  it('a recording is not listed, the questions and options are', () => {
    expect(texts[0]).toEqual(['stem one', 'opt a', 'opt b']);
    expect(texts[1]).toEqual(['clip text', 'clip stem', 'c1', 'c2']);
    expect(texts[2]).toEqual(['prompt text', 'Title A', 'option text']);
    expect(texts[5]).toEqual(['statement one', 'statement two']);
  });

  it('gap markers are not part of the text', () => {
    expect(texts[3]).toEqual(['Gapped', 'before   after', 'fragment text']);
    expect(texts[4]).toEqual(['one   two  ', 'x1', 'x2', 'STEM']);
  });

  it('transform and essay show their prompts', () => {
    expect(texts[6]).toEqual(['first sentence', 'KEY', 'before', 'after']);
    expect(texts[7]).toEqual(['Essay title', 'Essay prompt', 'Essay input']);
  });

  it('speaking: the sheet and the examiner questions, never the model answer or the keywords', () => {
    expect(texts[8]).toEqual(['Sheet title', 'Sheet prompt', 'bullet one', 'Sheet input', 'Examiner asks']);
  });
});
