import { answerScrollTarget, dockStepsAside } from '../dockScrollInsets';

describe('answerScrollTarget (E119: picture open + keyboard)', () => {
  it('scrolls a field that sits below the keys up to just above the docked bar', () => {
    // 1080x2400-like: viewport 2200, bar 120 + lift 700 above the bottom, field at y 1500 (height 90)
    expect(answerScrollTarget(1500, 90, 2200, 120, 700)).toBe(1500 + 90 + 12 - (2200 - 120 - 700));
  });

  it('does not scroll a field that already fits above the bar (picture closed keeps today)', () => {
    expect(answerScrollTarget(700, 90, 2200, 120, 700)).toBe(0);
  });
});

describe('dockStepsAside (E119: short screen)', () => {
  it('steps the bar aside when header + keys + bar leave no room for the field (1080x1600 case, dp)', () => {
    expect(dockStepsAside(434, 69, 332)).toBe(true);
  });

  it('keeps the bar when the field fits above it (1080x2400 case, dp)', () => {
    expect(dockStepsAside(790, 69, 332)).toBe(false);
  });

  it('keeps the bar until the scroller has been measured', () => {
    expect(dockStepsAside(0, 69, 332)).toBe(false);
  });
});
