import { Platform, type ViewStyle } from 'react-native';

// A left-to-right two-colour gradient background (Night progress bar + active tab capsule).
// Web: CSS `backgroundImage` (react-native-web passes it through). Native: the solid `from` colour.
// RN 0.85's `experimental_backgroundImage` crashed 4.2.11 on Android at every start with the Night
// theme (IllegalArgumentException in LinearGradient.nativeCreate while drawing the tab capsule).
export function gradientStyle(from: string, to: string): ViewStyle {
  return Platform.OS === 'web'
    ? ({ backgroundImage: `linear-gradient(90deg, ${from}, ${to})` } as unknown as ViewStyle)
    : { backgroundColor: from };
}

// Web only: drop the browser's own focus ring (RN types lack outlineStyle 'none'; react-native-web passes it through).
export const noWebOutline = (): ViewStyle => (Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : {});
