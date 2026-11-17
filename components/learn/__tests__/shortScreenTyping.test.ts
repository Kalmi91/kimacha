import { answerScrollTarget, compactTypingNeeded, dockStepsAside } from '../dockScrollInsets';

describe('short-screen typing geometry', () => {
  it('compacts the 1080x1600 layout while the keys cover the lower screen', () => {
    expect(compactTypingNeeded(609, 308, 332)).toBe(true);
  });

  it('keeps the 1080x2400 layout and the keyboard-closed layout unchanged', () => {
    expect(compactTypingNeeded(914, 308, 332)).toBe(false);
    expect(compactTypingNeeded(609, 0, 24)).toBe(false);
  });

  it('uses keyboard clearance, not a device-height breakpoint', () => {
    expect(compactTypingNeeded(609, 100, 124)).toBe(false);
    expect(compactTypingNeeded(914, 600, 624)).toBe(true);
  });

  it('hides Check when the field fits but the prompt and field together do not', () => {
    // After collapsing the header: 490 - 332 - 69 = 89 dp, enough for a field alone.
    expect(dockStepsAside(true, 490, 69, 332, 128)).toBe(true);
  });

  it('keeps Check at the exact measured prompt-and-field boundary', () => {
    expect(dockStepsAside(true, 529, 69, 332, 128)).toBe(false);
    expect(dockStepsAside(true, 528, 69, 332, 128)).toBe(true);
  });

  it.each([false, true])('keeps both ends visible with Check hidden=%s', (hidden) => {
    const promptY = 60;
    const fieldY = 110;
    const fieldH = 54;
    const dockH = hidden ? 0 : 69;
    const viewportH = hidden ? 490 : 600;
    const visibleH = viewportH - 332 - dockH;
    const scrollY = answerScrollTarget(fieldY, fieldH, viewportH, dockH, 332);
    expect(promptY - scrollY).toBeGreaterThanOrEqual(12);
    expect(fieldY + fieldH - scrollY).toBeLessThanOrEqual(visibleH - 12);
  });
});
