import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';

// GAMES.md 3.: "3-2-1 indítás az időzített játékokhoz". Plain RN Animated
// (no react-native-reanimated dependency needed for a one-shot count-in), 
// each tick fades/scales in, holds briefly, then advances; onDone fires once,
// right after "Start!" finishes its beat.

interface Props {
  onDone: () => void;
  stepMs?: number; // time each tick is shown, default 700ms
}

export default function CountdownStart({ onDone, stepMs = 700 }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  const steps = ['3', '2', '1', s.games.go];
  const [index, setIndex] = useState(0);
  // Lazy useState rather than useRef().current: the animated values must
  // survive re-renders, but reading a ref during render is not allowed.
  const [scale] = useState(() => new Animated.Value(0.5));
  const [opacity] = useState(() => new Animated.Value(0));
  const doneRef = useRef(false);

  useEffect(() => {
    scale.setValue(0.5);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }),
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      if (index < steps.length - 1) {
        setIndex((v) => v + 1);
      } else if (!doneRef.current) {
        doneRef.current = true;
        onDone();
      }
    }, stepMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.number, { color: colors.tint, transform: [{ scale }], opacity }]}>
        {steps[index]}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  number: {
    fontSize: 96,
    fontWeight: '800',
  },
});
