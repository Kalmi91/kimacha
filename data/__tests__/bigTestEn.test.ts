import type { BigTestItem, BigTestLevel } from '@/lib/grammar/bigTest';

// Data guard for the English Big test pool (data/grammar/big-test/en.json): unique ids, topics that exist in the English
// grammar syllabus at the same level, the shape of each kind, the size per level and per topic, and the spread of answer positions.
const data: { lang: string; version: number; items: BigTestItem[] } = require('@/data/grammar/big-test/en.json');
const TOPIC_FILES: Record<BigTestLevel, unknown[]> = {
  A1: [require('@/data/topics/en/a0.json'), require('@/data/topics/en/a1.json')],
  A2: [require('@/data/topics/en/a2.json')],
  B1: [require('@/data/topics/en/b1.json')],
  B2: [require('@/data/topics/en/b2.json')],
  C1: [require('@/data/topics/en/c1.json')],
};

const LEVELS: BigTestLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
const SIZE: Record<BigTestLevel, number> = { A1: 48, A2: 48, B1: 48, B2: 44, C1: 20 };
const at = (level: BigTestLevel) => data.items.filter((it) => it.level === level);
const unique = (xs: string[]) => new Set(xs).size === xs.length;
const grammarAt = (level: BigTestLevel): string[] =>
  (TOPIC_FILES[level] as { id: string; type: string }[][]).flat().filter((tp) => tp.type === 'grammar').map((tp) => tp.id);

describe('Big test data (en)', () => {
  it('is the English pool with the planned size per level, in level order', () => {
    expect(data.lang).toBe('en');
    expect(data.version).toBe(1);
    for (const level of LEVELS) expect({ level, n: at(level).length }).toEqual({ level, n: SIZE[level] });
    expect(data.items.map((it) => it.level)).toEqual(LEVELS.flatMap((l) => Array(at(l).length).fill(l)));
  });

  it('has unique ids of the form en-bt-<level>-NN, numbered in file order per level', () => {
    expect(unique(data.items.map((it) => it.id))).toBe(true);
    for (const level of LEVELS) {
      at(level).forEach((it, i) => expect(it.id).toBe(`en-bt-${level.toLowerCase()}-${String(i + 1).padStart(2, '0')}`));
    }
  });

  it('names an English grammar topic of the same level and a correct index in range', () => {
    for (const it of data.items) {
      expect({ id: it.id, known: grammarAt(it.level).includes(it.topic) }).toEqual({ id: it.id, known: true });
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
        expect(it.topic).toBe('discourse_markers');
      }
    }
  });

  it('has 4 items per topic (6 at A2, which has only 8 topics) and covers every A2 topic', () => {
    for (const level of LEVELS) {
      const used = new Map<string, number>();
      for (const it of at(level)) used.set(it.topic, (used.get(it.topic) ?? 0) + 1);
      for (const [topic, count] of used) expect({ level, topic, count }).toEqual({ level, topic, count: level === 'A2' ? 6 : 4 });
    }
    expect(new Set(at('A2').map((it) => it.topic))).toEqual(new Set(grammarAt('A2')));
  });

  it('mixes the kinds per level', () => {
    for (const level of ['A1', 'A2', 'B1'] as const) expect(at(level).every((it) => it.kind === 'gap')).toBe(true);
    expect(at('B2').filter((it) => it.kind === 'which')).toHaveLength(6);
    expect(at('C1').filter((it) => it.kind === 'which')).toHaveLength(4);
    expect(at('C1').filter((it) => it.kind === 'register')).toHaveLength(4);
  });

  it('does not stack the right answer on one position among the choice items of a level', () => {
    for (const level of LEVELS) {
      const counts = [0, 0, 0, 0];
      const choice = at(level).filter((it) => it.kind !== 'which');
      for (const it of choice) counts[it.correct]++;
      expect({ level, tooMany: counts.some((c) => c > Math.ceil(choice.length * 0.35)) }).toEqual({ level, tooMany: false });
    }
  });
});
