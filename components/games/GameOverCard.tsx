import { Pressable, StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';

// GAMES.md 3.: "eredmény, rekord, 'Újra' / 'Vissza'". Score + best-score
// pulled straight from lib/games/scoring.ts's recordGameResult() result.

interface Props {
  score: number;
  best: number;
  isNewBest: boolean;
  onPlayAgain: () => void;
  onExit: () => void;
}

export default function GameOverCard({ score, best, isNewBest, onPlayAgain, onExit }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  return (
    <View style={styles.overlay}>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        {isNewBest ? <Text style={styles.newBest}>🏆 {s.games.newBest}</Text> : null}
        <Text style={[styles.scoreLabel, { color: colors.tabIconDefault }]}>{s.games.score}</Text>
        <Text style={[styles.score, { color: colors.text }]}>{score}</Text>
        <Text style={[styles.best, { color: colors.tabIconDefault }]}>
          {s.games.best}: {best}
        </Text>
        <View style={styles.buttons}>
          <Pressable style={[styles.btn, styles.btnGhost, { borderColor: colors.tint }]} onPress={onExit}>
            <Text style={[styles.btnGhostText, { color: colors.tint }]}>{s.games.backToHub}</Text>
          </Pressable>
          <Pressable style={[styles.btn, { backgroundColor: colors.tint }]} onPress={onPlayAgain}>
            <Text style={styles.btnText}>{s.games.playAgain}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    width: '85%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 4,
  },
  newBest: {
    fontSize: 18,
    fontWeight: '700',
    color: '#22C55E',
    marginBottom: 8,
  },
  scoreLabel: {
    fontSize: 14,
    textTransform: 'uppercase',
  },
  score: {
    fontSize: 48,
    fontWeight: '800',
  },
  best: {
    fontSize: 14,
    marginBottom: 20,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  btnGhostText: {
    fontWeight: '600',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
