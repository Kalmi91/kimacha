// The docked Check / Next bar (DockedAction) floats over the card's scroller. Kept as bottom padding only, a tall
// card (article buttons, a long word, accepted forms, example) scrolled to the top runs under the bar AND through the
// gap below it (the bar sits `dockLift`, the navigation-bar inset, above the tab bar), so the Knew it / Didn't know
// row shows over / beside Next. With the keyboard closed the scroller's viewport therefore ends at the bar's top edge
// (margin), so the card gets all the room above the bar. With the keyboard open the old full-height viewport is kept
// (the window pans to the answer field), so the room under the bar stays as padding there.
// E119: where to scroll the card so the answer field ends above the docked bar (and so above the keys) while typing.
// With the picture open the field sits below the keys' top edge, and Android then pans the whole window, which leaves
// the docked bar floating mid-screen. 0 when the field already fits, so a card without the problem stays as it is.
export function answerScrollTarget(fieldY: number, fieldH: number, viewportH: number, dockH: number, dockLift: number): number {
  const visibleH = viewportH - dockH - dockLift;
  return Math.max(0, Math.round(fieldY + fieldH + 12 - visibleH));
}

// On a short screen the header, the keys and the docked bar leave no room for the field itself (a field is ~58 dp plus a
// gap): then the bar steps aside while typing (the keyboard's ✓ submits), as it already does for the retype field.
export const MIN_ANSWER_ROOM = 72;
export function dockStepsAside(noteOpen: boolean, viewportH: number, dockH: number, dockLift: number, answerRoom = MIN_ANSWER_ROOM): boolean {
  return noteOpen && viewportH > 0 && viewportH - dockH - dockLift < answerRoom;
}

// The answer field changes its place in the tree on short screens, so this must not depend on the keyboard:
// moving the field when the keys open would remount it and Android would close the keyboard again.
export const SHORT_WINDOW_DP = 700;
export function shortWindow(windowH: number): boolean {
  return windowH > 0 && windowH < SHORT_WINDOW_DP;
}

// Below this keyboard clearance, use the compact header and keep the prompt next to the field.
// Window height stays independent of those layout changes, so collapsing the header cannot toggle itself back off.
export function compactTypingNeeded(windowH: number, kbHeight: number, dockLift: number): boolean {
  return kbHeight > 0 && windowH - dockLift < 360;
}

export function dockScrollInsets(dockH: number, dockLift: number, keyboardOpen: boolean) {
  return keyboardOpen
    ? { marginBottom: 0, paddingBottom: dockH + dockLift }
    : { marginBottom: dockH + dockLift, paddingBottom: 0 };
}
