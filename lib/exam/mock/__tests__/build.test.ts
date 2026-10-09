// The practice exam task-set builder on the real level words
// (data/words-open in the es direction, data/words/en in the en direction). The task set is made of the level's
// words; the same seed gives the same exam (part-by-part saving resumes from it).

import { pcicItemsForLevel, setPcicTarget, type PcicItem } from '@/data/pcic';
import { AVERAGE_PASS_PCT, getMockBlueprint, mockAvailable, MOCK_LEVELS, TOTAL_PASS_POINTS } from '../blueprint';
import { buildMockExam, mockExamSignature, sentenceWords, singleWordForm } from '../build';
import { DEFAULT_PLAYS, type MockExam, type MockLevel, type MockTarget, type MockTask } from '../types';
import { mockTaskItemCount } from '../types';

afterAll(() => setPcicTarget('es'));

function exam(target: MockTarget, level: MockLevel, seed = 1) {
  setPcicTarget(target);
  const items = pcicItemsForLevel(level);
  return { items, exam: buildMockExam({ target, level, items, seed }) };
}

const paper = (e: MockExam, id: string) => e.papers.find((p) => p.id === id)!;
const kinds = (tasks: MockTask[]) => tasks.map((t) => t.kind);
const tasksOf = (e: MockExam, skill: string) => e.papers.flatMap((p) => p.tasks).filter((t) => t.skill === skill);
const plays = (t: MockTask) => ('plays' in t && typeof t.plays === 'number' ? t.plays : DEFAULT_PLAYS);

describe('blueprint: exam shape per direction and per level', () => {
  it('es A1 / A2: the official minutes (45/25/25/10 and 60/45/40/12), one paper per skill', () => {
    const a1 = getMockBlueprint('es', 'A1');
    expect(a1.papers.map((p) => [p.id, p.minutes])).toEqual([
      ['reading', 45],
      ['writing', 25],
      ['listening', 25],
      ['speaking', 10],
    ]);
    expect(getMockBlueprint('es', 'A2').papers.map((p) => p.minutes)).toEqual([60, 45, 40, 12]);
    expect(a1.official).toBe(true);
  });

  it('es: two groups, 30 / 50 in each', () => {
    const rule = getMockBlueprint('es', 'A1').rule;
    if (rule.kind !== 'groups') throw new Error('nem csoport-szabály');
    expect(rule.groups.map((x) => [x.skills, x.needed, x.of])).toEqual([
      [['reading', 'writing'], 30, 50],
      [['listening', 'speaking'], 30, 50],
    ]);
  });

  it('en A1: one 75-minute written paper (listening + reading + writing) and the spoken part; total 50 / 100, without a per-part minimum', () => {
    const bp = getMockBlueprint('en', 'A1');
    expect(bp.papers.map((p) => [p.id, p.minutes, p.skills])).toEqual([
      ['written', 75, ['listening', 'reading', 'writing']],
      ['speaking', 3.5, ['speaking']],
    ]);
    expect(bp.rule).toEqual({ kind: 'total', needed: TOTAL_PASS_POINTS, of: 100 });
    expect(TOTAL_PASS_POINTS).toBe(50);
    expect(bp.official).toBe(false);
  });

  it('en A2: Reading + Writing one shared 60-minute paper, Listening 30 minutes, spoken; average rule with an approximate threshold, the old 40/20 and 30/50 are gone', () => {
    const bp = getMockBlueprint('en', 'A2');
    expect(bp.papers.map((p) => [p.id, p.minutes])).toEqual([
      ['readingwriting', 60],
      ['listening', 30],
      ['speaking', 9],
    ]);
    expect(bp.papers[0].skills).toEqual(['reading', 'writing']);
    expect(bp.rule).toEqual({ kind: 'average', passPct: AVERAGE_PASS_PCT, approximate: true });
    expect(bp.papers.map((p) => p.minutes)).not.toContain(40);
    expect(bp.papers.map((p) => p.minutes)).not.toContain(20);
    expect(bp.rule.kind).not.toBe('groups');
    expect(bp.official).toBe(false);
  });

  it('A1 and A2 are available in both directions', () => {
    expect(MOCK_LEVELS.es).toEqual(['A1', 'A2']);
    expect(MOCK_LEVELS.en).toEqual(['A1', 'A2']);
    expect(mockAvailable('en', 'A1')).toBe(true);
    expect(mockAvailable('en', 'B1')).toBe(false);
  });
});

describe('buildMockExam: es A1 (an English speaker learns Spanish)', () => {
  const { items, exam: e } = exam('es', 'A1');

  it('four papers in the official order, the spoken part a placeholder without tasks', () => {
    expect(e.papers.map((p) => p.id)).toEqual(['reading', 'writing', 'listening', 'speaking']);
    expect(paper(e, 'speaking').placeholder).toBe(true);
    expect(paper(e, 'speaking').tasks).toHaveLength(0);
    expect(e.papers.filter((p) => p.id !== 'speaking').every((p) => !p.placeholder && p.tasks.length > 0)).toBe(true);
    expect(e.official).toBe(true);
  });

  it('reading: text comprehension, matching, true/false, gap sentence; listening: three tasks; writing: form + message', () => {
    expect(kinds(paper(e, 'reading').tasks)).toEqual(['read_mc', 'match', 'true_false', 'gap_mc']);
    expect(kinds(paper(e, 'listening').tasks)).toEqual(['listen_mc', 'listen_match', 'listen_dialogue']);
    expect(kinds(paper(e, 'writing').tasks)).toEqual(['form_fill', 'short_message']);
  });

  it('the item count follows the plan (A1: 3 texts, 5 matching, 4 statements, 5 gaps; 5 / 4 / 3 listening)', () => {
    const [read, match, tf, gap] = paper(e, 'reading').tasks.map(mockTaskItemCount);
    expect([read, match, tf, gap]).toEqual([3, 5, 4, 5]);
    expect(paper(e, 'listening').tasks.map(mockTaskItemCount)).toEqual([5, 4, 3]);
  });

  it('every task belongs to the skill of its paper, listening can be played twice', () => {
    for (const p of e.papers) for (const t of p.tasks) expect(t.skill).toBe(p.id);
    for (const t of paper(e, 'listening').tasks) expect(plays(t)).toBe(2);
  });

  it('the same seed gives the same exam, a different seed a different one; the fingerprint follows this', () => {
    const again = exam('es', 'A1', 1).exam;
    const other = exam('es', 'A1', 2).exam;
    expect(again.papers).toEqual(e.papers);
    expect(mockExamSignature(again)).toBe(mockExamSignature(e));
    expect(mockExamSignature(other)).not.toBe(mockExamSignature(e));
  });

  it('the task ids are unique and carry the paper name', () => {
    const ids = e.papers.flatMap((p) => p.tasks.map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(paper(e, 'reading').tasks[0].id).toBe('reading-1');
  });

  it('the instruction is in the target language and numbered (TAREA n.), the writing one too by its place within the paper', () => {
    expect(paper(e, 'reading').tasks.map((t) => t.instruction.slice(0, 9))).toEqual(['TAREA 1. ', 'TAREA 2. ', 'TAREA 3. ', 'TAREA 4. ']);
    expect(paper(e, 'writing').tasks.map((t) => t.instruction.slice(0, 9))).toEqual(['TAREA 1. ', 'TAREA 2. ']);
  });

  it('every read sentence is an example sentence of an item of the level (no hand-written text)', () => {
    const sentences = new Set(items.map((i) => i.exampleEs?.trim()));
    for (const task of paper(e, 'reading').tasks) {
      if (task.kind === 'match') for (const p of task.prompts) expect(sentences.has(p.text)).toBe(true);
      if (task.kind === 'read_mc') {
        for (const p of task.passages) {
          const whole = [...sentences].filter((s) => s && p.text.includes(s));
          expect(whole.length).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it('in matching the right answer of every prompt is its own translation, one meaning is more than the prompts', () => {
    for (const task of [...paper(e, 'reading').tasks, ...paper(e, 'listening').tasks]) {
      if (task.kind !== 'match' && task.kind !== 'listen_match') continue;
      expect(task.options.length).toBe(task.prompts.length + 1);
      const sources = new Set(items.map((i) => i.exampleEn?.trim()));
      for (const p of task.prompts) expect(sources.has(task.options.find((o) => o.id === task.answer[p.id])!.text)).toBe(true);
      expect(new Set(Object.values(task.answer)).size).toBe(task.prompts.length);
      expect(new Set(task.options.map((o) => o.text)).size).toBe(task.options.length);
      if (task.kind === 'listen_match') expect(task.audio).toHaveLength(task.prompts.length);
    }
  });

  it('in a gap sentence the right answer is the omitted word (one word, 3 different options)', () => {
    const gap = paper(e, 'reading').tasks.find((t) => t.kind === 'gap_mc');
    if (gap?.kind !== 'gap_mc') throw new Error('nincs gap');
    for (const g of gap.gaps) {
      expect(g.text.split('___')).toHaveLength(2);
      expect(g.options).toHaveLength(3);
      expect(new Set(g.options).size).toBe(3);
      const filled = g.text.replace('___', g.options[g.correct]);
      expect(items.some((i) => i.exampleEs && sentenceWords(i.exampleEs).join(' ').toLowerCase() === sentenceWords(filled).join(' ').toLowerCase())).toBe(true);
    }
  });

  it('in a true/false text there are exactly as many true statements as the plan says', () => {
    const tf = paper(e, 'reading').tasks.find((t) => t.kind === 'true_false');
    if (tf?.kind !== 'true_false') throw new Error('nincs true_false');
    expect(tf.statements.filter((s) => s.answer)).toHaveLength(2);
    expect(tf.statements.filter((s) => !s.answer)).toHaveLength(2);
  });

  it('the listening questions: one question per row, 3 different answers, the right one is the translation of the heard sentence', () => {
    const lm = paper(e, 'listening').tasks[0];
    if (lm.kind !== 'listen_mc') throw new Error('nincs listen_mc');
    expect(lm.questions).toHaveLength(lm.audio.length);
    const byTarget = new Map(items.map((i) => [i.exampleEs?.trim(), i.exampleEn?.trim()]));
    lm.questions.forEach((q, i) => {
      expect(q.options).toHaveLength(3);
      expect(new Set(q.options).size).toBe(3);
      expect(q.options[q.correct]).toBe(byTarget.get(lm.audio[i]));
    });
  });

  it('a sentence is the host in only one place within a task set (no repeated listening/reading sentence)', () => {
    const heard = paper(e, 'listening').tasks.flatMap((t) => ('audio' in t && t.audio ? t.audio : []));
    expect(new Set(heard).size).toBe(heard.length);
  });
});

describe('buildMockExam: es A2', () => {
  const { exam: e } = exam('es', 'A2');

  it('the official A2 minutes and a larger item count', () => {
    expect(e.papers.map((p) => p.minutes)).toEqual([60, 45, 40, 12]);
    expect(paper(e, 'reading').tasks.map(mockTaskItemCount)).toEqual([4, 6, 5, 6]);
    expect(paper(e, 'listening').tasks.map(mockTaskItemCount)).toEqual([6, 5, 4]);
    expect(kinds(paper(e, 'writing').tasks)).toEqual(['short_message', 'short_message']);
  });
});

describe('buildMockExam: es→en A1 (a Spanish speaker learns English, international A1 sample)', () => {
  const { items, exam: e } = exam('en', 'A1');
  const written = paper(e, 'written');

  it('one written paper (75 minutes) and the spoken placeholder; unofficial structure', () => {
    expect(e.papers.map((p) => [p.id, p.minutes, p.placeholder])).toEqual([
      ['written', 75, false],
      ['speaking', 3.5, true],
    ]);
    expect(written.points).toBe(75);
    expect(e.official).toBe(false);
    expect(e.rule.kind).toBe('total');
  });

  it('task order: listening (short announcements, dictation, gap with recording), reading (gap, text, typed gap), writing (two messages)', () => {
    expect(kinds(written.tasks)).toEqual(['listen_mc', 'dictation', 'gap_type', 'gap_mc', 'read_mc', 'gap_type', 'short_message', 'short_message']);
    expect(written.tasks.map((t) => t.skill)).toEqual(['listening', 'listening', 'listening', 'reading', 'reading', 'reading', 'writing', 'writing']);
  });

  it('listening replay per section: the first part once, the dictation and the gap twice', () => {
    const [first, dict, fill] = written.tasks;
    expect(plays(first)).toBe(1);
    expect(plays(dict)).toBe(2);
    expect(plays(fill)).toBe(2);
    expect(first.instruction).toContain('once');
    expect(dict.instruction).toContain('twice');
  });

  it('the task numbering is continuous within the paper (PART 1..8)', () => {
    expect(written.tasks.map((t) => t.instruction.match(/^PART (\d+)\./)![1])).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
  });

  it('the dictation is two learned level sentences, the text is the sequence of the read-aloud lines; every word counts toward listening and writing', () => {
    const dict = written.tasks[1];
    if (dict.kind !== 'dictation') throw new Error('nincs dictation');
    const sentences = new Set(items.map((i) => i.exampleEn?.trim()));
    expect(dict.audio).toHaveLength(2);
    for (const line of dict.audio) expect(sentences.has(line)).toBe(true);
    expect(dict.text).toBe(dict.audio.join(' '));
    expect(mockTaskItemCount(dict)).toBe(sentenceWords(dict.text).length * 2);
  });

  it('the answer of the typed gap is the word in the sentence; the sentences of the gap with recording are spoken, the gap text is on screen', () => {
    const fill = written.tasks[2];
    if (fill.kind !== 'gap_type' || !fill.audio) throw new Error('nincs listen fill');
    expect(fill.audio).toHaveLength(fill.gaps.length);
    fill.gaps.forEach((g, i) => {
      expect(g.text).toContain('___');
      expect(fill.audio![i].toLowerCase()).toContain(g.answer);
      expect(g.text.replace('___', g.answer).toLowerCase()).toBe(fill.audio![i].toLowerCase());
    });
    const open = written.tasks[5];
    if (open.kind !== 'gap_type') throw new Error('nincs gap_type');
    expect(open.audio).toBeUndefined();
    expect(open.gaps.length).toBeGreaterThanOrEqual(2);
  });

  it('it is built from the English items of the level, and a sentence appears in only one place', () => {
    const sentences = new Set(items.map((i) => i.exampleEn?.trim()));
    const heard = written.tasks.flatMap((t) => ('audio' in t && t.audio ? t.audio : []));
    for (const line of heard) expect(sentences.has(line)).toBe(true);
    expect(new Set(heard).size).toBe(heard.length);
    const msg = written.tasks.filter((t) => t.kind === 'short_message');
    expect(msg.map((t) => (t.kind === 'short_message' ? t.minWords : 0))).toEqual([24, 30]);
  });
});

describe('buildMockExam: es→en A2 (a Spanish speaker learns English, international A2 sample)', () => {
  const { items, exam: e } = exam('en', 'A2');
  const rw = paper(e, 'readingwriting');
  const listening = paper(e, 'listening');

  it('Reading + Writing one 60-minute paper, Listening 30 minutes, the spoken placeholder; unofficial structure', () => {
    expect(e.papers.map((p) => [p.id, p.name, p.minutes, p.placeholder])).toEqual([
      ['readingwriting', 'Reading and Writing', 60, false],
      ['listening', 'Listening', 30, false],
      ['speaking', 'Speaking', 9, true],
    ]);
    expect(rw.points).toBe(50);
    expect(e.official).toBe(false);
    expect(e.rule).toEqual({ kind: 'average', passPct: AVERAGE_PASS_PCT, approximate: true });
  });

  it('the shared paper: reading (five parts), then writing (two parts, 25 and 35 words), PART n. with continuous numbering', () => {
    expect(kinds(rw.tasks)).toEqual(['read_mc', 'match', 'true_false', 'gap_mc', 'gap_type', 'short_message', 'short_message']);
    expect(rw.tasks.map((t) => t.skill)).toEqual(['reading', 'reading', 'reading', 'reading', 'reading', 'writing', 'writing']);
    expect(rw.tasks.map((t) => t.instruction.match(/^PART (\d+)\./)![1])).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    const min = rw.tasks.filter((t) => t.kind === 'short_message').map((t) => (t.kind === 'short_message' ? t.minWords : 0));
    expect(min).toEqual([25, 35]);
  });

  it('every listening text can be heard twice, and the sentences of the gap part are spoken', () => {
    expect(kinds(listening.tasks)).toEqual(['listen_mc', 'gap_type', 'listen_dialogue', 'listen_match']);
    for (const t of listening.tasks) expect(plays(t)).toBe(2);
    const fill = listening.tasks[1];
    if (fill.kind !== 'gap_type') throw new Error('nincs gap_type');
    expect(fill.audio).toHaveLength(fill.gaps.length);
    for (const t of listening.tasks) expect(t.skill).toBe('listening');
  });

  it('the task is built from the English level words (target-language sentence = exampleEn)', () => {
    const sentences = new Set(items.map((i) => i.exampleEn?.trim()));
    const match = rw.tasks.find((t) => t.kind === 'match');
    if (match?.kind !== 'match') throw new Error('nincs match');
    for (const p of match.prompts) expect(sentences.has(p.text)).toBe(true);
    const heard = listening.tasks.flatMap((t) => ('audio' in t && t.audio ? t.audio : []));
    for (const line of heard) expect(sentences.has(line)).toBe(true);
  });

  it('there is scorable content per skill (reading, writing, listening), none for spoken', () => {
    expect(tasksOf(e, 'reading').length).toBe(5);
    expect(tasksOf(e, 'writing').length).toBe(2);
    expect(tasksOf(e, 'listening').length).toBe(4);
    expect(tasksOf(e, 'speaking').length).toBe(0);
  });
});

describe('helpers', () => {
  it('singleWordForm: without article and parentheses, only a single-word form', () => {
    const it = (es: string, en = ''): PcicItem => ({ id: 'x', es, en, kind: 'word', section: '', order: 1 });
    expect(singleWordForm(it('la ventana'), 'es')).toBe('ventana');
    expect(singleWordForm(it('el carro (MX) / el coche'), 'es')).toBe('carro');
    expect(singleWordForm(it('buenas noches'), 'es')).toBeNull();
    expect(singleWordForm(it('x', 'to eat'), 'en')).toBe('eat');
    expect(singleWordForm(it('yo'), 'es')).toBeNull();
  });
});
