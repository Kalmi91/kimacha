import { ScrollView, useWindowDimensions, type ScrollViewProps, type ViewStyle } from 'react-native';

import { FAB_CLEARANCE } from '@/components/learn/DockedAction';

// The floating 💬 button (FeedbackModal) covers a 55 px square 24 px in from the screen edge, so a scroller that runs
// under it can hide a row / toggle / button until it is scrolled. The scroller therefore ends beside the button: above
// it in portrait (a band at the bottom), and left of it in landscape, where a band would eat the little height there is.
// (`width: 'auto'` so that a scroller with `width: '100%'` shrinks by the margin instead of overflowing.)
export function fabInsets(width: number, height: number): ViewStyle {
  return width > height ? { marginRight: FAB_CLEARANCE, width: 'auto' } : { marginBottom: FAB_CLEARANCE };
}

export function useFabInsets() {
  const { width, height } = useWindowDimensions();
  return fabInsets(width, height);
}

// A ScrollView that leaves room for the 💬 button (see fabInsets).
export default function FabScrollView({ style, ...rest }: ScrollViewProps) {
  return <ScrollView style={[style, useFabInsets()]} {...rest} />;
}
