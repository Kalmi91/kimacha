import { isDailyMilestone, isLongHaulMilestone, pickMilestoneLine } from '@/lib/usageMilestones';
import hu from '@/lib/i18n/hu';
import en from '@/lib/i18n/en';
import es from '@/lib/i18n/es';
import de from '@/lib/i18n/de';

// FB149, Kálmán 2026-08-20: "1 óra után 15 percenként gratuláljon az app és.
// indig más szöveggel."
describe('daily usage milestones', () => {
  it('keeps the FB63 crossings at 30 and 60', () => {
    expect(isDailyMilestone(30)).toBe(true);
    expect(isDailyMilestone(60)).toBe(true);
    expect(isDailyMilestone(45)).toBe(false);
  });

  it('celebrates every quarter hour past the first hour', () => {
    expect(isDailyMilestone(75)).toBe(true);
    expect(isDailyMilestone(90)).toBe(true);
    expect(isDailyMilestone(180)).toBe(true);
    expect(isDailyMilestone(76)).toBe(false);
    expect(isDailyMilestone(89)).toBe(false);
  });

  it('treats the hour itself as a normal milestone, not a long-haul one', () => {
    expect(isLongHaulMilestone(60)).toBe(false);
    expect(isLongHaulMilestone(75)).toBe(true);
  });
});

describe('long-haul milestone lines', () => {
  const pools = { hu: hu.usage.milestoneLong, en: en.usage.milestoneLong, es: es.usage.milestoneLong, de: de.usage.milestoneLong };

  it('every language has a pool, and no line is left with a placeholder', () => {
    for (const [lang, pool] of Object.entries(pools)) {
      expect(pool.length).toBeGreaterThanOrEqual(6);
      for (let i = 0; i < pool.length; i++) {
        const line = pickMilestoneLine(pool, 90, i / pool.length);
        expect(line).not.toContain('{min}');
        expect(line).not.toContain('{hours}');
        expect(line.length).toBeGreaterThan(0);
        expect(`${lang}:${line}`).toBeTruthy();
      }
    }
  });

  it('writes whole hours plainly and quarters as a decimal', () => {
    expect(pickMilestoneLine(['{hours}'], 120, 0)).toBe('2');
    expect(pickMilestoneLine(['{hours}'], 90, 0)).toBe('1.5');
    expect(pickMilestoneLine(['{hours}'], 75, 0)).toBe('1.25');
    expect(pickMilestoneLine(['{min}'], 75, 0)).toBe('75');
  });

  it('picks across the whole pool and survives the random edges', () => {
    const pool = ['a', 'b', 'c'];
    expect(pickMilestoneLine(pool, 75, 0)).toBe('a');
    expect(pickMilestoneLine(pool, 75, 0.999999)).toBe('c');
    expect(pickMilestoneLine(pool, 75, 1)).toBe('c');
    expect(pickMilestoneLine([], 75, 0)).toBe('');
  });
});
