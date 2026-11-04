import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { spacing } from '@/constants/Theme';
import { textOn } from '@/lib/contrast';
import { useTheme } from '@/lib/ThemeContext';

export const RISE_MS = 1100;

// The "+N" label that floats up for a moment where a player's XP just grew (a row or a podium column). Plain Animated with the
// native driver, no Reanimated / LayoutAnimation (see app/(tabs)/_layout.tsx on Fabric). Calls `onDone` when it has faded out.
export default function RiseChip({ delta, onDone, style }: { delta: number; onDone: () => void; style?: object }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const [t] = useState(() => new Animated.Value(0));
  // the parent's handler changes on every render; the animation must not restart with it
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: RISE_MS, useNativeDriver: true }).start(({ finished }) => finished && doneRef.current());
  }, [t]);
  return (
    <Animated.View
      pointerEvents="none"
      testID="board-gain"
      style={[
        styles.chip,
        style,
        {
          backgroundColor: colors.secondary,
          opacity: t.interpolate({ inputRange: [0, 0.2, 0.7, 1], outputRange: [0, 1, 1, 0] }),
          transform: [{ translateY: t.interpolate({ inputRange: [0, 0.2, 1], outputRange: [6, 0, -8] }) }],
        },
      ]}
    >
      <Text style={[styles.text, { color: textOn(colors.secondary, colors.onTint, colors.text, colors.background) }]}>{`+${delta}`}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: { position: 'absolute', paddingHorizontal: spacing.xs + 2, borderRadius: 999 },
  text: { fontSize: 12, lineHeight: 18, fontWeight: '700' },
});
