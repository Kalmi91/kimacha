import type { BigTestItem, BigTestLevel } from '@/lib/grammar/bigTest';

// Data guard for the Spanish Big test (data/grammar/big-test/es.json): 45 items, 9 per level, ids, topics that exist in the
// syllabus at the same level, the shape of each kind, and the spread of topics and answer positions.
const data: { lang: string; version: number; items: BigTestItem[] } = require('@/data/grammar/big-test/es.json');
const syllabus: { topics: { id: string; level: string }[] } = require('@/data/grammar/syllabus.json');

const LEVELS: BigTestLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
const at = (level: BigTestLevel) => data.items.filter((it) => it.level === level);
const unique = (xs: string[]) => new Set(xs).size === xs.length;

describe('Big test data (es)', () => {
  it('has 45 items, 9 per level, in level order', () => {
    expect(data.lang).toBe('es');
    expect(data.version).toBe(1);
    expect(data.items).toHaveLength(45);
    for (const level of LEVELS) expect(at(level)).toHaveLength(9);
    expect(data.items.map((it) => it.level)).toEqual(LEVELS.flatMap((l) => Array(9).fill(l)));
  });

  it('has unique ids of the form es-bt-<level>-NN', () => {
    expect(unique(data.items.map((it) => it.id))).toBe(true);
    for (const level of LEVELS) {
      at(level).forEach((it, i) => expect(it.id).toBe(`es-bt-${level.toLowerCase()}-${String(i + 1).padStart(2, '0')}`));
    }
  });

  it('names a syllabus topic of the same level and a correct index 0..3', () => {
    const levelOf = new Map(syllabus.topics.map((tp) => [tp.id, tp.level]));
    for (const it of data.items) {
      expect({ id: it.id, level: levelOf.get(it.topic) }).toEqual({ id: it.id, level: it.level });
      expect(Number.isInteger(it.correct) && it.correct >= 0 && it.correct <= 3).toBe(true);
      expect(typeof it.why).toBe('string');
    }
  });

  it('shapes each kind', () => {
    for (const it of data.items) {
      if (it.kind === 'gap') {
        expect(it.lines.length === 1 || it.lines.length === 2).toBe(true);
        expect(it.lines.join('\n').split('___')).toHaveLength(2);
        expect(it.options).toHaveLength(4);
        expect(unique(it.options)).toBe(true);
      } else if (it.kind === 'which') {
        expect(it.lines).toHaveLength(2);
        expect('options' in it).toBe(false);
      } else {
        expect(it.kind).toBe('register');
        expect(it.options).toHaveLength(4);
        expect(unique(it.options)).toBe(true);
        expect('lines' in it).toBe(false);
        expect(it.topic).toBe('marcadores-discursivos');
      }
    }
  });

  it('spreads the topics', () => {
    for (const level of ['A1', 'A2', 'B1', 'B2'] as const) expect(new Set(at(level).map((it) => it.topic)).size).toBe(9);
    const c1 = at('C1').map((it) => it.topic);
    expect(new Set(c1).size).toBe(5);
    for (const tp of new Set(c1)) expect(c1.filter((x) => x === tp).length).toBeLessThanOrEqual(2);
  });

  it('mixes the kinds per level', () => {
    for (const level of ['A1', 'A2', 'B1'] as const) expect(at(level).every((it) => it.kind === 'gap')).toBe(true);
    expect(at('B2').some((it) => it.kind === 'which')).toBe(true);
    expect(at('C1').some((it) => it.kind === 'which')).toBe(true);
    expect(at('C1').some((it) => it.kind === 'register')).toBe(true);
  });

  it('does not stack the right answer on one position among the gap items of a level', () => {
    for (const level of LEVELS) {
      const counts = [0, 0, 0, 0];
      for (const it of at(level)) if (it.kind === 'gap') counts[it.correct]++;
      expect({ level, tooMany: counts.some((c) => c > 4) }).toEqual({ level, tooMany: false });
    }
  });
});
