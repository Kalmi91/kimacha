import { bottomGutter } from '../bottomGutter';

const NAV_BAR = 48;

describe('bottomGutter', () => {
  it('keeps the system navigation bar clear of a stack screen', () => {
    expect(bottomGutter(['grammar', 'clases-de-palabras'], NAV_BAR)).toBe(NAV_BAR);
  });

  it('leaves the tab group alone, because the tab bar owns that inset', () => {
    expect(bottomGutter(['(tabs)', 'index'], NAV_BAR)).toBe(0);
  });

  it('pads the other top-level screens too', () => {
    expect(bottomGutter(['onboarding'], NAV_BAR)).toBe(NAV_BAR);
    expect(bottomGutter(['spelling'], NAV_BAR)).toBe(NAV_BAR);
    expect(bottomGutter(['games', 'chat'], NAV_BAR)).toBe(NAV_BAR);
    expect(bottomGutter(['talk', 'pack'], NAV_BAR)).toBe(NAV_BAR);
  });

  it('adds nothing on a phone with no bottom bar', () => {
    expect(bottomGutter(['grammar', 'clases-de-palabras'], 0)).toBe(0);
  });

  it('never returns a negative gutter', () => {
    expect(bottomGutter(['grammar'], -10)).toBe(0);
  });

  it('adds nothing before the first route is known', () => {
    expect(bottomGutter([], NAV_BAR)).toBe(0);
  });
});
