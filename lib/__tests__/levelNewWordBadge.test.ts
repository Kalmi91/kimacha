import { badgeNewWordsLeft } from '../newWordBudget';

// FB226, Kálmán 2026-09-10: „az új szavak abból a szintből jöjjenek ahol éppen
// állok. Ha nincsen benne új szó akkor jelöljön 0 át."
describe('badgeNewWordsLeft', () => {
  const allowance = { limit: 5, bonus: 0, learnedToday: 0, unlearned: 0 };

  it('shows the daily budget while the level still has unstarted words', () => {
    expect(badgeNewWordsLeft(allowance, 40)).toBe(5);
  });

  it('shows 0 once the level has no unstarted word left', () => {
    expect(badgeNewWordsLeft(allowance, 0)).toBe(0);
  });

  it('never promises more than the level can hand out', () => {
    expect(badgeNewWordsLeft(allowance, 2)).toBe(2);
  });

  it('still stops at the daily budget when the level is full of new words', () => {
    expect(badgeNewWordsLeft({ ...allowance, learnedToday: 4 }, 500)).toBe(1);
  });

  it('treats a negative level count as empty', () => {
    expect(badgeNewWordsLeft(allowance, -3)).toBe(0);
  });
});
