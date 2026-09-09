import {
  DEFAULT_REQUEUE_LEVEL,
  REQUEUE_GAPS,
  REQUEUE_LEVELS,
  requeueGapFor,
  requeueIndex,
} from '../requeueGap';

describe('requeueGapFor', () => {
  it('grows the gap with the difficulty', () => {
    expect(REQUEUE_GAPS.easy).toBeLessThan(REQUEUE_GAPS.normal);
    expect(REQUEUE_GAPS.normal).toBeLessThan(REQUEUE_GAPS.hard);
  });

  it('falls back to the default for an unknown or missing setting', () => {
    expect(requeueGapFor('nonsense')).toBe(REQUEUE_GAPS[DEFAULT_REQUEUE_LEVEL]);
    expect(requeueGapFor('')).toBe(REQUEUE_GAPS[DEFAULT_REQUEUE_LEVEL]);
  });

  it('resolves every offered level', () => {
    for (const level of REQUEUE_LEVELS) expect(requeueGapFor(level)).toBe(REQUEUE_GAPS[level]);
  });
});

describe('requeueIndex', () => {
  it('puts the missed card the configured number of cards away', () => {
    // 30 kártya marad, a 4. lapnál rontott, 12 lap a távolság → a 16. helyre.
    expect(requeueIndex(30, 4, 12)).toBe(16);
  });

  it('never points past the end of the queue', () => {
    // FB198 lényege: rövid soron a „vége" túl közel volt, itt a vég a plafon.
    expect(requeueIndex(6, 4, 12)).toBe(6);
    expect(requeueIndex(1, 0, 25)).toBe(1);
  });

  it('always leaves at least one card in between', () => {
    expect(requeueIndex(30, 4, 0)).toBe(5);
    expect(requeueIndex(30, 4, -3)).toBe(5);
  });

  it('handles an empty rest queue', () => {
    expect(requeueIndex(0, 0, 12)).toBe(0);
  });
});
