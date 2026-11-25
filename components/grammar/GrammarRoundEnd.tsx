import { useCallback, useState, type ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/KText';
import { useFocusEffect, useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import type { ProgressRow, Phase } from '@/lib/grammar/useGrammarTopic';
import type { RoundStats } from '@/components/grammar/GrammarDrill';
import GrammarResult from '@/components/grammar/GrammarResult';
import { BrutalBox, Card, SegmentBar, segmentsFilled, mutedColor, softTitleStyle } from '@/components/grammar/Brutal';
import { styles } from '@/components/grammar/GrammarTopic.styles';
import { getDb } from '@/lib/database';
import { GRAMMAR_PROGRESS_KEY, lessonFor } from '@/lib/grammar/syllabus';
import { formCheckCells, formCheckEnabled, formCheckProgressKey, parseFormCheckState, type FormCheckState } from '@/lib/grammar/formCheck';

// The round-end ("done") screen of a grammar lesson (FB691-FB695): the result as "14/20", the lesson progress, the
// "Mistakes:" list with every wrong answer of the round, and exactly two buttons: Retake and back to the grammar part.
// The lesson test is started from the lesson page, not from here.
interface Props {
  topicId?: string;
  learnedLang?: string;
  score: { correct: number; total: number };
  progressRows: ProgressRow[];
  roundStats: RoundStats | null;
  prevPct: number | null;
  header: ReactElement;
  lessonScoreOf: (rows: ProgressRow[]) => number | null;
  setPhase: (phase: Phase) => void;
  setScore: (score: null) => void;
}

export default function GrammarRoundEnd({ topicId, learnedLang = 'es', score, progressRows, roundStats, prevPct, header, lessonScoreOf, setPhase, setScore }: Props) {
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
        <Text style={[styles.brutalStatLabel, { color: g.ink }, softTitleStyle(g)]}>{s.grammar.progressChange(prevPct, cumulativePct)}</Text>
        <Text testID="grammar-lesson-percent" style={[styles.brutalStatLabel, { color: g.mu }, softTitleStyle(g)]}>
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
      {topicId && formCheckEnabled(topicId, learnedLang) ? <FormCheckCard topicId={topicId} /> : null}
    </GrammarResult>
  );
}

function FormCheckCard({ topicId }: { topicId: string }) {
  const router = useRouter();
  const { theme } = useTheme();
  const colors = Colors[theme];
  const labels = t().grammar.formCheck;
  const [saved, setSaved] = useState<FormCheckState | null>(null);
  const cells = formCheckCells(lessonFor('es', topicId));
  useFocusEffect(useCallback(() => {
    let active = true;
    void getDb().getGameProgress(GRAMMAR_PROGRESS_KEY).then((rows) => {
      const state = parseFormCheckState(rows.find((row) => row.itemId === formCheckProgressKey(topicId))?.data, formCheckCells(lessonFor('es', topicId)));
      if (active) setSaved(state);
    }).catch(() => {});
    return () => { active = false; };
  }, [topicId]));
  // a check left mid-way and an unpractised wrong list both resume on tap, so the card says so
  const left = !saved ? null : saved.phase === 'practice' ? saved.queue.length
    : saved.phase === 'check' && (saved.index > 0 || saved.result) ? saved.order.length - saved.index : null;
  const note = left !== null ? labels.continue(left) : saved?.phase === 'checkEnd' && saved.wrong.length > 0 ? labels.practice(saved.wrong.length) : null;
  return (
    <Pressable testID="grammar-formcheck-card" accessibilityRole="link" style={{ marginVertical: 12 }} onPress={() => router.push(`/grammar/form-check/${topicId}`)}>
      <Card classicStyle={{ backgroundColor: colors.card, padding: 16, borderRadius: 12 }}>
        <Text variant="title" style={{ color: colors.text }}>{labels.title}</Text>
        <Text style={{ color: colors.tabIconDefault }}>{note ?? labels.subtitle(cells.length)}</Text>
      </Card>
    </Pressable>
  );
}
