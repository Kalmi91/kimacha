import { pickDayRolloverMessage } from '@/lib/dayRollover';
import en from '@/lib/i18n/en';
import es from '@/lib/i18n/es';

// FB108: the midnight celebration. The pool is picked at random (repeats are
// wanted), and every line has to carry the finished day's numbers.
describe('pickDayRolloverMessage', () => {
  const variants = ['A {min}/{words}', 'B {min}/{words}', 'C {min}/{words}'];

  it('fills in both totals', () => {
    expect(pickDayRolloverMessage(variants, { minutes: 42, words: 17 }, 0)).toBe('A 42/17');
  });

  it('spreads across the pool', () => {
    expect(pickDayRolloverMessage(variants, { minutes: 1, words: 1 }, 0.5)).toBe('B 1/1');
    expect(pickDayRolloverMessage(variants, { minutes: 1, words: 1 }, 0.99)).toBe('C 1/1');
  });

  it('stays inside the pool for out-of-range randoms', () => {
    expect(pickDayRolloverMessage(variants, { minutes: 0, words: 0 }, 1)).toBe('C 0/0');
    expect(pickDayRolloverMessage(variants, { minutes: 0, words: 0 }, -1)).toBe('A 0/0');
  });

  it('is empty with no pool', () => {
    expect(pickDayRolloverMessage([], { minutes: 3, words: 4 }, 0)).toBe('');
  });

  // Kimacha Play: single en-es pair (Kálmán, 2026-09-22); `es` is now just the
  // usage-toast subset (FB63), not a full UI translation.
  it('every shipped line uses both placeholders, in en and es', () => {
    for (const strings of [en, es]) {
      expect(strings.usage.dayRollover.length).toBeGreaterThan(1);
      for (const line of strings.usage.dayRollover) {
        expect(line).toContain('{min}');
        expect(line).toContain('{words}');
      }
    }
  });
});
