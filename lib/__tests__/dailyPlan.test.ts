import { dailyPlanPercent } from '@/lib/dailyPlan';

// (szocreal "Napi terv n%"): a mai percek a heti cél napi hetedéhez képest.
describe('dailyPlanPercent', () => {
  it('a heti cél hetede a napi terv: 420 perc / hét = 60 perc / nap', () => {
    expect(dailyPlanPercent(0, 420)).toBe(0);
    expect(dailyPlanPercent(30, 420)).toBe(50);
    expect(dailyPlanPercent(60, 420)).toBe(100);
  });

  it('100% fölé is mehet', () => {
    expect(dailyPlanPercent(90, 420)).toBe(150);
    expect(dailyPlanPercent(120, 420)).toBe(200);
  });

  it('érvénytelen cél vagy negatív perc: 0', () => {
    expect(dailyPlanPercent(10, 0)).toBe(0);
    expect(dailyPlanPercent(-5, 420)).toBe(0);
  });
});
