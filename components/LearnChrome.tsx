import { useState } from 'react';
import { StyleSheet, Text, View, Pressable, Modal } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
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
  /** FB228: a szint-jelvény külön koppintható, a szintváltót nyitja. */
  onLevelPress?: () => void;
  onTopicPress: () => void;
  known: number;
  total: number;
  langFlag: string;
  langName: string;
  // UTEMEZO 6. szakasz: a fejléc három száma, ld. header() a lib/sessionQueue.ts-ben.
  black: number;
  blue: number;
  pink: number;
  // FB177: everything still due today, this drives the pink tail of the bar.
  reviewLeft: number;
  examUnlocked: boolean;
  onExamPress: () => void;
  examLabel: string;
  toast: ToastProps | null;
  // UTEMEZO 7. szakasz: a lapon lévő kis címke (pl. "új · 1/3"), null = nincs
  // kártya (Done-képernyő, betöltés).
  lapLabel: string | null;
}

export default function LearnChrome({
  level,
  topicIcon,
  topicName,
  onLevelPress,
  onTopicPress,
  known,
  total,
  langFlag,
  langName,
  black,
  blue,
  pink,
  reviewLeft,
  examUnlocked,
  onExamPress,
  examLabel,
  toast,
  lapLabel,
}: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  // The thin progress line expands into the existing gem-grid meter on tap.
  const [meterOpen, setMeterOpen] = useState(false);
  // UTEMEZO 6. szakasz: a három számra koppintva megnyíló magyarázó ablak.
  const [helpOpen, setHelpOpen] = useState(false);

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

  // FB228 (Kálmán 2026-09-10): „ha a bal felső sarokban az A1-re kattintok
  // akkor lehessen szintet váltani, ha a topikra akkor topikot". A jelvény és a
  // téma-név két külön gomb: a jelvény a szintváltót nyitja, a név a fát.
  const LevelWrap = onLevelPress ? Pressable : View;
  const TopicWrap = topicName ? Pressable : View;

  return (
    <View style={styles.wrap}>
      {toastBlock}

      <View style={styles.statusRow}>
        <View style={styles.left}>
          <LevelWrap
            style={[styles.levelBadge, { backgroundColor: '#38BDF8' }]}
            {...(onLevelPress ? { onPress: onLevelPress, hitSlop: 6, testID: 'headerLevel' } : {})}
          >
            <Text style={styles.levelText} maxFontSizeMultiplier={FONT_SCALE_CAP}>{level}</Text>
          </LevelWrap>
          {topicName && (
            <TopicWrap style={styles.topicWrap} {...(topicName ? { onPress: onTopicPress, hitSlop: 6 } : {})}>
              <Text
                style={[styles.topicName, { color: colors.text }]}
                numberOfLines={1}
                maxFontSizeMultiplier={FONT_SCALE_CAP}
              >
                {topicIcon ? `${topicIcon} ` : ''}{topicName}
              </Text>
            </TopicWrap>
          )}
        </View>

        <View style={styles.right}>
          {/* UTEMEZO 6. szakasz: harom sima szam, jelveny es betu nelkul, a napi
              keret maradeka / a kezben levo lapok / a hatralevo review-lapok.
              Koppintasra egy kis ablak mondja el, mi szamit bele (lasd lejjebb). */}
          <Pressable style={styles.headRow} onPress={() => setHelpOpen(true)} testID="headerHelp">
            <Text testID="headBlack" style={[styles.headNum, { color: colors.text }]} maxFontSizeMultiplier={FONT_SCALE_CAP}>
              {black}
            </Text>
            <Text style={[styles.headSep, { color: colors.tabIconDefault }]} maxFontSizeMultiplier={FONT_SCALE_CAP}>/</Text>
            <Text testID="headBlue" style={[styles.headNum, { color: '#38BDF8' }]} maxFontSizeMultiplier={FONT_SCALE_CAP}>
              {blue}
            </Text>
            <Text style={[styles.headSep, { color: colors.tabIconDefault }]} maxFontSizeMultiplier={FONT_SCALE_CAP}>/</Text>
            <Text testID="headPink" style={[styles.headNum, { color: REVIEW_COLOR }]} maxFontSizeMultiplier={FONT_SCALE_CAP}>
              {pink}
            </Text>
          </Pressable>
          {examUnlocked && (
            <Pressable style={styles.examBadge} onPress={onExamPress} accessibilityLabel={examLabel}>
              <Text style={styles.examIcon} maxFontSizeMultiplier={FONT_SCALE_CAP}>🎓</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* UTEMEZO 7. szakasz: minden lapon egy cimke, hogy a spec telefonon
          ellenorizheto legyen. */}
      {lapLabel !== null && (
        <View style={[styles.lapChip, { backgroundColor: colors.card }]} testID="lapLabel">
          <Text style={[styles.lapChipText, { color: colors.tabIconDefault }]}>{lapLabel}</Text>
        </View>
      )}

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

      <Modal visible={helpOpen} transparent animationType="fade">
        <Pressable style={styles.helpOverlay} onPress={() => setHelpOpen(false)}>
          <View style={[styles.helpCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.helpTitle, { color: colors.text }]}>{s.header.title}</Text>
            <View style={styles.helpRow}>
              <View style={[styles.helpDot, { backgroundColor: colors.text }]} />
              <Text style={[styles.helpLine, { color: colors.text }]}>{s.header.black}</Text>
            </View>
            <View style={styles.helpRow}>
              <View style={[styles.helpDot, { backgroundColor: '#38BDF8' }]} />
              <Text style={[styles.helpLine, { color: colors.text }]}>{s.header.blue}</Text>
            </View>
            <View style={styles.helpRow}>
              <View style={[styles.helpDot, { backgroundColor: REVIEW_COLOR }]} />
              <Text style={[styles.helpLine, { color: colors.text }]}>{s.header.pink}</Text>
            </View>
            <Text style={[styles.helpSum, { color: colors.tabIconDefault }]}>{s.header.sum}</Text>
            <Pressable style={[styles.helpClose, { backgroundColor: colors.tint }]} onPress={() => setHelpOpen(false)}>
              <Text style={styles.helpCloseText}>{s.header.close}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
  topicWrap: {
    flexShrink: 1,
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
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  headNum: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  headSep: {
    fontSize: 12,
    fontWeight: '600',
  },
  // UTEMEZO 7. szakasz: a lap-cimke, kis lekerekitett chip a fejlec alatt.
  lapChip: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  lapChipText: {
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
  // UTEMEZO 6. szakasz: a három szám magyarázó ablaka, a FeedbackModal
  // stílusát követve (dimmelt háttér + lekerekített kártya).
  helpOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  helpCard: {
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  helpDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  helpLine: {
    fontSize: 14,
    flexShrink: 1,
  },
  helpSum: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  helpClose: {
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  helpCloseText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
