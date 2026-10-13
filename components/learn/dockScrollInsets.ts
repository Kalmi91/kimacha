import { FAB_CLEARANCE } from '@/components/learn/DockedAction';

// The docked Check / Next bar (DockedAction) floats over the card's scroller. Kept as bottom padding only, a tall
// card (article buttons, a long word, accepted forms, example) scrolled to the top runs under the bar AND through the
// gap below it (the bar sits `dockLift`, the navigation-bar inset, above the tab bar), so the Knew it / Didn't know
// row shows over / beside Next. With the keyboard closed the scroller's viewport therefore ends at the bar's top edge
// (margin), and only the 💬 clearance stays as padding. With the keyboard open the old full-height viewport is kept
// (the window pans to the answer field), so the room under the bar stays as padding there.
export function dockScrollInsets(dockH: number, dockLift: number, keyboardOpen: boolean) {
  return keyboardOpen
    ? { marginBottom: 0, paddingBottom: FAB_CLEARANCE + dockH + dockLift }
    : { marginBottom: dockH + dockLift, paddingBottom: FAB_CLEARANCE };
}
