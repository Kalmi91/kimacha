import { FOOTER_PAD, MIN_HELP, MIN_UPPER, TOP_ROW, upperFooterMax } from '../layout';

// a tall phone, keyboard closed: the frame is 700 dp, the footer sits on the bottom
const tall = { room: 700, windowH: 914, kbHeight: 0, topH: TOP_ROW, fixedH: 100, voice: false };

describe('upperFooterMax', () => {
  it('keyboard closed: the room that is left after the footer padding, the fixed part and the back row, never less than the minimum', () => {
    expect(upperFooterMax(tall)).toBe(700 - FOOTER_PAD - 100 - TOP_ROW);
    expect(upperFooterMax({ ...tall, room: 200 })).toBe(MIN_UPPER);
    expect(upperFooterMax({ ...tall, fixedH: 900 })).toBe(MIN_UPPER);
  });

  it('a taller fixed part leaves less for the upper part', () => {
    expect(upperFooterMax({ ...tall, fixedH: 200 })).toBe(upperFooterMax(tall) - 100);
  });

  it('by voice the chat keeps about a third of the window', () => {
    expect(upperFooterMax(tall) - upperFooterMax({ ...tall, voice: true })).toBeGreaterThanOrEqual(Math.floor(914 / 3) - 1);
    expect(upperFooterMax({ ...tall, room: 300, voice: true })).toBe(MIN_UPPER);
  });

  it('keyboard open: the back row and the chat may be covered, only the fixed part has to be seen and the upper part may be zero', () => {
    const open = { ...tall, kbHeight: 300 };
    // the same room, but the back row and the voice third are not counted
    expect(upperFooterMax({ ...open, room: 400 })).toBe(400 - FOOTER_PAD - 100);
    expect(upperFooterMax({ ...open, room: 400, voice: true })).toBe(400 - FOOTER_PAD - 100);
    // no minimum
    expect(upperFooterMax({ ...open, room: FOOTER_PAD + 100 })).toBe(0);
    expect(upperFooterMax({ ...open, room: 50 })).toBe(0);
  });

  it('the small phone of the emulator: a 610 dp window, header to 145, keyboard top at 276 (131 dp free): the footer fits', () => {
    // the frame starts at the header's bottom and, with the keyboard open, the footer sits on the keyboard
    const frameH = 610 - 145;
    const lift = 610 - 276;
    const fixedH = 95; // the input row and one link row
    const upper = upperFooterMax({ room: frameH - lift, windowH: 610, kbHeight: lift, topH: TOP_ROW, fixedH, voice: false });
    expect(upper).toBeGreaterThanOrEqual(0);
    // the footer (padding + upper + fixed) fits in the 131 dp between the header and the keyboard
    expect(FOOTER_PAD + upper + fixedH).toBeLessThanOrEqual(276 - 145);
  });

  it('the keyboard height is counted once: it is in the lift, so a bigger lift takes exactly that much from the room (and the back row stops counting)', () => {
    const closed = upperFooterMax({ ...tall, room: 700 - 48 });
    const open = upperFooterMax({ ...tall, room: 700 - 48 - 300, kbHeight: 300 });
    expect(closed - open).toBe(300 - TOP_ROW);
  });

  it('Help open (keyboard closed): the list keeps room for about three rows and scrolls, also on a small phone', () => {
    expect(MIN_HELP).toBeGreaterThan(MIN_UPPER);
    expect(upperFooterMax({ ...tall, room: 200, help: true })).toBe(MIN_HELP);
    expect(upperFooterMax({ ...tall, fixedH: 900, help: true })).toBe(MIN_HELP);
    expect(upperFooterMax({ ...tall, room: 200 })).toBe(MIN_UPPER);
    // a roomy phone is not limited by the minimum
    expect(upperFooterMax({ ...tall, help: true })).toBe(upperFooterMax(tall));
  });
});
