import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing } from '@/constants/Theme';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import type { LessonTestQuestion } from '@/lib/grammar/lessonTest';
import { diffWords, type ResultTable } from '@/lib/grammar/resultDetail';
import { Card } from '@/components/grammar/Brutal';
import ResultBadge from '@/components/ResultBadge';
import ExamButton from '@/components/exam/ExamButton';
import { FAB_CLEARANCE } from '@/components/learn/DockedAction';

// The card after EVERY answer in the level test (FB571, FB578-580, FB588, FB589): the test no longer moves on by itself.
// Right: a green badge, the filled sentence with the right word in green, its translation, "Why not the others?" in place.
// Wrong: what was chosen or typed (the differing words marked), the right answer, the translation, the why, every wrong
// option's text, and for a form task the table with the asked cell. Next stays visible under the scrolling body; the lesson
// opens with a push (back returns to the test, nothing is lost).
export default function LevelTestFeedback({
  q,
  topicTitle,
  ok,
  given,
  onNext,
  onRule,
  practiceCount = 0,
  onPractice,
}: {
  q: LessonTestQuestion;
  topicTitle: string;
  ok: boolean;
  /** What was pressed or typed; absent for "I don't know". */
  given?: string;
  onNext: () => void;
  onRule: () => void;
  /** The test's wrong-answer card: "Practice this · N" below Next (the Practice run itself passes none). */
  practiceCount?: number;
  onPractice?: () => void;
}) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().randomRound;
  const l = t().levelTest;
  const [whyNotOpen, setWhyNotOpen] = useState(false);
  const d = q.detail;
  const card = q.view.card;
  const marks = card === 'type' || card === 'tiles';
  const diff = !ok && marks && given !== undefined && q.review.answer !== '' ? diffWords(given, q.review.answer) : null;
  const givenLabel = card === 'type' ? l.youTyped : card === 'tiles' ? l.youBuilt : l.youChose;
  const hasWhyNot = !!d?.whyNot && d.whyNot.length > 0;
  // after a wrong typed answer: its own text, or which other form it is, else the rule before the table
  const typedText = !ok && card === 'type' ? (given !== undefined ? d?.explainTyped?.(given) : null) || (d?.table ? undefined : d?.rule) : undefined;

  const whyNotList = hasWhyNot ? (
    <View testID="level-test-whynot" style={styles.group}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{l.whyNotTitle}</Text>
      {[...d!.whyNot!]
        .sort((a, b) => Number(b.option === given) - Number(a.option === given))
        .map((w) => (
          <Text key={w.option} style={[styles.why, { color: colors.text }]}>
            <Text style={{ fontWeight: fontWeight.bold }}>{w.option}</Text>
            {`: ${w.text}`}
          </Text>
        ))}
    </View>
  ) : null;

  const words = (list: { w: string; diff: boolean }[], bad: boolean): ReactNode =>
    list.map((x, i) => (
      <Text
        key={i}
        style={
          x.diff
            ? bad
              ? { color: colors.danger, textDecorationLine: 'line-through' }
              : { color: colors.success, fontWeight: fontWeight.bold }
            : undefined
        }
      >
        {i > 0 ? ' ' : ''}
        {x.w}
      </Text>
    ));

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text testID="level-test-topic" style={[styles.topicTitle, { color: colors.text }]}>
          {topicTitle}
        </Text>
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          <ResultBadge testID="level-test-feedback-badge" correct={ok} label={ok ? s.correct : s.wrong} />
          {ok && d?.filled ? (
            <Text testID="level-test-feedback-sentence" style={[styles.question, { color: colors.text }]}>
              {d.filled.before}
              <Text style={{ color: colors.success, fontWeight: fontWeight.bold }}>{d.filled.word}</Text>
              {d.filled.after}
            </Text>
          ) : (
            <Text testID="level-test-feedback-question" style={[styles.question, { color: colors.text }]}>
              {q.review.question}
            </Text>
          )}
          {!ok && given !== undefined && given !== '' ? (
            <Text testID="level-test-feedback-given" style={[styles.line, { color: colors.text }]}>
              {`${givenLabel}: `}
              {diff ? words(diff.typed, true) : <Text style={{ color: colors.danger, textDecorationLine: 'line-through' }}>{given}</Text>}
            </Text>
          ) : null}
          {q.review.answer !== '' && (ok ? !d?.filled : true) ? (
            <>
              <Text style={[styles.label, { color: colors.textMuted, textAlign: 'center' }]}>{t().exam.correctAnswer}</Text>
              <Text testID="level-test-feedback-answer" style={[styles.answer, { color: colors.success }]}>
                {diff ? words(diff.right, false) : q.review.answer}
              </Text>
            </>
          ) : null}
          {d?.tr ? (
            <Text testID="level-test-feedback-tr" style={[styles.tr, { color: colors.textMuted }]}>
              {d.tr}
            </Text>
          ) : null}
          {!ok && q.review.why && q.review.why !== d?.tr ? (
            <Text testID="level-test-feedback-why" style={[styles.why, { color: colors.textMuted }]}>
              {q.review.why}
            </Text>
          ) : null}
          {typedText ? (
            <Text testID="level-test-feedback-typed" style={[styles.why, { color: colors.text }]}>
              {typedText}
            </Text>
          ) : null}
          {!ok ? whyNotList : null}
          {ok && hasWhyNot ? (
            whyNotOpen ? (
              whyNotList
            ) : (
              <Pressable testID="level-test-whynot-link" accessibilityRole="button" onPress={() => setWhyNotOpen(true)}>
                <Text style={[styles.link, { color: colors.tint }]}>{l.whyNotLink}</Text>
              </Pressable>
            )
          ) : null}
          {!ok && d?.table ? <TableView table={d.table} /> : null}
        </Card>
      </ScrollView>
      <View style={styles.buttons}>
        <ExamButton testID="level-test-next" label={s.next} onPress={onNext} />
        {!ok && onPractice && practiceCount > 0 ? (
          <ExamButton testID="level-test-practice" secondary label={l.practiceButton(practiceCount)} onPress={onPractice} />
        ) : null}
        <ExamButton testID="level-test-rule" secondary label={l.openLesson} onPress={onRule} />
      </View>
    </View>
  );
}

export function TableView({
  table,
  compact = false,
  onHighlightLayout,
}: {
  table: ResultTable;
  /** Smaller rows and no title: for the Practice rule box above the keyboard. */
  compact?: boolean;
  /** The y of the highlighted row inside the table, so a scroll box can bring it into view. */
  onHighlightLayout?: (y: number) => void;
}) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  return (
    <View testID="level-test-table" style={styles.group}>
      {compact ? null : <Text style={[styles.label, { color: colors.textMuted }]}>{table.title}</Text>}
      <View style={[styles.table, { borderColor: colors.border }]}>
        <View style={styles.row}>
          {table.header.map((h, c) => (
            <Text key={c} style={[styles.cell, compact && styles.cellCompact, styles.headCell, { color: colors.textMuted }]}>
              {h}
            </Text>
          ))}
        </View>
        {table.rows.map((row, r) => (
          <View key={r} style={styles.row} onLayout={table.hl?.row === r && onHighlightLayout ? (e) => onHighlightLayout(e.nativeEvent.layout.y) : undefined}>
            {row.map((cell, c) => {
              const hl = table.hl?.row === r && table.hl.col === c;
              return (
                <Text
                  key={c}
                  testID={hl ? 'level-test-table-hl' : undefined}
                  style={[styles.cell, compact && styles.cellCompact, { color: colors.text }, hl && { backgroundColor: colors.successFill, fontWeight: fontWeight.bold }]}
                >
                  {cell}
                </Text>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.md },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  brutalCard: { padding: spacing.lg, gap: spacing.md },
  topicTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, textAlign: 'center', marginTop: spacing.sm },
  question: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  line: { fontSize: fontSize.md },
  label: { fontSize: fontSize.sm },
  answer: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, textAlign: 'center' },
  tr: { fontSize: fontSize.sm, fontStyle: 'italic' },
  why: { fontSize: fontSize.sm },
  link: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  group: { gap: spacing.xs },
  table: { borderWidth: 1, borderRadius: radius.sm, overflow: 'hidden' },
  row: { flexDirection: 'row' },
  cell: { flex: 1, fontSize: fontSize.sm, padding: spacing.xs },
  cellCompact: { paddingVertical: 2 },
  headCell: { fontWeight: fontWeight.semibold },
  buttons: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: FAB_CLEARANCE },
});
