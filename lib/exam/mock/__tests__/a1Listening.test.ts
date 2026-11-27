// The authored A1 listening of the Spanish practice exam (FB487): ONE coherent text per task with Spanish questions that follow it,
// not unrelated sentences with a translation each.

import { ES_A1_LISTENING_DIALOGUES, ES_A1_LISTENING_TEXTS, type A1ListeningText } from '@/data/exams/mock/es-a1-listening-texts';
import { pcicItemsForLevel, setPcicTarget } from '@/data/pcic';
import { buildMockExam } from '../build';
import { getMockBlueprint } from '../blueprint';
import { scoreMockTask } from '../score';
import type { MockExam, MockLevel, MockListenTask, MockTarget } from '../types';

afterAll(() => setPcicTarget('es'));

function build(target: MockTarget, level: MockLevel, seed: number): MockExam {
  setPcicTarget(target);
  return buildMockExam({ target, level, items: pcicItemsForLevel(level), seed, authored: [] });
}
const listening = (e: MockExam) => e.papers.find((p) => p.id === 'listening' || p.id === 'written')!.tasks;
const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).filter(Boolean);
const COUNTS = getMockBlueprint('es', 'A1').counts;
const ALL: A1ListeningText[] = [...ES_A1_LISTENING_TEXTS, ...ES_A1_LISTENING_DIALOGUES];

describe.each([
  ['monologues', ES_A1_LISTENING_TEXTS, COUNTS.listenMc],
  ['dialogues', ES_A1_LISTENING_DIALOGUES, COUNTS.listenDialogue],
] as const)('authored A1 listening data: %s', (_name, texts, need) => {
  it('4 texts, enough lines and questions for the blueprint, every line index valid, questions in text order', () => {
    expect(texts.length).toBeGreaterThanOrEqual(4);
    for (const t of texts) {
      expect(t.lines.length).toBeGreaterThanOrEqual(need);
      expect(t.questions.length).toBeGreaterThanOrEqual(need);
      for (const q of t.questions) {
        expect(Number.isInteger(q.line)).toBe(true);
        expect(q.line).toBeGreaterThanOrEqual(0);
        expect(q.line).toBeLessThan(t.lines.length);
      }
      const order = t.questions.map((q) => q.line);
      expect(order).toEqual([...order].sort((a, b) => a - b));
    }
  });
});

describe('authored A1 listening data: all texts', () => {
  it('unique ids', () => {
    expect(new Set(ALL.map((t) => t.id)).size).toBe(ALL.length);
  });

  it('the correct answer differs from both wrong ones, and the wrong ones from each other', () => {
    for (const t of ALL) for (const q of t.questions) expect(new Set([q.correct, ...q.wrong]).size).toBe(3);
  });

  it('every sentence with ? has ¿ and with ! has ¡; no em dash', () => {
    const strings = ALL.flatMap((t) => [...t.lines, ...t.questions.flatMap((q) => [q.question, q.correct, ...q.wrong])]);
    for (const s of strings) {
      for (const part of sentences(s)) {
        if (part.includes('?')) expect(part).toContain('¿');
        if (part.includes('!')) expect(part).toContain('¡');
      }
      expect(s).not.toContain(String.fromCodePoint(0x2014));
    }
  });

  // A wrong option is made only of words that are heard in that text (plus these few function words), so it cannot be ruled out
  // because its words never occur; no nouns, numbers or names here.
  const FUNCTION_WORDS = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'a', 'al', 'en', 'y', 'no', 'con', 'por', 'para']);
  const wordsOf = (s: string) => s.toLowerCase().replace(/[¿?¡!.,;:]/g, ' ').split(/\s+/).filter(Boolean);

  it('every word of every wrong option is heard in the text (or is a listed function word)', () => {
    const missing: string[] = [];
    for (const t of ALL) {
      const heard = new Set(t.lines.flatMap(wordsOf));
      for (const q of t.questions) for (const w of q.wrong) for (const word of wordsOf(w)) if (!heard.has(word) && !FUNCTION_WORDS.has(word)) missing.push(`${t.id}: "${w}" -> ${word}`);
    }
    expect(missing).toEqual([]);
  });

  it('the right answer is not simply a heard line', () => {
    for (const t of ALL) for (const q of t.questions) expect(t.lines).not.toContain(q.correct);
  });
});

describe('es A1 listening paper', () => {
  it.each([1, 2, 3, 7, 12])('seed %i: listen_mc and listen_dialogue are ONE authored text each, with prompts and lineOf', (seed) => {
    const tasks = listening(build('es', 'A1', seed));
    const lm = tasks[0] as MockListenTask;
    const ld = tasks[2] as MockListenTask;
    expect(lm.id).toBe('listening-1');
    expect(lm.kind).toBe('listen_mc');
    expect(ld.id).toBe('listening-3');
    expect(ld.kind).toBe('listen_dialogue');
    for (const [task, texts, n] of [
      [lm, ES_A1_LISTENING_TEXTS, COUNTS.listenMc],
      [ld, ES_A1_LISTENING_DIALOGUES, COUNTS.listenDialogue],
    ] as const) {
      const src = texts.find((t) => JSON.stringify(t.lines) === JSON.stringify(task.audio));
      expect(src).toBeDefined();
      expect(task.questions).toHaveLength(n);
      expect(task.prompts).toHaveLength(task.questions.length);
      expect(task.lineOf).toHaveLength(task.questions.length);
      task.questions.forEach((q, i) => {
        const a = src!.questions[i];
        expect(task.prompts![i]).toBe(a.question);
        expect(task.lineOf![i]).toBe(a.line);
        expect(q.options[q.correct]).toBe(a.correct);
        expect([...q.options].sort()).toEqual([a.correct, ...a.wrong].sort());
      });
    }
    expect(lm.instruction).toBe('TAREA 1. Va a escuchar un texto corto. Se escucha dos veces. Conteste a las preguntas.');
    expect(ld.instruction).toContain('Va a escuchar una conversación.');
  });

  it('the seed changes the picked texts', () => {
    const firsts = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => (listening(build('es', 'A1', s))[0] as MockListenTask).audio.join('|')));
    expect(firsts.size).toBeGreaterThan(1);
  });

  it('listen_match is still generated (no prompts)', () => {
    const lx = listening(build('es', 'A1', 1))[1];
    expect(lx.kind).toBe('listen_match');
  });

  it('the maximum points do not change: the question count is the blueprint count', () => {
    const tasks = listening(build('es', 'A1', 4)) as MockListenTask[];
    expect(tasks[0].questions.length + tasks[2].questions.length).toBe(COUNTS.listenMc + COUNTS.listenDialogue);
  });
});

describe('other levels and plans keep the generated listening', () => {
  it('es A2: no prompts, no lineOf, one question per line', () => {
    for (const task of listening(build('es', 'A2', 1))) {
      if (task.kind !== 'listen_mc' && task.kind !== 'listen_dialogue') continue;
      expect(task.prompts).toBeUndefined();
      expect(task.lineOf).toBeUndefined();
      expect(task.questions).toHaveLength(task.audio.length);
    }
  });

  it('en A1: no prompts, no lineOf', () => {
    const tasks = listening(build('en', 'A1', 1));
    const lm = tasks.find((t) => t.kind === 'listen_mc') as MockListenTask;
    expect(lm).toBeDefined();
    expect(lm.prompts).toBeUndefined();
    expect(lm.lineOf).toBeUndefined();
  });
});

describe('score / review of an authored listen task', () => {
  it('the review line of a question is the line lineOf points to', () => {
    const lm = listening(build('es', 'A1', 1))[0] as MockListenTask;
    const res = scoreMockTask(lm, {});
    lm.lineOf!.forEach((line, i) => expect(res.items[i].label).toBe(lm.audio[line]));
  });

  it('a task without lineOf keeps pairing question i with line i', () => {
    const task: MockListenTask = {
      id: 'x',
      skill: 'listening',
      kind: 'listen_mc',
      instruction: '',
      audio: ['uno', 'dos'],
      questions: [
        { options: ['a', 'b'], correct: 0 },
        { options: ['a', 'b'], correct: 0 },
      ],
    };
    expect(scoreMockTask(task, {}).items.map((i) => i.label)).toEqual(['uno', 'dos']);
  });

  it('right answers score full marks', () => {
    const lm = listening(build('es', 'A1', 2))[0] as MockListenTask;
    const right = Object.fromEntries(lm.questions.map((q, i) => [String(i), q.correct]));
    expect(scoreMockTask(lm, right).items.every((i) => i.ok)).toBe(true);
  });
});
