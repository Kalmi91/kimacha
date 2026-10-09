// Gamer: a perc -> XP -> szint számítás.
import { xpFromMinutes, xpLevel } from '@/lib/xp';

describe('xp', () => {
  it('1 minute 10 XP, negative or fractional minutes do not give more', () => {
    expect(xpFromMinutes(3)).toBe(30);
    expect(xpFromMinutes(2.9)).toBe(20);
    expect(xpFromMinutes(-5)).toBe(0);
  });

  it('starts at LVL 1, levels up every 10 minutes, the bar is progress within the level', () => {
    expect(xpLevel(0)).toEqual({ level: 1, pct: 0 });
    expect(xpLevel(4)).toEqual({ level: 1, pct: 40 });
    expect(xpLevel(10)).toEqual({ level: 2, pct: 0 });
    expect(xpLevel(25)).toEqual({ level: 3, pct: 50 });
  });
});
