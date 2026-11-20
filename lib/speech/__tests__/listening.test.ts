import { GREETINGS, RATES, clock, isComplete, newRun, parseRate, parseRun, pick, rightOrder, serializeRun } from '@/lib/speech/listening';

describe('listening data', () => {
  it('has pairs of a place and a greeting, and a known shape', () => {
    expect(GREETINGS.pairs.length).toBeGreaterThan(1);
    for (const p of GREETINGS.pairs) {
      expect(p.place).toBeTruthy();
      expect(p.greeting).toBeTruthy();
    }
    expect(GREETINGS.durationSec).toBeGreaterThanOrEqual(0);
  });
});

describe('clock', () => {
  it('m:ss', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(65.9)).toBe('1:05');
    expect(clock(600)).toBe('10:00');
    expect(clock(-3)).toBe('0:00');
    expect(clock(NaN)).toBe('0:00');
  });
});

describe('rightOrder', () => {
  it('is seeded and never leaves every pair aligned', () => {
    for (let n = 2; n <= 14; n++) {
      for (let seed = 1; seed <= 40; seed++) {
        const order = rightOrder(n, seed);
        expect(order).toEqual(rightOrder(n, seed));
        expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
        expect(order.some((p, i) => p !== i)).toBe(true);
      }
    }
  });
  it('one pair stays one pair', () => {
    expect(rightOrder(1, 5)).toEqual([0]);
  });
});

describe('pick', () => {
  it('a right pair is kept, a wrong one counts a mistake', () => {
    const wrong = pick(newRun(1), 0, 1);
    expect(wrong.correct).toBe(false);
    expect(wrong.run).toEqual({ seed: 1, matched: [], mistakes: 1 });
    const right = pick(wrong.run, 2, 2);
    expect(right.correct).toBe(true);
    expect(right.run.matched).toEqual([2]);
    expect(right.run.mistakes).toBe(1);
  });
  it('a matched pair cannot be picked again', () => {
    const run = pick(newRun(1), 0, 0).run;
    const again = pick(run, 0, 0);
    expect(again.correct).toBe(false);
    expect(again.run).toBe(run);
  });
  it('complete when every pair is matched', () => {
    let run = newRun(3);
    expect(isComplete(run, 3)).toBe(false);
    for (let i = 0; i < 3; i++) run = pick(run, i, i).run;
    expect(isComplete(run, 3)).toBe(true);
    expect(isComplete(newRun(1), 0)).toBe(false);
  });
});

describe('saved run', () => {
  it('round-trips', () => {
    const run = { seed: 7, matched: [1, 0], mistakes: 2 };
    expect(parseRun(JSON.parse(JSON.stringify(serializeRun(run))), 4)).toEqual(run);
  });
  it('rejects what does not fit the data', () => {
    expect(parseRun(null, 4)).toBeNull();
    expect(parseRun({ seed: 1, matched: [4], mistakes: 0 }, 4)).toBeNull();
    expect(parseRun({ seed: 1, matched: [1, 1], mistakes: 0 }, 4)).toBeNull();
    expect(parseRun({ seed: 1, matched: [], mistakes: -1 }, 4)).toBeNull();
    expect(parseRun({ seed: 'x', matched: [], mistakes: 0 }, 4)).toBeNull();
  });
});

describe('rate', () => {
  it('only the offered speeds, else 1', () => {
    expect(RATES).toHaveLength(9);
    expect(parseRate(1.3)).toBe(1.3);
    expect(parseRate(2)).toBe(1);
    expect(parseRate('1.2')).toBe(1);
  });
});
