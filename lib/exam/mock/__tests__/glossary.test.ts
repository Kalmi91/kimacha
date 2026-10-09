// a feladat a szint szavaiból áll, az ISMERETLEN
// (még nem tanult) szóhoz szójegyzet jár; a tanult szóhoz nem; a hallás szövege nem látszik,
// ahhoz nincs szójegyzet.

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

describe('mockGlossary: szójegyzet az ismeretlen szóhoz', () => {
  const index = buildGlossaryIndex(ITEMS, 'es');

  it('az ismeretlen szó jelentése a kiinduló nyelven, a megjelenés sorrendjében', () => {
    const g = mockGlossary(match, index, new Set());
    expect(g.map((e) => [e.term, e.meaning])).toEqual([
      ['ventana', 'the window'],
      ['casa', 'the house'],
      ['buenas noches', 'good evening'],
    ]);
  });

  it('a tanult szóhoz nem jár szójegyzet', () => {
    const g = mockGlossary(match, index, new Set(['1', '3']));
    expect(g.map((e) => e.itemId)).toEqual(['2']);
    expect(mockGlossary(match, index, new Set(['1', '2', '3']))).toEqual([]);
  });

  it('ugyanaz a szó egyszer szerepel, a névelőt nem nézi', () => {
    const t: MockTask = { ...match, prompts: [{ id: 'p1', text: 'La casa. La casa. Una casa.' }] } as MockTask;
    expect(mockGlossary(t, index, new Set()).map((e) => e.term)).toEqual(['casa']);
  });

  it('a lyukas mondat lehetőségei is szerepelnek (a kihagyott szó jelentése is)', () => {
    const gap: MockTask = { id: 'g', skill: 'reading', kind: 'gap_mc', instruction: '', gaps: [{ text: 'Quiero ___ agua.', options: ['beber', 'casa', 'zzz'], correct: 0 }] };
    expect(mockGlossary(gap, index, new Set()).map((e) => e.term)).toEqual(['beber', 'casa']);
  });

  it('hallás: a felolvasott szöveg nem látszik, ezért nincs szójegyzet hozzá', () => {
    const listen: MockTask = { id: 'l', skill: 'listening', kind: 'listen_mc', instruction: 'TAREA 1. Va a escuchar.', audio: ['La ventana está abierta.'], questions: [{ options: ['a', 'b'], correct: 0 }] };
    expect(mockTaskTexts(listen)).toEqual([]);
    expect(mockGlossary(listen, index, new Set())).toEqual([]);
  });

  it('az angol irányban a célnyelvi alak az angol szó, a jelentés a spanyol ("to" nélkül)', () => {
    const en = buildGlossaryIndex(ITEMS, 'en');
    const t: MockTask = { ...match, prompts: [{ id: 'p1', text: 'I want to drink water in the house.' }] } as MockTask;
    expect(mockGlossary(t, en, new Set()).map((e) => [e.term, e.meaning])).toEqual([
      ['drink', 'beber'],
      ['house', 'la casa'],
    ]);
  });
});

describe('mockGlossary: valódi feladatsoron', () => {
  it('minden tanulatlan szóhoz jár bejegyzés, tanult szavaknál eltűnik; hallásnál üres', () => {
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

describe('mockGlossary: az új feladat-fajták', () => {
  const index = buildGlossaryIndex(ITEMS, 'es');

  it('begépelős hézag: a lyukas mondat szavaihoz jár szójegyzet, a hiányzó szóhoz nem', () => {
    const gap: MockTask = {
      id: 'gt',
      skill: 'reading',
      kind: 'gap_type',
      instruction: '',
      gaps: [{ text: 'La ___ de la casa está abierta.', answer: 'ventana' }],
    };
    expect(mockGlossary(gap, index, new Set()).map((e) => e.term)).toEqual(['casa']);
  });

  it('hallás utáni hézag és diktálás: a felolvasott szöveg nem látszik; a hézag lyukas mondata igen', () => {
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
