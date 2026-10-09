import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';

import { charDiff } from '@/lib/charDiff';
import { t } from '@/lib/i18n';
import type { GrammarColors } from '@/lib/grammarColors';

// on a wrong answer the learner's own answer and the correct one appear one under the other, with
// the difference highlighted in both rows: in the own row the wrong letters on an inverted (dark)
// field and struck through, in the correct row the missing / differing letters on the fill colour
// and underlined. The shape (inverted field, strikethrough, underline) signals too, not only the
// colour. A difference in case is not a mistake, one in accents is (the same as the grading of the
// conjugation drill and the diff of the table deck).
// Character-level comparison: lib/charDiff.ts.
export default function AnswerCompare({
  typed,
  correct,
  g,
  onFill = false,
}: {
  typed: string;
  correct: string;
  g: GrammarColors;
  // true if it sits inside a box with a coloured fill (e.g. b): the text uses the on-fill colour.
  onFill?: boolean;
}) {
  const s = t();
  const base = onFill ? g.onB : g.ink;
  const muted = onFill ? g.onB : g.mu;
  const fold = { case: true, accents: false };
  // The own row: the non-matching letters are marked; the omitted letters (missing) are not the
  // learner's writing, so they do not appear here, only in the correct row.
  const typedChars = typed.trim().length > 0 ? charDiff(typed, correct, fold).filter((d) => !d.missing) : [];
  // The correct row: a letter that is not in the learner's answer is highlighted.
  const correctChars = charDiff(correct, typed, fold).filter((d) => !d.missing);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: muted }]}>{s.grammar.yourAnswer}</Text>
      <Text testID="answer-compare-typed" style={[styles.line, { color: base }]}>
        {typedChars.length === 0 ? ', ' : null}
        {typedChars.map((d, i) => (
          <Text
            key={i}
            style={d.wrong ? { backgroundColor: g.ink, color: g.bg, textDecorationLine: 'line-through' } : undefined}
          >
            {d.ch}
          </Text>
        ))}
      </Text>
      <Text style={[styles.label, { color: muted }]}>{s.grammar.correctAnswer}</Text>
      <Text testID="answer-compare-correct" style={[styles.line, { color: base }]}>
        {correctChars.map((d, i) => (
          <Text
            key={i}
            style={d.wrong ? { backgroundColor: g.a, color: g.onFill, textDecorationLine: 'underline' } : undefined}
          >
            {d.ch}
          </Text>
        ))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 4 },
  line: { fontSize: 20, fontWeight: '700', flexShrink: 1 },
});
