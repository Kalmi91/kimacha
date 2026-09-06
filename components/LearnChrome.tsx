import { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import ProgressMeter from './ProgressMeter';

// ITER5, Kálmán 2026-09-04: the learn screen used to stack eight permanent
// blocks above the card (level badge, streak/exam badges, topic header,
// sub-level line, borrowed/mode banners...), hand-assembled by all three
// render branches. This single chrome replaces the lot: one status row plus
// a thin progress line that expands into the existing ProgressMeter on tap.

// FB122 (moved here from index.tsx): the status row is a fixed-height row, so
// its texts stay on one line and follow the system font size only up to this
// multiplier.
const FONT_SCALE_CAP = 1.3;

// FB169: the review tail inside the progress fill, and the smallest slice that
// still reads as a slice on a phone-wide bar.
const REVIEW_COLOR = '#F472B6';
const MIN_REVIEW_PCT = 3;

const TOAST_COLORS = {
  success: '#22C55E',
  info: '#2563EB',
  danger: '#EF4444',
} as const;

interface ToastProps {
  text: string;
  sub?: string;
  tone: 'success' | 'info' | 'danger';
  onPress?: () => void;
}

interface Props {
  level: string;
  topicIcon: string | null;
  topicName: string | null;
  onTopicPress: () => void;
  known: number;
  total: number;
  langFlag: string;
  langName: string;
  newWordsLeft: number;
  newWordsPaused: boolean;
  reviewLeft: number;
  examUnlocked: boolean;
  onExamPress: () => void;
  examLabel: string;
  toast: ToastProps | null;
}

export default function LearnChrome({
  level,
  topicIcon,
  topicName,
  onTopicPress,
  known,
  total,
  langFlag,
  langName,
  newWordsLeft,
  newWordsPaused,
  reviewLeft,
  examUnlocked,
  onExamPress,
  examLabel,
  toast,
}: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  // The thin progress line expands into the existing gem-grid meter on tap.
  const [meterOpen, setMeterOpen] = useState(false);

  const pct = Math.round(Math.min(known / Math.max(total, 1), 1) * 100);
  // FB169, Kálmán 2026-09-05: "a keknek egy resze legyen rozsaszín ... hogy mennyi
  // szot kell review ni. es ahogy egyre kevesebb lesz legyen egyre kisebb". The pink
  // slice is cut OUT of the blue fill (his choice), so the bar's total length still
  // reads as mastery: solid blue = mastered and not due, pink tail = mastered but
  // waiting for review in this session. MIN_REVIEW_PCT keeps the last word or two
  // visible on a large deck, where the true share would round to a hairline.
  const reviewShare = known > 0 ? Math.min(reviewLeft / known, 1) * pct : 0;
  const reviewPct = reviewLeft > 0 ? Math.min(pct, Math.max(reviewShare, MIN_REVIEW_PCT)) : 0;

  const ToastWrap = toast?.onPress ? Pressable : View;
  const toastBlock = toast ? (
    <ToastWrap
      style={[styles.levelUpOverlay, { backgroundColor: TOAST_COLORS[toast.tone] }]}
      {...(toast.onPress ? { onPress: toast.onPress } : {})}
    >
      <Text style={styles.levelUpText}>{toast.text}</Text>
      {toast.sub ? <Text style={[styles.levelUpText, { fontSize: 11 }]}>{toast.sub}</Text> : null}
    </ToastWrap>
  ) : null;

  // No topic (A0 or a topic-less level): only the level badge shows, and
  // there's nowhere to navigate, so the wrapper is a plain View.
  const TopicWrap = topicName ? Pressable : View;

  return (
    <View style={styles.wrap}>
      {toastBlock}

      <View style={styles.statusRow}>
        <TopicWrap style={styles.left} {...(topicName ? { onPress: onTopicPress } : {})}>
          <View style={[styles.levelBadge, { backgroundColor: '#38BDF8' }]}>
            <Text style={styles.levelText} maxFontSizeMultiplier={FONT_SCALE_CAP}>{level}</Text>
          </View>
          {topicName && (
            <Text
              style={[styles.topicName, { color: colors.text }]}
              numberOfLines={1}
              maxFontSizeMultiplier={FONT_SCALE_CAP}
            >
              {topicIcon ? `${topicIcon} ` : ''}{topicName}
            </Text>
          )}
        </TopicWrap>

        <View style={styles.right}>
          <Text style={[styles.knownCount, { color: colors.tint }]} maxFontSizeMultiplier={FONT_SCALE_CAP}>
            {known}/{total}
          </Text>
          <Text style={[styles.newWords, { color: colors.text }]} maxFontSizeMultiplier={FONT_SCALE_CAP}>
            {newWordsPaused ? `🌱⏸${newWordsLeft}` : `🌱${newWordsLeft}`}
          </Text>
          {/* FB171, Kálmán 2026-09-06: "szeretném, ha lenne egy rózsaszín szám ami azt
              mutatja még mennyi szót kell ismételni". Same pink as the bar's review
              tail, so the number and the slice read as one thing; hidden at zero,
              the way the 🎓 badge is. */}
          {reviewLeft > 0 && (
            <Text
              testID="reviewCount"
              style={[styles.newWords, { color: REVIEW_COLOR }]}
              maxFontSizeMultiplier={FONT_SCALE_CAP}
            >
              {`🔁${reviewLeft}`}
            </Text>
          )}
          {examUnlocked && (
            <Pressable style={styles.examBadge} onPress={onExamPress} accessibilityLabel={examLabel}>
              <Text style={styles.examIcon} maxFontSizeMultiplier={FONT_SCALE_CAP}>🎓</Text>
            </Pressable>
          )}
        </View>
      </View>

      {meterOpen ? (
        <Pressable onPress={() => setMeterOpen(false)}>
          <ProgressMeter known={known} total={total} langFlag={langFlag} langName={langName} />
        </Pressable>
      ) : (
        <Pressable style={styles.progressLine} onPress={() => setMeterOpen(true)}>
          <View style={[styles.progressTrack, { backgroundColor: colors.tabIconDefault }]} />
          <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: colors.tint }]} />
          {reviewPct > 0 && (
            <View
              testID="reviewFill"
              style={[
                styles.progressFill,
                { left: `${pct - reviewPct}%`, width: `${reviewPct}%`, backgroundColor: REVIEW_COLOR },
              ]}
            />
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  levelText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  topicName: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  knownCount: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  newWords: {
    fontSize: 12,
    fontWeight: '600',
  },
  examBadge: {
    backgroundColor: '#F59E0B',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  examIcon: {
    fontSize: 14,
  },
  // The mockup's gradient was illustration only, expo-linear-gradient isn't a
  // project dependency and this refactor doesn't add one: a solid tint fill.
  progressLine: {
    marginTop: 9,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressTrack: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.35,
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 3,
  },
  // Moved from index.tsx: the toast slot, top-right of the chrome.
  levelUpOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    zIndex: 100,
  },
  levelUpText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
