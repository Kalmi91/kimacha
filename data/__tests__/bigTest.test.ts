import type { BigTestItem, BigTestLevel } from '@/lib/grammar/bigTest';

// Data guard for the Spanish Big test pool (data/grammar/big-test/es.json): unique ids, topics that exist in the syllabus
// at the same level, the shape of each kind, the minimum size per level and per topic, and the spread of answer positions.
const data: { lang: string; version: number; items: BigTestItem[] } = require('@/data/grammar/big-test/es.json');
const syllabus: { topics: { id: string; level: string }[] } = require('@/data/grammar/syllabus.json');

const LEVELS: BigTestLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
const at = (level: BigTestLevel) => data.items.filter((it) => it.level === level);
const unique = (xs: string[]) => new Set(xs).size === xs.length;
const syllabusAt = (level: BigTestLevel) => syllabus.topics.filter((tp) => tp.level === level).map((tp) => tp.id);

describe('Big test data (es)', () => {
  it('is the Spanish pool with at least 9 items per level, in level order', () => {
    expect(data.lang).toBe('es');
    expect(data.version).toBe(1);
    for (const level of LEVELS) expect(at(level).length).toBeGreaterThanOrEqual(9);
    expect(data.items.map((it) => it.level)).toEqual(LEVELS.flatMap((l) => Array(at(l).length).fill(l)));
  });

  it('has unique ids of the form es-bt-<level>-NN, numbered in file order per level', () => {
    expect(unique(data.items.map((it) => it.id))).toBe(true);
    for (const level of LEVELS) {
      at(level).forEach((it, i) => expect(it.id).toBe(`es-bt-${level.toLowerCase()}-${String(i + 1).padStart(2, '0')}`));
    }
  });

  it('keeps the first 45 ids (9 per level) of the original set', () => {
    for (const level of LEVELS) {
      const ids = at(level).map((it) => it.id);
      for (let i = 1; i <= 9; i++) expect(ids).toContain(`es-bt-${level.toLowerCase()}-0${i}`);
    }
  });

  it('names a syllabus topic of the same level and a correct index in range', () => {
    const levelOf = new Map(syllabus.topics.map((tp) => [tp.id, tp.level]));
    for (const it of data.items) {
      expect({ id: it.id, level: levelOf.get(it.topic) }).toEqual({ id: it.id, level: it.level });
      const max = it.kind === 'which' ? 1 : 3;
      expect(Number.isInteger(it.correct) && it.correct >= 0 && it.correct <= max).toBe(true);
      expect(typeof it.why === 'string' && it.why.trim().length > 0).toBe(true);
    }
  });

  it('shapes each kind: four distinct options, exactly one blank, one correct index', () => {
    for (const it of data.items) {
      if (it.kind === 'gap') {
        expect(it.lines.length === 1 || it.lines.length === 2).toBe(true);
        expect(it.lines.join('\n').split('___')).toHaveLength(2);
        expect(it.options).toHaveLength(4);
        expect(unique(it.options)).toBe(true);
        expect(it.options.every((o) => o.trim().length > 0)).toBe(true);
      } else if (it.kind === 'which') {
        expect(it.lines).toHaveLength(2);
        expect(it.lines[0]).not.toBe(it.lines[1]);
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

  it('has at least 12 topics per level (all of them where the syllabus has fewer) with at least 4 items each', () => {
    for (const level of LEVELS) {
      const available = syllabusAt(level);
      const used = new Map<string, number>();
      for (const it of at(level)) used.set(it.topic, (used.get(it.topic) ?? 0) + 1);
      expect({ level, topics: used.size >= Math.min(12, available.length) }).toEqual({ level, topics: true });
      for (const [topic, count] of used) expect({ level, topic, enough: count >= 4 }).toEqual({ level, topic, enough: true });
    }
  });

  it('mixes the kinds per level', () => {
    for (const level of ['A1', 'A2', 'B1'] as const) expect(at(level).every((it) => it.kind === 'gap')).toBe(true);
    expect(at('B2').some((it) => it.kind === 'which')).toBe(true);
    expect(at('C1').some((it) => it.kind === 'which')).toBe(true);
    expect(at('C1').some((it) => it.kind === 'register')).toBe(true);
  });

  it('does not stack the right answer on one position among the choice items of a level', () => {
    for (const level of LEVELS) {
      const counts = [0, 0, 0, 0];
      const choice = at(level).filter((it) => it.kind !== 'which');
      for (const it of choice) counts[it.correct]++;
      expect({ level, tooMany: counts.some((c) => c > Math.ceil(choice.length * 0.35)) }).toEqual({ level, tooMany: false });
    }
  });

  it('writes Spanish with the inverted marks and no vosotros forms', () => {
    const texts = data.items.flatMap((it) => ('lines' in it ? it.lines : [])).concat(data.items.flatMap((it) => ('options' in it ? it.options : [])));
    for (const line of texts) {
      if (line.includes('?')) expect({ line, inverted: line.includes('¿') }).toEqual({ line, inverted: true });
      if (line.includes('!')) expect({ line, inverted: line.includes('¡') }).toEqual({ line, inverted: true });
    }
    for (const it of data.items) expect(/\b(vosotros|vuestro|vuestra|habéis|tenéis|vais)\b/i.test(JSON.stringify(it))).toBe(false);
  });
});
