import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { onActiveMinute } from '@/lib/usageTimer';

// "+1 perc wauuuuuuuu" popup: fires once per full active minute (usageTimer's
// onActiveMinute), fades/slides in, sits for a couple seconds, fades out.
// Mounted once in the root layout so it can appear over any screen/tab.

const VISIBLE_MS = 2000;
const ANIM_MS = 250;

export default function UsageToast() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = onActiveMinute(() => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setVisible(true);
      opacity.setValue(0);
      translateY.setValue(-16);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: ANIM_MS, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: ANIM_MS, useNativeDriver: true }),
      ]).start();
      hideTimer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: ANIM_MS, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -16, duration: ANIM_MS, useNativeDriver: true }),
        ]).start(() => setVisible(false));
      }, VISIBLE_MS);
    });
    return () => {
      unsubscribe();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pill,
        { backgroundColor: colors.tint, opacity, transform: [{ translateY }] },
      ]}
    >
      <Text style={styles.text}>{s.usage.plusOneMinute}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
