import { shuffleOptions, hashString, shuffleNoFixedPoints } from '../shuffle';

describe('shuffleOptions', () => {
  it('keeps the correct value at the relocated correctIndex', () => {
    const opts = ['A', 'B', 'C', 'D'];
    for (let seed = 0; seed < 50; seed++) {
      const r = shuffleOptions(opts, 0, seed);
      expect(r.options[r.correctIndex]).toBe('A');
      expect(r.options.slice().sort()).toEqual(['A', 'B', 'C', 'D']);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = shuffleOptions(['a', 'b', 'c', 'd'], 2, 12345);
    const b = shuffleOptions(['a', 'b', 'c', 'd'], 2, 12345);
    expect(a).toEqual(b);
  });

  it('does not pin the correct answer to slot 0 (no position bias)', () => {
    const counts = [0, 0, 0, 0];
    for (let seed = 0; seed < 400; seed++) {
      const r = shuffleOptions(['A', 'B', 'C', 'D'], 0, hashString(`q${seed}`));
      counts[r.correctIndex]++;
    }
    // every slot should get a meaningful share (uniform ≈ 100 each)
    counts.forEach((c) => expect(c).toBeGreaterThan(50));
  });

  it('hashString is stable and non-zero for non-empty input', () => {
    expect(hashString('hola')).toBe(hashString('hola'));
    expect(hashString('hola')).not.toBe(hashString('adios'));
  });

  it('shuffleNoFixedPoints never leaves a pair in its own row and is deterministic', () => {
    for (let n = 2; n <= 8; n++) {
      for (let seed = 0; seed < 100; seed++) {
        const o = shuffleNoFixedPoints(n, seed);
        expect(o.slice().sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
        o.forEach((p, i) => expect(p).not.toBe(i));
        expect(shuffleNoFixedPoints(n, seed)).toEqual(o);
      }
    }
    expect(shuffleNoFixedPoints(1, 5)).toEqual([0]);
    expect(shuffleNoFixedPoints(0, 5)).toEqual([]);
  });
});
