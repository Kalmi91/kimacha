import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing, tapTarget } from '@/constants/Theme';
import { Card } from '@/components/grammar/Brutal';
import ResultBadge from '@/components/ResultBadge';
import { sentenceBuildMatch } from '@/lib/answerMatch';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { hashString, shuffleArray } from '@/lib/shuffle';
import { useTheme } from '@/lib/ThemeContext';
import ExamButton from './ExamButton';

// PLAN-vizsga A. szakasz 2. lépés (A5 c): mondat-összerakás csempékkel. A kiinduló
// nyelvű mondatot a célnyelvre kell összerakni; a csapda-csempék tanult szavakból jönnek.
// Helyes építés után nincs visszajelzés (megy tovább), hibás után a helyes mondat látszik.
type Props = {
  prompt: string;
  answerTokens: string[];
  distractors: string[];
  onDone: (correct: boolean) => void;
};

export default function ExamTilesCard({ prompt, answerTokens, distractors, onDone }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  // Egyszer keverve, a pozíciók nem változnak (ugyanaz a seed ugyanazt a sorrendet adja).
  const [bank] = useState(() => shuffleArray([...answerTokens, ...distractors], hashString(prompt)));
  const [placed, setPlaced] = useState<number[]>([]);
  const [missed, setMissed] = useState(false);

  const add = (i: number) => {
    if (!missed && !placed.includes(i)) setPlaced([...placed, i]);
  };
  const remove = (pos: number) => {
    if (!missed) setPlaced(placed.filter((_, p) => p !== pos));
  };
  const check = () => {
    if (sentenceBuildMatch(placed.map((i) => bank[i]), answerTokens)) onDone(true);
    else setMissed(true);
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
        <Text style={[styles.label, { color: colors.textMuted }]}>{s.exam.buildSentence}</Text>
        <Text style={[styles.prompt, { color: colors.text }]}>{prompt}</Text>
        <View testID="exam-placed" style={[styles.placed, g.brutal && styles.brutalEdge, { borderColor: missed ? colors.danger : colors.border }]}>
          {placed.map((i, pos) => (
            <Pressable
              key={`${i}-${pos}`}
              accessibilityRole="button"
              onPress={() => remove(pos)}
              style={[styles.chip, g.brutal && styles.brutalEdge, { backgroundColor: colors.tint, borderColor: colors.tint }]}
            >
              <Text style={[styles.chipText, { color: colors.onTint }]}>{bank[i]}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.bank}>
          {bank.map((word, i) =>
            placed.includes(i) ? (
              <View key={i} style={[styles.chip, styles.slot, g.brutal && styles.brutalEdge, { borderColor: colors.border }]}>
                <Text style={[styles.chipText, styles.hidden]}>{word}</Text>
              </View>
            ) : (
              <Pressable
                key={i}
                accessibilityRole="button"
                onPress={() => add(i)}
                style={[styles.chip, g.brutal && styles.brutalEdge, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Text style={[styles.chipText, { color: colors.text }]}>{word}</Text>
              </Pressable>
            ),
          )}
        </View>
        {missed && (
          <View style={styles.reveal}>
            <ResultBadge correct={false} label={s.games.wrongFeedback} />
            <Text style={[styles.revealLabel, { color: colors.textMuted }]}>{s.exam.correctAnswer}</Text>
            <Text testID="exam-correct-answer" style={[styles.revealText, { color: colors.success }]}>
              {answerTokens.join(' ')}
            </Text>
          </View>
        )}
      </Card>
      {missed ? (
        <ExamButton testID="exam-next" label={`${s.card.next} →`} onPress={() => onDone(false)} />
      ) : (
        <ExamButton testID="exam-check" label={s.card.check} onPress={check} disabled={placed.length === 0} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  brutalCard: { padding: spacing.lg, gap: spacing.md },
  label: { fontSize: fontSize.sm, textAlign: 'center' },
  prompt: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, textAlign: 'center' },
  placed: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  bank: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  chip: {
    minHeight: tapTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  slot: { borderStyle: 'dashed' },
  brutalEdge: { borderRadius: 0, borderWidth: 2 },
  chipText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  hidden: { opacity: 0 },
  reveal: { gap: spacing.xs },
  revealLabel: { fontSize: fontSize.sm },
  revealText: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
});
