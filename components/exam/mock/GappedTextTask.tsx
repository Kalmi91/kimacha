import { Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import type { MockGappedTextTask } from '@/lib/exam/mock/types';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import { MockChips } from './MockChoice';
import MockTaskFrame from './MockTaskFrame';
import MockTextBox, { GapParagraph, gapNumbers } from './MockTextBox';
import { letterOf, mockStyles as styles, type MockKindProps } from './mockStyles';

// gapped_text: the text with a numbered chip at every `{{n}}`, the list of the fragments (letter + text), and per gap a row
// of letter buttons to pick its fragment. A fragment fits one gap only: picking it for another gap moves it.

export default function GappedTextTask({ task, answer, onAnswer, glossary }: MockKindProps<MockGappedTextTask>) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().mockExam;
  const gaps = gapNumbers(task.text);
  const fragmentIds = task.fragments.map((f) => f.id);
  const letterOfFragment = (id: unknown) => {
    const at = fragmentIds.indexOf(String(id));
    return at < 0 ? null : letterOf(at);
  };
  const gapOf = (fragmentId: string) => gaps.find((g) => answer[String(g)] === fragmentId);
  const used = new Set(gaps.map((g) => answer[String(g)]).filter((v): v is string => typeof v === 'string'));

  const choose = (gap: number, fragmentId: string) => {
    if (answer[String(gap)] === fragmentId) {
      onAnswer(String(gap), null);
      return;
    }
    for (const g of gaps) if (g !== gap && answer[String(g)] === fragmentId) onAnswer(String(g), null);
    onAnswer(String(gap), fragmentId);
  };

  return (
    <MockTaskFrame instruction={task.instruction} hint={s.mockHintGapped} glossary={glossary}>
      <MockTextBox
        testID="mock-gapped-text"
        title={task.title}
        text={task.text}
        scroll
        renderParagraph={(p) => (
          <GapParagraph paragraph={p} color={colors.text} chipColor={colors.tint} label={(n) => `${n}${letterOfFragment(answer[String(n)]) ? `: ${letterOfFragment(answer[String(n)])}` : ''}`} />
        )}
      />
      <Text style={[styles.question, { color: colors.text }]}>{s.mockFragments}</Text>
      <View style={[styles.box, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {task.fragments.map((f, i) => (
          <Text key={f.id} testID={`mock-fragment-card-${f.id}`} style={[styles.body, { color: colors.text }]}>
            <Text style={[styles.bold, { color: colors.tint }]}>{letterOf(i)}. </Text>
            {f.text}
            {gapOf(f.id) !== undefined ? <Text style={{ color: colors.textMuted }}>{`  → ${gapOf(f.id)}`}</Text> : null}
          </Text>
        ))}
      </View>
      {gaps.map((gap) => (
        <View key={gap} style={styles.item}>
          <Text style={[styles.question, { color: colors.text }]}>{s.mockGapLabel(gap)}</Text>
          <MockChips
            keys={fragmentIds}
            picked={answer[String(gap)]}
            taken={used}
            onPick={(fragmentId) => choose(gap, fragmentId)}
            testID={(fragmentId) => `mock-fragment-${gap}-${fragmentId}`}
          />
        </View>
      ))}
    </MockTaskFrame>
  );
}
