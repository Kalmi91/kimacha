// The room of the docked footer of the story screen (components/speech/SpeechPlay.tsx). The footer has a fixed lower part (the
// input and Check, or the mic; Next; the links) that must always be on screen, above the keyboard, and an upper part (what was
// heard, the ask, the hint) that scrolls inside the room that is left. Pure arithmetic, no I/O.
//
// The room is measured, not guessed: `room` = the measured height of the frame (what is below the navigator header and above the
// tab bar, GameFrame onFrameLayout) minus how far the footer sits above the frame's bottom (the keyboard and the navigation bar,
// useDockLift's `dockLift`). The footer's bottom edge is `dockLift` above the frame's bottom and the frame's top is the header's
// bottom, so that difference is what is free for the back row, the chat and the footer, whether or not the window resizes for the
// keyboard: the keyboard height is in `dockLift` once and never again.

import { spacing, tapTarget } from '@/constants/Theme';

/** The footer's own padding (GameFrame): above and below its content. */
export const FOOTER_PAD = spacing.sm + spacing.md;
/** The back and progress row, until it is measured. */
export const TOP_ROW = tapTarget + spacing.sm + spacing.md;
/** With the keyboard closed the upper part never gets smaller than this: the ask stays readable, the rest scrolls. */
export const MIN_UPPER = tapTarget * 2;
/** While Help is open (the list of what can be said) the upper part keeps room for about three rows and scrolls (Help closes the keyboard first). */
export const MIN_HELP = tapTarget * 3;

/**
 * The tallest the scrollable upper part of the footer may be.
 * `room` = frame height minus `dockLift` (above), `kbHeight` = the keyboard height, `topH` = the back and progress row,
 * `fixedH` = the measured height of the fixed lower part, `voice` = by voice, where the chat keeps about a third of the window.
 * With the keyboard open only the fixed part has to be seen: the back row may be covered and the upper part may shrink to zero (Help
 * and the hint after two wrong tries close the keyboard, so a list is never squeezed to zero). With `help` and the keyboard closed it
 * keeps MIN_HELP and scrolls.
 */
export function upperFooterMax({ room, windowH, kbHeight, topH, fixedH, voice, help = false }: { room: number; windowH: number; kbHeight: number; topH: number; fixedH: number; voice: boolean; help?: boolean }): number {
  const left = room - FOOTER_PAD - fixedH;
  if (kbHeight > 0) return Math.max(0, Math.floor(left));
  return Math.max(help ? MIN_HELP : MIN_UPPER, Math.floor(left - topH - (voice ? windowH / 3 : 0)));
}
