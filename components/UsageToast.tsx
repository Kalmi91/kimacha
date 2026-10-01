import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { legibleOn } from '@/constants/Skins';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { BrutalBox, textOnFill } from '@/components/grammar/Brutal';
import { t, stringsFor } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { onActiveMinute, onUsageMilestone, onDayRollover } from '@/lib/usageTimer';
import { pickDayRolloverMessage } from '@/lib/dayRollover';
import { isLongHaulMilestone, pickMilestoneLine } from '@/lib/usageMilestones';

// "+1 perc wauuuuuuuu" popup: fires once per full active minute (usageTimer's
// onActiveMinute), fades/slides in, sits for a couple seconds, fades out.
// Mounted once in the root layout so it can appear over any screen/tab.
//
// FB63: the same pill doubles as the milestone celebration (30 min in one go,
// 30/60 min today). A milestone stays up longer and is written in the language
// being LEARNED, not the UI language.

const VISIBLE_MS = 2000;
const MILESTONE_VISIBLE_MS = 4000;
// FB108: the midnight line carries the day's numbers, so it needs reading time.
const ROLLOVER_VISIBLE_MS = 8000;
const ANIM_MS = 250;

// PLAN-temak 7F: `hidden` (az onboarding alatt) nem rajzol semmit, hogy ne takarja el a címet.
export default function UsageToast({ hidden = false }: { hidden?: boolean }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const [visible, setVisible] = useState(false);
  // The toast lives in the root layout, so it mounts BEFORE onboarding picks the
  // native language: reading t() once would freeze the pill in the device locale
  // (seen on the emulator, Spanish UI with an English "+1 minute" pill). Read the
  // strings when the toast actually fires instead.
  const [message, setMessage] = useState(() => t().usage.plusOneMinute);
  const [isMilestone, setIsMilestone] = useState(false);
  // Lazy useState rather than useRef().current: the animated values must
  // survive re-renders, but reading a ref during render is not allowed.
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(-16));
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // FB63: language being learned, for the milestone text. Read once on mount,
  // it only changes on the onboarding screen (before this toast can fire).
  const learnedLang = useRef<string>('es');

  // FB76: greet on the first app open of each calendar day, in the language
  // being learned (FB63 pattern). claimDailyGreeting() is the day marker, so
  // the pill shows once a day even if the app is reopened later.
  const [greeting, setGreeting] = useState<string | null>(null);
  const greetedRef = useRef(false);

  useEffect(() => {
    const db = getDb();
    db.getOnboarding()
      .then(async ob => {
        if (ob?.target) learnedLang.current = ob.target;
        if (await db.claimDailyGreeting()) {
          setGreeting(stringsFor(learnedLang.current).usage.dailyGreeting);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const show = (text: string, milestone: boolean, visibleMs?: number) => {
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
      }, visibleMs ?? (milestone ? MILESTONE_VISIBLE_MS : VISIBLE_MS));
    };

    const unsubscribeMinute = onActiveMinute(() => show(t().usage.plusOneMinute, false));
    const unsubscribeMilestone = onUsageMilestone(({ scope, minutes }) => {
      const learned = stringsFor(learnedLang.current).usage;
      // FB149: the quarter-hour crossings past the first hour draw from their own
      // pool, so an hours-long day never repeats the same congratulation.
      if (scope === 'daily' && isLongHaulMilestone(minutes)) {
        show(pickMilestoneLine(learned.milestoneLong, minutes), true);
        return;
      }
      const template = scope === 'session' ? learned.milestoneSession : learned.milestoneDaily;
      show(template.replace('{min}', String(minutes)), true);
    });
    // FB108: playing THROUGH midnight, the finished day's stats + a celebration,
    // in the language being learned (FB63 pattern), one line out of a pool.
    const unsubscribeRollover = onDayRollover(({ minutes, words }) => {
      const learned = stringsFor(learnedLang.current).usage;
      show(pickDayRolloverMessage(learned.dayRollover, { minutes, words }), true, ROLLOVER_VISIBLE_MS);
    });
    // FB76: the day's greeting, shown once per app start (greetedRef keeps a
    // re-subscribe from repeating it).
    if (greeting && !greetedRef.current) {
      greetedRef.current = true;
      show(greeting, true);
    }

    return () => {
      unsubscribeMinute();
      unsubscribeMilestone();
      unsubscribeRollover();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
    // opacity and translateY are stable useState values; they are listed only
    // because show() animates them.
  }, [greeting, opacity, translateY]);

  if (!visible || hidden) return null;

  // NY25: brutalista palettán BrutalBox (sarok 0, tömör árnyék), nem pirula.
  if (g.brutal) {
    const fill = isMilestone ? 'b' : 'a';
    return (
      <Animated.View pointerEvents="none" testID="usage-toast" style={[styles.brutalToast, { opacity, transform: [{ translateY }] }]}>
        <BrutalBox fill={fill} boxStyle={isMilestone ? styles.brutalMilestoneBox : styles.brutalBox}>
          <Text style={[styles.brutalText, { color: textOnFill(g, fill) }, isMilestone && styles.milestoneText]}>{message}</Text>
        </BrutalBox>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      pointerEvents="none"
      testID="usage-toast-pill"
      style={[
        styles.pill,
        { backgroundColor: isMilestone ? legibleOn('#22C55E', '#FFFFFF') : colors.tint, opacity, transform: [{ translateY }] },
        isMilestone && styles.milestonePill,
      ]}
    >
      <Text style={[styles.text, !isMilestone && { color: colors.onTint }, isMilestone && styles.milestoneText]}>{message}</Text>
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
  brutalToast: { position: 'absolute', top: 56, alignSelf: 'center', maxWidth: '90%' },
  brutalBox: { paddingHorizontal: 18, paddingVertical: 10 },
  brutalMilestoneBox: { paddingHorizontal: 22, paddingVertical: 14 },
  brutalText: { fontSize: 15, fontWeight: '500', textTransform: 'uppercase' },
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
