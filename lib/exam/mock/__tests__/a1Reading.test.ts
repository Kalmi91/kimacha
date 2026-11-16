// The authored A1 reading of the Spanish practice exam (FB648-FB651): texts of several sentences with a Spanish comprehension
// question (not a one-sentence translation), and a match of Spanish signs to Spanish meanings (no English options).

import { ES_A1_READING_SIGNS, ES_A1_READING_TEXTS } from '@/data/exams/mock/es-a1-reading-texts';
import { pcicItemsForLevel, setPcicTarget } from '@/data/pcic';
import { buildMockExam } from '../build';
import { buildGlossaryIndex, mockGlossary } from '../glossary';
import { scoreMockTask } from '../score';
import type { MockExam, MockLevel, MockMatchTask, MockReadMcTask } from '../types';

afterAll(() => setPcicTarget('es'));

function es(level: MockLevel, seed: number): MockExam {
  setPcicTarget('es');
  return buildMockExam({ target: 'es', level, items: pcicItemsForLevel(level), seed, authored: [] });
}
const reading = (e: MockExam) => e.papers.find((p) => p.id === 'reading')!.tasks;
const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).filter(Boolean);

describe('authored A1 reading data', () => {
  it('every text has 3+ sentences, a Spanish question, and a correct answer that is not among the wrong ones', () => {
    expect(ES_A1_READING_TEXTS.length).toBeGreaterThanOrEqual(5);
    expect(new Set(ES_A1_READING_TEXTS.map((t) => t.id)).size).toBe(ES_A1_READING_TEXTS.length);
    for (const t of ES_A1_READING_TEXTS) {
      expect(sentences(t.text).length).toBeGreaterThanOrEqual(3);
      expect(t.question.startsWith('¿') && t.question.endsWith('?')).toBe(true);
      expect(new Set([t.correct, ...t.wrong]).size).toBe(3);
      // not a copy of one sentence of the text: the answer has to be worked out
      expect(sentences(t.text)).not.toContain(t.correct);
    }
  });

  it('signs: every id unique, the meaning differs from the sign, neutral content', () => {
    expect(ES_A1_READING_SIGNS.length).toBeGreaterThanOrEqual(7);
    expect(new Set(ES_A1_READING_SIGNS.map((s) => s.id)).size).toBe(ES_A1_READING_SIGNS.length);
    for (const s of ES_A1_READING_SIGNS) expect(s.meaning).not.toBe(s.sign);
    const all = JSON.stringify([ES_A1_READING_TEXTS, ES_A1_READING_SIGNS]);
    expect(all).not.toMatch(/Hungr|Budapest|Magyar|forint/i);
  });
});

describe('es A1 reading paper', () => {
  it.each([1, 2, 3, 7, 12])('seed %i: reading-1 is 3 texts with Spanish questions and answers, reading-2 a Spanish-only match', (seed) => {
    const tasks = reading(es('A1', seed));
    const r1 = tasks[0] as MockReadMcTask;
    expect(r1.id).toBe('reading-1');
    expect(r1.kind).toBe('read_mc');
    expect(r1.passages).toHaveLength(3);
    for (const p of r1.passages) {
      const src = ES_A1_READING_TEXTS.find((t) => t.text === p.text)!;
      expect(src).toBeDefined();
      expect(p.question).toBe(src.question);
      expect(p.options[p.correct]).toBe(src.correct);
      expect([...p.options].sort()).toEqual([src.correct, ...src.wrong].sort());
    }
    const r2 = tasks[1] as MockMatchTask;
    expect(r2.id).toBe('reading-2');
    expect(r2.kind).toBe('match');
    expect(r2.optionsInTarget).toBe(true);
    expect(r2.prompts).toHaveLength(5);
    expect(r2.options).toHaveLength(6);
    for (const pr of r2.prompts) {
      const sign = ES_A1_READING_SIGNS.find((s) => s.sign === pr.text)!;
      expect(r2.options.find((o) => o.id === r2.answer[pr.id])!.text).toBe(sign.meaning);
    }
    for (const o of r2.options) expect(ES_A1_READING_SIGNS.some((s) => s.meaning === o.text)).toBe(true);
  });

  it('the seed changes the picked texts', () => {
    const firsts = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => (reading(es('A1', s))[0] as MockReadMcTask).passages.map((p) => p.text).join('|')));
    expect(firsts.size).toBeGreaterThan(1);
  });

  it('the right answers score full marks, a wrong one is not a point', () => {
    const [r1, r2] = reading(es('A1', 1)) as [MockReadMcTask, MockMatchTask];
    const right1 = Object.fromEntries(r1.passages.map((p, i) => [String(i), p.correct]));
    const res1 = scoreMockTask(r1, right1);
    expect(res1.items.every((i) => i.ok)).toBe(true);
    const wrong1 = Object.fromEntries(r1.passages.map((p, i) => [String(i), (p.correct + 1) % 3]));
    expect(scoreMockTask(r1, wrong1).items.some((i) => i.ok)).toBe(false);
    expect(scoreMockTask(r2, r2.answer).items.every((i) => i.ok)).toBe(true);
  });

  it('A2 keeps the generated reading (no question: the UI asks "what does the text say")', () => {
    const r1 = reading(es('A2', 1))[0] as MockReadMcTask;
    expect(r1.kind).toBe('read_mc');
    expect(r1.passages.every((p) => p.question === undefined)).toBe(true);
    expect((reading(es('A2', 1))[1] as MockMatchTask).optionsInTarget).toBeUndefined();
  });

  it('the glossary covers the question and the answers of the authored texts and the match options', () => {
    setPcicTarget('es');
    const exam = es('A1', 1);
    const index = buildGlossaryIndex(pcicItemsForLevel('A1'), 'es', 'en');
    const [r1, r2] = reading(exam);
    const words = (t: ReturnType<typeof reading>[number]) => mockGlossary(t, index, new Set()).map((g) => g.term);
    expect(words(r1).length).toBeGreaterThan(0);
    expect(words(r2).length).toBeGreaterThan(0);
  });
});
