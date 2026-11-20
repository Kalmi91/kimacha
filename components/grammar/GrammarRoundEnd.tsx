import type { ReactElement } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/KText';
import { useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import type { ProgressRow, Phase } from '@/lib/grammar/useGrammarTopic';
import type { RoundStats } from '@/components/grammar/GrammarDrill';
import GrammarResult from '@/components/grammar/GrammarResult';
import { BrutalBox, SegmentBar, segmentsFilled, mutedColor } from '@/components/grammar/Brutal';
import { styles } from '@/components/grammar/GrammarTopic.styles';

// The round-end ("done") screen of a grammar lesson (FB691-FB695): the result as "14/20", the lesson progress, the
// "Mistakes:" list with every wrong answer of the round, and exactly two buttons: Retake and back to the grammar part.
// The lesson test is started from the lesson page, not from here.
interface Props {
  score: { correct: number; total: number };
  progressRows: ProgressRow[];
  roundStats: RoundStats | null;
  prevPct: number | null;
  header: ReactElement;
  lessonScoreOf: (rows: ProgressRow[]) => number | null;
  setPhase: (phase: Phase) => void;
  setScore: (score: null) => void;
}

export default function GrammarRoundEnd({ score, progressRows, roundStats, prevPct, header, lessonScoreOf, setPhase, setScore }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  const router = useRouter();
  const pct = score.total ? Math.round((score.correct / score.total) * 100) : 0;
  // the cumulative ratio computed from ALL rounds of the lesson so far, not just this round's score (`pct` above).
  const cumulativePct = lessonScoreOf(progressRows);
  const retake = () => {
    setScore(null);
    setPhase('drill');
  };
  const note = (
    <Text style={[styles.doneNote, { color: g.brutal ? g.ink : colors.tabIconDefault }]}>{pct >= 80 ? s.grammar.doneGood : s.grammar.doneAgain}</Text>
  );
  const progress =
    cumulativePct === null ? null : g.brutal ? (
      <BrutalBox boxStyle={styles.brutalProgressBox}>
        <SegmentBar segments={8} filled={segmentsFilled(cumulativePct, 8)} />
        <Text style={[styles.brutalStatLabel, { color: g.ink }]}>{s.grammar.progressChange(prevPct, cumulativePct)}</Text>
        <Text testID="grammar-lesson-percent" style={[styles.brutalStatLabel, { color: g.mu }]}>
          {s.grammar.lessonPercent(cumulativePct)}
        </Text>
      </BrutalBox>
    ) : (
      <Text testID="grammar-lesson-percent" style={[styles.lessonPercentNote, { color: mutedColor(g, colors.tabIconDefault) }]}>
        {s.grammar.lessonPercent(cumulativePct)}
      </Text>
    );
  return (
    <GrammarResult
      correct={score.correct}
      total={score.total}
      misses={roundStats?.misses ?? []}
      onRetake={retake}
      onBack={() => router.back()}
      header={header}
    >
      <View>{note}</View>
      {progress}
    </GrammarResult>
  );
}
