import { dailyPlanPercent } from '@/lib/dailyPlan';

// Szocreal "Daily plan n%": today's minutes against the daily seventh of the weekly goal.
describe('dailyPlanPercent', () => {
  it('a seventh of the weekly goal is the daily plan: 420 minutes / week = 60 minutes / day', () => {
    expect(dailyPlanPercent(0, 420)).toBe(0);
    expect(dailyPlanPercent(30, 420)).toBe(50);
    expect(dailyPlanPercent(60, 420)).toBe(100);
  });

  it('can go above 100%', () => {
    expect(dailyPlanPercent(90, 420)).toBe(150);
    expect(dailyPlanPercent(120, 420)).toBe(200);
  });

  it('invalid goal or negative minutes: 0', () => {
    expect(dailyPlanPercent(10, 0)).toBe(0);
    expect(dailyPlanPercent(-5, 420)).toBe(0);
  });
});
