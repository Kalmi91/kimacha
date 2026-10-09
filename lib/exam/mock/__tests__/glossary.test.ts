// The task is made of the level's words; an UNKNOWN (not yet learned) word gets a glossary
// entry, a learned word does not; the listening text is not shown, so it has
// no glossary.

import type { PcicItem } from '@/data/pcic';
import { pcicItemsForLevel, setPcicTarget } from '@/data/pcic';
import { buildMockExam } from '../build';
import { buildGlossaryIndex, mockGlossary, mockTaskTexts } from '../glossary';
import type { MockTask } from '../types';

afterAll(() => setPcicTarget('es'));

const item = (id: string, es: string, en: string): PcicItem => ({ id, es, en, kind: 'word', section: '', order: 1 });
const ITEMS = [item('1', 'la ventana', 'the window'), item('2', 'la casa', 'the house'), item('3', 'buenas noches', 'good evening'), item('4', 'beber', 'to drink')];

const match: MockTask = {
  id: 'm',
  skill: 'reading',
  kind: 'match',
  instruction: '',
  prompts: [
    { id: 'p1', text: 'La ventana de la casa está abierta.' },
    { id: 'p2', text: '¡Buenas noches, amigo!' },
  ],
  options: [{ id: 'a', text: 'x' }],
  answer: { p1: 'a' },
};

describe('mockGlossary: glossary for an unknown word', () => {
  const index = buildGlossaryIndex(ITEMS, 'es');

  it('the meaning of the unknown word in the source language, in order of appearance', () => {
    const g = mockGlossary(match, index, new Set());
    expect(g.map((e) => [e.term, e.meaning])).toEqual([
      ['ventana', 'the window'],
      ['casa', 'the house'],
      ['buenas noches', 'good evening'],
    ]);
  });

  it('a learned word gets no glossary entry', () => {
    const g = mockGlossary(match, index, new Set(['1', '3']));
    expect(g.map((e) => e.itemId)).toEqual(['2']);
    expect(mockGlossary(match, index, new Set(['1', '2', '3']))).toEqual([]);
  });

  it('the same word appears once, the article is ignored', () => {
    const t: MockTask = { ...match, prompts: [{ id: 'p1', text: 'La casa. La casa. Una casa.' }] } as MockTask;
    expect(mockGlossary(t, index, new Set()).map((e) => e.term)).toEqual(['casa']);
  });

  it('the options of the gap sentence appear too (the meaning of the omitted word as well)', () => {
    const gap: MockTask = { id: 'g', skill: 'reading', kind: 'gap_mc', instruction: '', gaps: [{ text: 'Quiero ___ agua.', options: ['beber', 'casa', 'zzz'], correct: 0 }] };
    expect(mockGlossary(gap, index, new Set()).map((e) => e.term)).toEqual(['beber', 'casa']);
  });

  it('listening: the read-aloud text is not visible, so there is no glossary for it', () => {
    const listen: MockTask = { id: 'l', skill: 'listening', kind: 'listen_mc', instruction: 'TAREA 1. Va a escuchar.', audio: ['La ventana está abierta.'], questions: [{ options: ['a', 'b'], correct: 0 }] };
    expect(mockTaskTexts(listen)).toEqual([]);
    expect(mockGlossary(listen, index, new Set())).toEqual([]);
  });

  it('in the English direction the target-language form is the English word, the meaning is the Spanish one (without "to")', () => {
    const en = buildGlossaryIndex(ITEMS, 'en');
    const t: MockTask = { ...match, prompts: [{ id: 'p1', text: 'I want to drink water in the house.' }] } as MockTask;
    expect(mockGlossary(t, en, new Set()).map((e) => [e.term, e.meaning])).toEqual([
      ['drink', 'beber'],
      ['house', 'la casa'],
    ]);
  });
});

describe('mockGlossary: on a real task set', () => {
  it('every unlearned word gets an entry, it disappears for learned words; empty for listening', () => {
    setPcicTarget('es');
    const items = pcicItemsForLevel('A1');
    const exam = buildMockExam({ target: 'es', level: 'A1', items, seed: 4 });
    const index = buildGlossaryIndex(items, 'es');
    const reading = exam.papers[0].tasks.find((t) => t.kind === 'match')!;
    const none = mockGlossary(reading, index, new Set());
    expect(none.length).toBeGreaterThan(0);
    const allLearned = new Set(items.map((i) => i.id));
    expect(mockGlossary(reading, index, allLearned)).toEqual([]);
    for (const t of exam.papers[2].tasks) expect(mockGlossary(t, index, new Set())).toEqual([]);
  });
});

describe('mockGlossary: the new task kinds', () => {
  const index = buildGlossaryIndex(ITEMS, 'es');

  it('typed gap: the words of the gap sentence get a glossary, the missing word does not', () => {
    const gap: MockTask = {
      id: 'gt',
      skill: 'reading',
      kind: 'gap_type',
      instruction: '',
      gaps: [{ text: 'La ___ de la casa está abierta.', answer: 'ventana' }],
    };
    expect(mockGlossary(gap, index, new Set()).map((e) => e.term)).toEqual(['casa']);
  });

  it('gap after listening and dictation: the read-aloud text is not visible; the gap sentence is', () => {
    const fill: MockTask = {
      id: 'lf',
      skill: 'listening',
      kind: 'gap_type',
      instruction: '',
      audio: ['La ventana está abierta.'],
      plays: 2,
      gaps: [{ text: 'La ___ está abierta.', answer: 'ventana' }],
    };
    expect(mockGlossary(fill, index, new Set())).toEqual([]);
    const dict: MockTask = { id: 'd', skill: 'listening', kind: 'dictation', instruction: '', audio: ['La casa.'], text: 'La casa.' };
    expect(mockTaskTexts(dict)).toEqual([]);
    expect(mockGlossary(dict, index, new Set())).toEqual([]);
  });
});
