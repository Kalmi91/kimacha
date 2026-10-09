// Gamer: a perc -> XP -> szint számítás.
import { xpFromMinutes, xpLevel } from '@/lib/xp';

describe('xp', () => {
  it('1 perc 10 XP, negatív vagy tört perc nem ad többet', () => {
    expect(xpFromMinutes(3)).toBe(30);
    expect(xpFromMinutes(2.9)).toBe(20);
    expect(xpFromMinutes(-5)).toBe(0);
  });

  it('LVL 1-ről indul, 10 percenként lép szintet, a sáv a szinten belüli haladás', () => {
    expect(xpLevel(0)).toEqual({ level: 1, pct: 0 });
    expect(xpLevel(4)).toEqual({ level: 1, pct: 40 });
    expect(xpLevel(10)).toEqual({ level: 2, pct: 0 });
    expect(xpLevel(25)).toEqual({ level: 3, pct: 50 });
  });
});
