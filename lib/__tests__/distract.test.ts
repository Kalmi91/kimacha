import { pickDistractors } from '../games/distract';
import type { PoolEntry } from '../games/vocabPool';

function entry(learned: string): PoolEntry {
  return { wordId: Math.floor(Math.random() * 1e6), learned, native: learned, level: 'A1', phase: 1, isNew: false };
}

describe('pickDistractors', () => {
  const pool: PoolEntry[] = ['perro', 'pero', 'puerta', 'puerto', 'gato', 'pared'].map(entry);

  it('never includes the target word', () => {
    const out = pickDistractors('perro', pool, { lang: 'es' });
    expect(out).not.toContain('perro');
  });

  it('draws only from the given pool, never outside vocabulary (GAMES.md 0.)', () => {
    const poolWords = new Set(pool.map((p) => p.learned));
    const out = pickDistractors('perro', pool, { lang: 'es', mode: 'random', count: 4 });
    for (const w of out) expect(poolWords.has(w)).toBe(true);
  });

  it('random mode is deterministic for a fixed seed', () => {
    const a = pickDistractors('perro', pool, { lang: 'es', mode: 'random', seed: 42 });
    const b = pickDistractors('perro', pool, { lang: 'es', mode: 'random', seed: 42 });
    expect(a).toEqual(b);
  });

  it('caps output at the requested count', () => {
    const out = pickDistractors('perro', pool, { lang: 'es', count: 2 });
    expect(out.length).toBeLessThanOrEqual(2);
  });
});
