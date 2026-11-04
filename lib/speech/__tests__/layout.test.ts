import { MIN_UPPER, upperFooterMax } from '../layout';

const phone = { windowH: 640, lift: 0, kbHeight: 0, fixedH: 100, voice: false };

describe('upperFooterMax', () => {
  it('gives the upper part the room that is left, and never less than the minimum', () => {
    expect(upperFooterMax(phone)).toBeGreaterThan(MIN_UPPER);
    expect(upperFooterMax({ ...phone, windowH: 200 })).toBe(MIN_UPPER);
    expect(upperFooterMax({ ...phone, fixedH: 900 })).toBe(MIN_UPPER);
  });

  it('an open keyboard takes its height (the tab bar is gone then): the upper part shrinks, the footer still fits the window', () => {
    const open = upperFooterMax({ ...phone, lift: 300, kbHeight: 300 });
    expect(open).toBeLessThan(upperFooterMax(phone));
    expect(open).toBeGreaterThanOrEqual(MIN_UPPER);
    // the footer (lift + fixed + upper) still fits in the window
    expect(300 + phone.fixedH + open).toBeLessThan(phone.windowH);
  });

  it('a taller fixed part leaves less for the upper part', () => {
    expect(upperFooterMax({ ...phone, fixedH: 200 })).toBe(upperFooterMax(phone) - 100);
  });

  it('by voice the chat keeps about a third of the window', () => {
    const typing = upperFooterMax({ ...phone, windowH: 1200, fixedH: 150 });
    const voice = upperFooterMax({ ...phone, windowH: 1200, fixedH: 150, voice: true });
    expect(typing - voice).toBe(400);
    expect(upperFooterMax({ ...phone, voice: true })).toBeGreaterThanOrEqual(MIN_UPPER);
  });
});
