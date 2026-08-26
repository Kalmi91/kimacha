import type { ReactNode } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';

// GAMES.md 3. (F0): "közös keret: fejléc, pont, élet, idő, szünet,
// kilépés-megerősítés". Every game screen wraps its board in this; GameShell
// itself never touches game logic, it only shows what its props say and
// reports taps back (exit confirmed, pause toggled).
//
// Pausing itself (freezing the clock) lives in lib/games/session.ts's
// useGameSession(); the `paused` prop here only controls the visual overlay.
// K2 DÖNTÉS: the gloss bubble (GlossText) also calls session.pause()/resume(),
// but its own bubble already covers the screen, so a game wiring GlossText's
// onOpenGloss to session.pause should pass `pauseOverlay={false}` to avoid a
// second, redundant "Szünet" card stacking under the bubble.

interface Props {
  title: string;
  score?: number;
  lives?: number;
  timeLabel?: string;
  paused?: boolean;
  pauseOverlay?: boolean; // default true
  onPauseToggle?: () => void;
  onExit: () => void;
  children: ReactNode;
}

export default function GameShell({
  title,
  score,
  lives,
  timeLabel,
  paused = false,
  pauseOverlay = true,
  onPauseToggle,
  onExit,
  children,
}: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  const confirmExit = () => {
    const confirmTitle = s.games.exitConfirmTitle;
    const message = s.games.exitConfirmMessage;
    if (Platform.OS === 'web') {
      if (window.confirm(`${confirmTitle}\n${message}`)) onExit();
      return;
    }
    Alert.alert(confirmTitle, message, [
      { text: s.games.exitConfirmNo, style: 'cancel' },
      { text: s.games.exitConfirmYes, style: 'destructive', onPress: onExit },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={confirmExit} style={styles.headerBtn} hitSlop={12}>
          <Text style={[styles.headerBtnText, { color: colors.text }]}>←</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {onPauseToggle ? (
          <Pressable onPress={onPauseToggle} style={styles.headerBtn} hitSlop={12}>
            <Text style={styles.headerBtnText}>{paused ? '▶️' : '⏸️'}</Text>
          </Pressable>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

      {score !== undefined || lives !== undefined || timeLabel ? (
        <View style={styles.statRow}>
          {score !== undefined ? <Text style={[styles.stat, { color: colors.text }]}>⭐ {score}</Text> : null}
          {lives !== undefined ? <Text style={styles.stat}>{'❤️'.repeat(Math.max(0, lives))}</Text> : null}
          {timeLabel ? <Text style={[styles.stat, { color: colors.text }]}>⏱ {timeLabel}</Text> : null}
        </View>
      ) : null}

      <View style={styles.body}>{children}</View>

      {paused && pauseOverlay ? (
        <View style={styles.pausedOverlay} pointerEvents="box-none">
          <View style={[styles.pausedCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.pausedText, { color: colors.text }]}>{s.games.paused}</Text>
            {onPauseToggle ? (
              <Pressable style={[styles.resumeBtn, { backgroundColor: colors.tint }]} onPress={onPauseToggle}>
                <Text style={styles.resumeBtnText}>{s.games.resume}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnText: {
    fontSize: 22,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 8,
  },
  stat: {
    fontSize: 16,
    fontWeight: '600',
  },
  body: {
    flex: 1,
  },
  pausedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  pausedCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
  },
  pausedText: {
    fontSize: 20,
    fontWeight: '700',
  },
  resumeBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 24,
  },
  resumeBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
