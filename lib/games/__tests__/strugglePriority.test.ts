// FB162 follow-up (Kálmán, 2026-08-28): "kerüljön be de ne azokat priorizálja ...
// pont az lenne a lényege a játékoknak hogy amivel aktuálisan szenvedsz azokat
// hozza fel és azokat gyakorold".
import { struggleWeight, weightedShuffle, pickStruggler, type PoolEntry } from '@/lib/games/vocabPool';

const entry = (wordId: number, struggle: number): PoolEntry =>
  ({ wordId, learned: `w${wordId}`, native: `n${wordId}`, level: 'A1', phase: 1, isNew: false, struggle }) as PoolEntry;

describe('struggleWeight', () => {
  it('weighs a missed word above a clean one', () => {
    expect(struggleWeight({ lapses: 3 }, 1, false)).toBeGreaterThan(struggleWeight({ lapses: 0 }, 1, false));
  });

  it('weighs an unfinished ladder above a finished one', () => {
    expect(struggleWeight({ lapses: 0 }, 0, false)).toBeGreaterThan(struggleWeight({ lapses: 0 }, 2, false));
  });

  it('keeps an "I know this" word in the pool, but at the back', () => {
    const known = struggleWeight({ lapses: 0, buried: 1 }, 2, false);
    expect(known).toBeGreaterThan(0);
    expect(known).toBeLessThan(struggleWeight({ lapses: 0 }, 2, false));
  });

  it('treats a never-seen top-up word as filler, below a practised one', () => {
    expect(struggleWeight({}, 0, true)).toBeLessThan(struggleWeight({ lapses: 0 }, 2, false));
  });
});

describe('weightedShuffle', () => {
  it('keeps every item exactly once', () => {
    const items = [entry(1, 5), entry(2, 1), entry(3, 0.25)];
    const out = weightedShuffle(items, (e) => e.struggle ?? 1, 42);
    expect(out.map((e) => e.wordId).sort()).toEqual([1, 2, 3]);
  });

  it('puts the struggling words in front far more often than the known ones', () => {
    let strugglerFirst = 0;
    for (let seed = 0; seed < 200; seed++) {
      const items = [entry(1, 6), entry(2, 0.25), entry(3, 0.25), entry(4, 0.25)];
      const out = weightedShuffle(items, (e) => e.struggle ?? 1, seed);
      if (out[0].wordId === 1) strugglerFirst++;
    }
    expect(strugglerFirst).toBeGreaterThan(120); // ~1/4 by chance alone
  });
});

describe('pickStruggler', () => {
  it('draws weight-proportionally', () => {
    const pool = [entry(1, 9), entry(2, 1)];
    const counts: Record<number, number> = { 1: 0, 2: 0 };
    let t = 0;
    for (let i = 0; i < 1000; i++) {
      const rnd = () => ((t = (t + 0.001) % 1), t);
      counts[pickStruggler(pool, rnd)!.wordId] += 1;
    }
    expect(counts[1]).toBeGreaterThan(counts[2] * 5);
  });

  it('returns null on an empty pool', () => {
    expect(pickStruggler([])).toBeNull();
  });
});
