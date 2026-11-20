import { Platform, type ViewStyle } from 'react-native';

// A left-to-right two-colour gradient background (Night progress bar + active tab capsule).
// Web: CSS `backgroundImage` (react-native-web passes it through); native: RN 0.85
// `experimental_backgroundImage` (accepts the same CSS string). No new dependency.
export function gradientStyle(from: string, to: string): ViewStyle {
  const css = `linear-gradient(90deg, ${from}, ${to})`;
  return Platform.select({
    web: { backgroundImage: css },
    default: { experimental_backgroundImage: css },
  }) as ViewStyle;
}
