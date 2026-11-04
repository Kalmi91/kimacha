import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { fontSize, fontWeight, lineHeight, radius, shadow, spacing, tapTarget } from '@/constants/Theme';
import { getPcicTarget } from '@/data/pcic';
import { daysLeft, weekDayIndex } from '@/lib/cloud/boardStats';
import { NAME_MAX, isValidName } from '@/lib/cloud/validate';
import { t } from '@/lib/i18n';
import { pairOf } from '@/lib/languagePair';
import { mixColor } from '@/lib/mixColor';
import ScreenFeedback from '@/lib/screenFeedback';
import { useTheme } from '@/lib/ThemeContext';
import BoardList from './BoardList';
import MeBar from './MeBar';
import MyWeekPanel from './MyWeekPanel';
import Podium from './Podium';
import { useBoard } from './useBoard';

const HEADER_HEIGHT = 52;

// The weekly XP leaderboard tab. One scroll: the podium on a colored band, then a sheet with the own-week panel, the list from the
// 4th place and the leave link; the own place and the Learn button float above the tab bar. Phases (useBoard): the join form (native
// without a name), loading, offline, left (list + join button) and ready.
export default function BoardScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().board;
  const router = useRouter();
  const b = useBoard();
  const scroll = useRef<ScrollView>(null);
  const sheetY = useRef(0);
  const panelY = useRef(0);

  if (b.phase === 'hidden') return null;

  const { phase, data } = b;
  const ready = phase === 'ready' && data?.me ? data : null;
  const showList = (phase === 'ready' || phase === 'left') && data;
  const band = mixColor(colors.secondary, colors.background, 0.3);
  const todayIndex = data ? weekDayIndex(data.weekStart, new Date()) : 0;
  const canJoin = isValidName(b.name) && !b.busy;
  const rest = data ? data.rows.filter((r) => r.rank > 3) : [];
  const errorLine = b.error ? <Text testID="board-error" style={[styles.note, { color: colors.danger }]}>{b.error}</Text> : null;
  const joinButton = (testID: string, onPress: () => void, enabled: boolean) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
      onPress={onPress}
      disabled={!enabled}
      style={[styles.cta, { backgroundColor: colors.tint, opacity: enabled ? 1 : 0.4 }]}
    >
      <Text style={[styles.ctaText, { color: colors.onTint }]}>{s.join}</Text>
    </Pressable>
  );

  const openWeek = () => scroll.current?.scrollTo({ y: Math.max(0, sheetY.current + panelY.current - spacing.xs), animated: !b.reduceMotion });

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        ref={scroll}
        accessibilityLabel={s.title}
        style={{ backgroundColor: colors.card }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ backgroundColor: band }}>
          <View style={styles.header}>
            <Text variant="title" accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{t().tabs.board}</Text>
            <ScreenFeedback placement="inline" level="-" languagePair={pairOf(getPcicTarget())} currentCard="board-tab" />
          </View>
          {showList && data ? (
            <View style={[styles.chip, { backgroundColor: colors.card }]}>
              <Text style={[styles.chipText, { color: colors.text }]}>{s.chipLeft(daysLeft(todayIndex))}</Text>
            </View>
          ) : null}
          <Podium rows={showList && data ? data.rows : null} gains={b.gains} onGainDone={b.gainDone} />
        </View>
        <View
          style={[styles.sheet, { backgroundColor: colors.card }, ready && styles.sheetReady]}
          onLayout={(e) => {
            sheetY.current = e.nativeEvent.layout.y;
          }}
        >
          {phase === 'loading' && <Text testID="board-loading" style={[styles.note, styles.pad, { color: colors.textMuted }]}>{s.loading}</Text>}
          {phase === 'offline' && <Text testID="board-offline" style={[styles.note, styles.pad, { color: colors.textMuted }]}>{s.offline}</Text>}
          {phase === 'join' && (
            <View style={styles.form}>
              <Text style={[styles.prompt, { color: colors.text }]}>{s.joinPrompt}</Text>
              <TextInput
                testID="board-name"
                accessibilityLabel={s.namePlaceholder}
                style={[styles.input, { color: colors.text, backgroundColor: mixColor(colors.text, colors.card, 0.08) }]}
                value={b.name}
                onChangeText={b.changeName}
                placeholder={s.namePlaceholder}
                placeholderTextColor={colors.textMuted}
                maxLength={NAME_MAX}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={b.join}
              />
              <Text style={[styles.note, { color: colors.textMuted }]}>{s.joinWarning}</Text>
              {errorLine}
              {joinButton('board-join', b.join, canJoin)}
            </View>
          )}
          {ready && b.week ? (
            <MyWeekPanel
              me={ready.me!}
              rows={ready.rows}
              days={b.week.days}
              todayIndex={todayIndex}
              lastWeek={b.week.lastWeek}
              streak={b.week.streak}
              onLayout={(e) => {
                panelY.current = e.nativeEvent.layout.y;
              }}
            />
          ) : null}
          {showList && data ? (
            data.rows.every((r) => r.xp === 0) ? (
              <Text testID="board-empty" style={[styles.note, styles.pad, { color: colors.textMuted }]}>{s.empty}</Text>
            ) : (
              <BoardList rows={rest} gains={b.gains} onGainDone={b.gainDone} animate={!b.reduceMotion} />
            )
          ) : null}
          {phase === 'left' && (
            <View style={styles.form}>
              <Text style={[styles.note, { color: colors.textMuted }]}>{s.joinWarning}</Text>
              {errorLine}
              {joinButton('board-rejoin', b.rejoin, !b.busy)}
            </View>
          )}
          {phase === 'ready' && (
            <>
              {errorLine && <View style={styles.pad}>{errorLine}</View>}
              <Pressable testID="board-leave" accessibilityRole="button" onPress={b.confirmLeave} style={styles.leave}>
                <Text style={[styles.leaveText, { color: colors.textMuted }]}>{s.leave}</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
      {ready ? (
        <MeBar
          me={ready.me!}
          rows={ready.rows}
          // without the own-week figures there is no panel to jump to
          onOpenWeek={b.week ? openWeek : undefined}
          onLearn={() => router.navigate('/(tabs)' as never)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  header: { height: HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: spacing.lg, paddingRight: spacing.xs },
  title: { fontSize: fontSize.lg, lineHeight: lineHeight.lg, fontWeight: fontWeight.bold },
  chip: { alignSelf: 'center', marginBottom: spacing.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.lg },
  chipText: { fontSize: fontSize.xs, lineHeight: lineHeight.xs, fontWeight: fontWeight.semibold },
  sheet: { flexGrow: 1, marginTop: -spacing.sm, paddingHorizontal: spacing.sm, paddingTop: spacing.sm, paddingBottom: spacing.xl, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, ...shadow.card },
  // room under the last row so the floating bar covers nothing
  sheetReady: { paddingBottom: tapTarget * 2 },
  pad: { padding: spacing.md },
  form: { padding: spacing.lg, gap: spacing.md },
  prompt: { fontSize: fontSize.lg, lineHeight: lineHeight.lg, fontWeight: fontWeight.bold },
  input: { minHeight: tapTarget + spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.md, fontSize: fontSize.md },
  note: { fontSize: fontSize.xs, lineHeight: lineHeight.xs },
  cta: { minHeight: tapTarget + spacing.sm, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  leave: { minHeight: tapTarget, alignSelf: 'center', justifyContent: 'center', marginTop: spacing.xs, paddingHorizontal: spacing.md },
  leaveText: { fontSize: fontSize.xs, textDecorationLine: 'underline' },
});
