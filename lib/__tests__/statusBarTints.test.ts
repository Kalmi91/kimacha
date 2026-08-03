import { STATUS_BAR_TINTS, nextTintIndex, tintColor } from '../statusBarTints';

describe('statusBarTints', () => {
  it('offers exactly the five blues the user asked for', () => {
    expect(STATUS_BAR_TINTS).toHaveLength(5);
    expect(new Set(STATUS_BAR_TINTS).size).toBe(5);
  });

  it('cycles forward and wraps around', () => {
    expect(nextTintIndex(0)).toBe(1);
    expect(nextTintIndex(3)).toBe(4);
    expect(nextTintIndex(4)).toBe(0);
  });

  it('recovers from an out-of-range stored index', () => {
    expect(nextTintIndex(99)).toBe(1);
    expect(nextTintIndex(-2)).toBe(1);
    expect(tintColor(99)).toBe(STATUS_BAR_TINTS[0]);
  });
});
