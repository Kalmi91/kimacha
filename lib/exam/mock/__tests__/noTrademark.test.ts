// The UI never prints an examiner or exam name (the background research may name them, the UI may not).
// In the English direction the label is "international sample", not "official".
// Checked surface: the i18n `mockExam` block (en and es, including the functions), the names of the papers and skills,
// the authoring instructions and writing tasks. Corpus sentences are not checked (they may contain the word "key").

import { pcicItemsForLevel, setPcicTarget } from '@/data/pcic';
import en from '@/lib/i18n/en';
import es from '@/lib/i18n/es';
import { MOCK_WRITING } from '../author';
import { buildMockExam } from '../build';
import type { MockLevel, MockTarget } from '../types';

afterAll(() => setPcicTarget('es'));

// DELE is a brand only in capitals (the Spanish verb "dele", e.g. "dele las gracias", is a legitimate word).
const TRADEMARK_WORDS = /pearson|peic|cambridge|\bkey\b|siele|cervantes|ielts|toefl|toeic|trinity|oxford|languagecert|\bket\b|goethe/i;
const TRADEMARK_CAPS = /\bDELE\b/;
const clean = (text: string) => !TRADEMARK_WORDS.test(text) && !TRADEMARK_CAPS.test(text);

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (typeof value === 'function') {
    // The label functions are called with sample values (level, numbers, true/false).
    for (const args of [['A1', 3, 4, 5, true, false], ['A2', 60, 30, 50, false, true]]) {
      const text = (value as (...a: unknown[]) => unknown)(...args);
      if (typeof text === 'string') out.push(text);
    }
  } else if (value && typeof value === 'object') for (const v of Object.values(value)) strings(v, out);
  return out;
}

describe('the UI does not print a trademarked exam name', () => {
  it('i18n mockExam (en and es): no trademarked name', () => {
    for (const block of [en.mockExam, es.mockExam]) {
      const all = strings(block);
      expect(all.length).toBeGreaterThan(50);
      for (const text of all) expect(clean(text)).toBe(true);
    }
  });

  it('the text of the papers, skills, instructions and writing tasks is clean on all four exams', () => {
    for (const [target, level] of [['es', 'A1'], ['es', 'A2'], ['en', 'A1'], ['en', 'A2']] as [MockTarget, MockLevel][]) {
      setPcicTarget(target);
      const e = buildMockExam({ target, level, items: pcicItemsForLevel(level), seed: 3 });
      const own: string[] = [...e.papers.map((p) => p.name), ...Object.values(e.skillNames)];
      for (const p of e.papers) {
        for (const t of p.tasks) {
          own.push(t.instruction);
          if (t.kind === 'short_message') own.push(t.prompt, ...t.points.map((x) => x.label));
          if (t.kind === 'form_fill') own.push(t.context, ...t.fields.map((f) => f.label));
        }
      }
      for (const text of own) expect(clean(text)).toBe(true);
    }
    for (const tasks of Object.values(MOCK_WRITING)) {
      for (const t of tasks) expect(clean(JSON.stringify(t))).toBe(true);
    }
  });

  it('in the English direction the label is international sample, the official label belongs only to the Spanish direction', () => {
    expect(en.mockExam.modelNoteIntl('A1')).toBe('Practice exam modelled on an international A1 format');
    expect(en.mockExam.cardBodyIntl).not.toMatch(/official/i);
    expect(es.mockExam.modelNoteIntl('A2')).not.toMatch(/oficial/i);
    expect(es.mockExam.cardBodyIntl).not.toMatch(/oficial/i);
    expect(en.mockExam.modelNote('A1')).toMatch(/official/i);
  });

  it('the approximate pass threshold is flagged in the UI: an estimate, not an official rule', () => {
    expect(en.mockExam.passRuleAverage(50)).toMatch(/estimate/);
    expect(en.mockExam.averageLine(51, 50, true, true)).toMatch(/estimate/);
    expect(es.mockExam.passRuleAverage(50)).toMatch(/estimación/);
    expect(es.mockExam.averageLine(51, 50, true, true)).toMatch(/estimación/);
  });
});
