import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// FB170, Kálmán 2026-09-06: "azt akarom hogy a check rész az pont a klaviatúrám
// felett legyen és nem kell ketto". The typing card had two Check buttons (the
// in-card one from FB5 and the older one below the card); there is one now, docked
// to the bottom edge of this screen.
//
// Three tries to place it, and the reason the first two missed was never the
// keyboard height, it was what sat under the container:
//   FB170 lifted the bar by the reported keyboard height, and the visible TAB BAR
//     below the container ate that much of the lift (a ~49 dp gap).
//   FB172 measured instead, and mixed window coordinates with the keyboard's screen
//     coordinates, so the bar slid under the keys.
//   FB175 asked the window to resize, which an edge-to-edge Android window does not
//     do (the IME arrives as an inset), so the bar stayed at the screen bottom,
//     completely behind the keyboard.
// FB176: with `tabBarHideOnKeyboard` (FB175) the container now ends AT the bottom of
// the screen while typing, which is exactly where the reported keyboard height is
// measured from, so the plain arithmetic is the correct one after all.
//
// FB178: the keyboard event reports the height of the KEYS ONLY. On a phone with the
// three-button navigation bar the keyboard sits ON TOP of that bar, so its top edge is
// kbHeight + the bottom safe-area inset above the screen bottom. Lifting by the raw
// height left the bar a navigation bar too low, which is why it stayed behind the keys.
//
// FB350: shared out of app/(tabs)/index.tsx so the PCIC tab's docked Check bar can
// lift the same way (it was pinned to bottom: 0, so it sat behind the open keyboard).
export function useDockLift() {
  const [kbHeight, setKbHeight] = useState(0);
  const insets = useSafeAreaInsets();

  // FB176: 'Did' events, not 'Will': Android only fires those.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // FB178: how far the docked bar has to sit above the bottom of this screen. With the
  // keyboard closed that is just the navigation bar; with it open, the keys plus the bar.
  const dockLift = kbHeight > 0 ? kbHeight + insets.bottom : insets.bottom;

  return { dockLift, kbHeight };
}
