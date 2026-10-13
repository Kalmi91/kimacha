import type { ViewStyle } from 'react-native';
import { FAB_CLEARANCE } from '@/components/learn/DockedAction';

// The docked Check / Next bar (DockedAction) floats over the card's scroller. Kept as bottom padding only, a tall
// card (article buttons, a long word, accepted forms, example) scrolled to the top runs under the bar AND through the
// gap below it (the bar sits `dockLift`, the navigation-bar inset, above the tab bar), so the Knew it / Didn't know
// row shows over / beside Next. With the keyboard closed the scroller's viewport therefore ends above the bar, and
// beside the 💬 button that floats over it (`fab`, see fabInsets: a band above the bar, or in landscape a gutter at
// the right), so the button never covers the card, not even before scrolling. With the keyboard open the old
// full-height viewport is kept (the window pans to the answer field), so the room under the bar stays as padding there.
export function dockScrollInsets(dockH: number, dockLift: number, keyboardOpen: boolean, fab: ViewStyle) {
  return keyboardOpen
    ? { scroll: {} as ViewStyle, paddingBottom: FAB_CLEARANCE + dockH + dockLift }
    : { scroll: { ...fab, marginBottom: dockH + dockLift + ((fab.marginBottom as number) ?? 0) } as ViewStyle, paddingBottom: 0 };
}
