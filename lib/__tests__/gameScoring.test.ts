import { comboMultiplier } from '../games/scoring';

// GAMES.md 4.1 (word-rain): "találat = 100 pont × kombó-szorzó (1.0 / 1.25 /
// 1.5 / 2.0, 5 hibátlanonként lép)".
describe('comboMultiplier', () => {
  it('starts at 1.0 and steps by 0.25 every 5 correct, capped at 2.0', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(4)).toBe(1);
    expect(comboMultiplier(5)).toBe(1.25);
    expect(comboMultiplier(9)).toBe(1.25);
    expect(comboMultiplier(10)).toBe(1.5);
    expect(comboMultiplier(15)).toBe(1.75);
    expect(comboMultiplier(20)).toBe(2);
    expect(comboMultiplier(100)).toBe(2); // capped
  });

  it('never goes below 1.0 for a negative streak', () => {
    expect(comboMultiplier(-5)).toBe(1);
  });
});
