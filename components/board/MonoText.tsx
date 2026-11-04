import { Text as RNText, type TextProps } from 'react-native';

import { MONO } from './boardUi';

// The monospace figures of the leaderboard. Plain RN Text on purpose: KText drops `fontWeight` whenever a `fontFamily` is set, and
// these digits must stay heavy (flap digits, stat and cell values); they also keep their pixel size under every theme's font scale.
export function MonoText({ style, ...rest }: TextProps) {
  return <RNText {...rest} style={[{ fontFamily: MONO }, style]} />;
}
