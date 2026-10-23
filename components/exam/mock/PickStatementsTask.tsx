import { Pressable, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import type { MockPickStatementsTask } from '@/lib/exam/mock/types';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import MockPlayer from './MockPlayer';
import MockTaskFrame from './MockTaskFrame';
import MockTextBox from './MockTextBox';
import { mockStyles as styles, type MockKindProps } from './mockStyles';
import { useMockAudio } from './useMockAudio';

// pick_statements: a list of statements with a mark each; at most `pick` of them can be marked, the counter shows "3 / 6".
// The answer key: statement index -> true (an unmarked one is null).

export default function PickStatementsTask({ task, answer, onAnswer, target, canSpeak, glossary }: MockKindProps<MockPickStatementsTask>) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().mockExam;
  const audio = useMockAudio(target, task.plays);
  const picked = task.statements.filter((_, i) => answer[String(i)] === true).length;

  const toggle = (i: number) => {
    if (answer[String(i)] === true) onAnswer(String(i), null);
    else if (picked < task.pick) onAnswer(String(i), true);
  };

  return (
    <MockTaskFrame instruction={task.instruction} hint={s.mockHintPick(task.pick)} glossary={glossary}>
      {task.audio?.length ? <MockPlayer audio={audio} id="task" lines={task.audio} canSpeak={canSpeak} /> : task.text ? <MockTextBox testID="mock-passage" text={task.text} scroll /> : null}
      <Text testID="mock-pick-count" style={[styles.bold, { color: picked >= task.pick ? colors.tint : colors.textMuted }]}>
        {s.mockPickCount(picked, task.pick)}
      </Text>
      <View style={styles.options}>
        {task.statements.map((statement, i) => {
          const on = answer[String(i)] === true;
          return (
            <Pressable
              key={i}
              testID={`mock-statement-${i}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => toggle(i)}
              style={[styles.statement, { backgroundColor: on ? colors.tint : colors.card, borderColor: on ? colors.tint : colors.border }]}
            >
              <Text style={[styles.statementMark, { color: on ? colors.onTint : colors.textMuted }]}>{on ? '☑' : '☐'}</Text>
              <Text style={[styles.optionText, { color: on ? colors.onTint : colors.text }]}>{statement}</Text>
            </Pressable>
          );
        })}
      </View>
    </MockTaskFrame>
  );
}
