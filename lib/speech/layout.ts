// The room of the docked footer of the story screen (components/speech/SpeechPlay.tsx). The footer has a fixed lower part (the
// input and Check, or the mic; Next; the links) that must always be on screen, above the keyboard, and an upper part (what was
// heard, the ask, the hint) that scrolls inside the room that is left. Pure arithmetic, no I/O.

import { spacing, tapTarget } from '@/constants/Theme';

// what sits above the footer besides the chat: the navigator header, the back link and progress row, and (until the keyboard
// hides it) the tab bar
const HEADER = tapTarget + spacing.lg;
const TOP_ROW = tapTarget + spacing.md;
const TAB_BAR = tapTarget + spacing.lg;

/** The upper part never gets smaller than this: the ask stays readable, the rest scrolls. */
export const MIN_UPPER = tapTarget * 2;

/**
 * The tallest the scrollable upper part of the footer may be.
 * `windowH` = the window height, `lift` = how far the footer sits above the bottom and `kbHeight` = the keyboard height (useDockLift),
 * `fixedH` = the measured height of the fixed lower part, `voice` = by voice, where the chat keeps about a third of the window.
 */
export function upperFooterMax({ windowH, lift, kbHeight, fixedH, voice }: { windowH: number; lift: number; kbHeight: number; fixedH: number; voice: boolean }): number {
  const above = HEADER + TOP_ROW + (kbHeight > 0 ? 0 : TAB_BAR) + (voice ? windowH / 3 : 0);
  return Math.max(MIN_UPPER, Math.floor(windowH - lift - fixedH - above));
}
