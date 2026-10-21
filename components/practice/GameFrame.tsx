import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { fontSize, fontWeight, spacing } from '@/constants/Theme';
import { SkinBackdrop } from '@/components/skins/Slots';
import DockedAction, { DOCK_RESERVE, type DockedActionTone } from '@/components/learn/DockedAction';
import { dockScrollInsets } from '@/components/learn/dockScrollInsets';
import { useDockLift } from '@/components/learn/useDockLift';
import LevelCounter from '@/components/practice/LevelCounter';
import type { PcicTarget } from '@/data/pcic';
import { t } from '@/lib/i18n';
import { pairOf } from '@/lib/languagePair';
import ScreenFeedback from '@/lib/screenFeedback';
import { useTheme } from '@/lib/ThemeContext';

// The frame every Practice tab game sits in (see components/practice/modes.ts): level counter and progress on top, the
// content in a scroller (or centered, for the empty state and the summary), the docked action bar above the keyboard,
// and the 💬 feedback button with the card id. Plus the two shared screens: GameEmpty and GameSummary.

export interface GameDock {
  label: string;
  onPress: () => void;
  tone: DockedActionTone;
  testID: string;
  disabled?: boolean;
}

interface Props {
  /** `<mode>-screen` */
  testID: string;
  target: PcicTarget;
  /** The card the 💬 button reports, e.g. `practice-dictation:o33`. */
  currentCard: string;
  /** Bump after every credited answer: the level counter reads the due words again. */
  creditSeq?: number;
  progress?: { text: string; label: string };
  dock?: GameDock;
  /** The content sits in the middle of the screen instead of a scroller. */
  centered?: boolean;
  children: ReactNode;
}

export default function GameFrame({ testID, target, currentCard, creditSeq = 0, progress, dock, centered = false, children }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { dockLift, kbHeight } = useDockLift();
  const [dockH, setDockH] = useState(DOCK_RESERVE);
  const insets = dockScrollInsets(dockH, dockLift, kbHeight > 0);
  return (
    <KeyboardAvoidingView
      testID={testID}
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SkinBackdrop />
      <View style={styles.header}>
        {/* No screen title: the tab navigator's header already says "Practice". */}
        <LevelCounter refreshKey={creditSeq} />
        {progress && (
          <Text accessibilityLabel={progress.label} style={[styles.progress, { color: colors.tabIconDefault }]}>
            {progress.text}
          </Text>
        )}
      </View>
      {centered ? (
        <View style={styles.center}>{children}</View>
      ) : (
        <ScrollView
          style={[styles.scroll, { marginBottom: insets.marginBottom }]}
          contentContainerStyle={{ paddingBottom: insets.paddingBottom }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {children}
        </ScrollView>
      )}
      {dock && (
        <DockedAction
          testID={dock.testID}
          label={dock.label}
          onPress={dock.onPress}
          tone={dock.tone}
          disabled={dock.disabled}
          bottom={dockLift}
          colors={colors}
          onHeight={setDockH}
        />
      )}
      <ScreenFeedback placement="header" level="-" languagePair={pairOf(target)} currentCard={currentCard} />
    </KeyboardAvoidingView>
  );
}

/** Too few learned words for a round (the same idea as the reading round's empty state). */
export function GameEmpty({ mode, target }: { mode: string; target: PcicTarget }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  return (
    <GameFrame testID={`${mode}-screen`} target={target} currentCard={`practice-${mode}`} centered>
      <Text testID={`${mode}-empty`} style={[styles.emptyText, { color: colors.text }]}>{t().practiceTab.game.emptyTitle}</Text>
    </GameFrame>
  );
}

/** The end of a round: x of the words right first time, and the New round button (the frame's dock, testID `<mode>-again`). */
export function GameSummary({ mode, target, score, total, creditSeq, onNewRound }: {
  mode: string;
  target: PcicTarget;
  score: number;
  total: number;
  creditSeq?: number;
  onNewRound: () => void;
}) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  return (
    <GameFrame
      testID={`${mode}-screen`}
      target={target}
      currentCard={`practice-${mode}`}
      creditSeq={creditSeq}
      centered
      dock={{ testID: `${mode}-again`, label: s.practiceTab.game.newRound, tone: 'next', onPress: onNewRound }}
    >
      <Text testID={`${mode}-done`} variant="title" style={[styles.doneTitle, { color: colors.text }]}>{s.practiceTab.game.roundDone}</Text>
      <Text testID={`${mode}-score`} style={[styles.score, { color: colors.text }]}>{s.practiceTab.game.score(score, total)}</Text>
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md },
  progress: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  emptyText: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, textAlign: 'center' },
  doneTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, textAlign: 'center' },
  score: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, textAlign: 'center' },
});
