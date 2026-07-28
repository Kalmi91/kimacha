import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t, stringsFor } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { onActiveMinute, onUsageMilestone } from '@/lib/usageTimer';

// "+1 perc wauuuuuuuu" popup: fires once per full active minute (usageTimer's
// onActiveMinute), fades/slides in, sits for a couple seconds, fades out.
// Mounted once in the root layout so it can appear over any screen/tab.
//
// FB63: the same pill doubles as the milestone celebration (30 min in one go,
// 30/60 min today). A milestone stays up longer and is written in the language
// being LEARNED, not the UI language.

const VISIBLE_MS = 2000;
const MILESTONE_VISIBLE_MS = 4000;
const ANIM_MS = 250;

export default function UsageToast() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState(s.usage.plusOneMinute);
  const [isMilestone, setIsMilestone] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // FB63: language being learned, for the milestone text. Read once on mount,
  // it only changes on the onboarding screen (before this toast can fire).
  const learnedLang = useRef<string>('es');

  useEffect(() => {
    getDb()
      .getOnboarding()
      .then(ob => {
        if (ob?.target) learnedLang.current = ob.target;
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const show = (text: string, milestone: boolean) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setMessage(text);
      setIsMilestone(milestone);
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
      }, milestone ? MILESTONE_VISIBLE_MS : VISIBLE_MS);
    };

    const unsubscribeMinute = onActiveMinute(() => show(s.usage.plusOneMinute, false));
    const unsubscribeMilestone = onUsageMilestone(({ scope, minutes }) => {
      const learned = stringsFor(learnedLang.current).usage;
      const template = scope === 'session' ? learned.milestoneSession : learned.milestoneDaily;
      show(template.replace('{min}', String(minutes)), true);
    });
    return () => {
      unsubscribeMinute();
      unsubscribeMilestone();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [s]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pill,
        { backgroundColor: isMilestone ? '#22C55E' : colors.tint, opacity, transform: [{ translateY }] },
        isMilestone && styles.milestonePill,
      ]}
    >
      <Text style={[styles.text, isMilestone && styles.milestoneText]}>{message}</Text>
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
  // FB63: a milestone gets a wider, bolder pill than the every-minute toast.
  milestonePill: {
    maxWidth: '90%',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  milestoneText: {
    fontSize: 17,
    textAlign: 'center',
  },
});
