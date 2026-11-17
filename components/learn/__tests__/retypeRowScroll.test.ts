import { retypeRowScrollTarget } from '../dockScrollInsets';

describe('retypeRowScrollTarget (E148: the retype row shows after a wrong or revealed answer)', () => {
  it('scrolls so the whole row ends above the bottom edge of the card viewport', () => {
    // viewport 1500, row at y 1647 (height 150): its bottom (1797) + 12 gap must fit
    expect(retypeRowScrollTarget(1647, 150, 1500)).toBe(1647 + 150 + 12 - 1500);
  });

  it('does not scroll a row that already fits', () => {
    expect(retypeRowScrollTarget(400, 150, 1500)).toBe(0);
  });

  it('does nothing before the viewport is measured', () => {
    expect(retypeRowScrollTarget(1647, 150, 0)).toBe(0);
  });
});
