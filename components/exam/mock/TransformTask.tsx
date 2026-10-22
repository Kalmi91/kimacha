import { Text, TextInput, View } from 'react-native';

import Colors from '@/constants/Colors';
import type { MockTransformTask } from '@/lib/exam/mock/types';
import { answerInputProps } from '@/lib/inputProps';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import MockTaskFrame from './MockTaskFrame';
import { mockStyles as styles, type MockKindProps } from './mockStyles';

// transform: the first sentence, the word to use (highlighted, in capitals), and the second sentence as
// `before [input] after`. The answer key: item index -> the typed words.

export default function TransformTask({ task, answer, onAnswer, glossary }: MockKindProps<MockTransformTask>) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().mockExam;
  return (
    <MockTaskFrame instruction={task.instruction} hint={s.mockHintTransform} glossary={glossary}>
      {task.items.map((item, i) => (
        <View key={i} style={styles.item}>
          <Text style={[styles.question, { color: colors.text }]}>
            {i + 1}. {item.first}
          </Text>
          <View style={[styles.keyBox, { borderColor: colors.tint }]}>
            <Text testID={`mock-transform-word-${i}`} accessibilityLabel={`${s.mockWordToUse}: ${item.key}`} style={[styles.bold, { color: colors.tint }]}>
              {item.key.toUpperCase()}
            </Text>
          </View>
          <View style={styles.row}>
            {item.before ? <Text style={[styles.body, { color: colors.text }]}>{item.before}</Text> : null}
            <TextInput
              testID={`mock-transform-${i}`}
              accessibilityLabel={s.mockGapLabel(i + 1)}
              {...answerInputProps}
              value={String(answer[String(i)] ?? '')}
              onChangeText={(v) => onAnswer(String(i), v)}
              style={[styles.input, styles.inlineInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
            />
            {item.after ? <Text style={[styles.body, { color: colors.text }]}>{item.after}</Text> : null}
          </View>
        </View>
      ))}
    </MockTaskFrame>
  );
}
