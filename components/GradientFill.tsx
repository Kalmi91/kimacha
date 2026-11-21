import { Platform, StyleSheet, View } from 'react-native';

import { gradientStyle } from '@/lib/gradientStyle';

// Why slices on native: 4.2.11 crashed (RN experimental_backgroundImage threw IAE from LinearGradient.nativeCreate),
// so the phone gets a pink-cyan gradient from N plain coloured Views side by side; the web uses a CSS gradient.
const N = 40;

const hex = (s: string, i: number) => parseInt(s.slice(1 + i * 2, 3 + i * 2), 16);

// #RRGGBB in, #RRGGBB out, t 0..1.
export function mixHex(from: string, to: string, t: number): string {
  const c = (i: number) => Math.round(hex(from, i) + (hex(to, i) - hex(from, i)) * t);
  return `#${[0, 1, 2].map((i) => c(i).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export default function GradientFill({ from, to, testID }: { from: string; to: string; testID?: string }) {
  if (Platform.OS === 'web') {
    return <View pointerEvents="none" testID={testID} style={[StyleSheet.absoluteFill, gradientStyle(from, to)]} />;
  }
  return (
    <View pointerEvents="none" testID={testID} style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
      {Array.from({ length: N }, (_, i) => (
        // marginRight -1: each slice runs 1 dp under the next one, so no hairline seam shows between them (seen on the emulator).
        <View key={i} style={{ flex: 1, marginRight: i < N - 1 ? -1 : 0, backgroundColor: mixHex(from, to, i / (N - 1)) }} />
      ))}
    </View>
  );
}
