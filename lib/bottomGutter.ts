// User feedback (grammar:clases-de-palabras:lesson): "the app does not take into
// account that on my phone there is the back button at the bottom and such, somewhere it is fine,
// somewhere not, when we made the check button this came up too. It should be done so that the
// app checks whether there is one, and if there is, it loads the app
// in a way that there is no overlap".
//
// Until now we patched it screen by screen: the docked Check button of the learn sheet got an
// `insets.bottom` lift, the other screens got nothing, and ran under the
// system navigation bar (gesture strip or the three buttons). From now on
// the root layout holds the gap, in one place, for every screen.
//
// The `(tabs)` group is the exception: there the tab bar itself draws into the inset
// (React Navigation bottom-tabs), so if the root padded too, the tab bar would hang
// in the air by a navigation-bar's height.

/**
 * How much bottom gap the root layout needs on the current route.
 *
 * @param segments the value of expo-router's `useSegments()`
 * @param insetBottom the system bottom safe-area inset (0 if there is no bar)
 * @returns the gap in points
 */
export function bottomGutter(segments: string[], insetBottom: number): number {
  // Before the first screen is drawn there is no route yet. Then we do not pad,
  // so an app that starts with tabs does not jump on the first frame.
  if (segments.length === 0) return 0;
  if (segments[0] === '(tabs)') return 0;
  return Math.max(0, insetBottom);
}
