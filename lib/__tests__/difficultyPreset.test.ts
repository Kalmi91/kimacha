// UTEMEZO 8/0: a "Nehézség" tárcsa preset-táblája, FB279 (Kálmán 2026-09-17).
// Tiszta függvények, lásd lib/difficultyPreset.ts a döntés indoklásáért.

import { difficultyPreset, presetValues } from '../difficultyPreset';

describe('difficultyPreset', () => {
  it('matches each of the 5 preset rows', () => {
    expect(difficultyPreset(5, 3)).toBe(1);
    expect(difficultyPreset(10, 4)).toBe(2);
    expect(difficultyPreset(15, 5)).toBe(3);
    expect(difficultyPreset(20, 7)).toBe(4);
    expect(difficultyPreset(30, 10)).toBe(5);
  });

  it('reports "custom" for a pair that matches no preset row', () => {
    expect(difficultyPreset(15, 3)).toBe('custom');
  });
});

describe('presetValues', () => {
  it('returns the daily-new/hand pair for each level', () => {
    expect(presetValues(1)).toEqual({ dailyNew: 5, hand: 3 });
    expect(presetValues(2)).toEqual({ dailyNew: 10, hand: 4 });
    expect(presetValues(3)).toEqual({ dailyNew: 15, hand: 5 });
    expect(presetValues(4)).toEqual({ dailyNew: 20, hand: 7 });
    expect(presetValues(5)).toEqual({ dailyNew: 30, hand: 10 });
  });
});
