import { Text } from 'react-native';

import Colors from '@/constants/Colors';
import type { MockPassageMcTask } from '@/lib/exam/mock/types';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import { MockQuestion } from './MockChoice';
import MockPlayer from './MockPlayer';
import MockTaskFrame from './MockTaskFrame';
import MockTextBox from './MockTextBox';
import { mockStyles as styles, type MockKindProps } from './mockStyles';
import { useMockAudio } from './useMockAudio';

// passage_mc: a text (scrollable, with its title) or a recording, and under it the multiple-choice questions.

export default function PassageMcTask({ task, answer, onAnswer, target, canSpeak, glossary }: MockKindProps<MockPassageMcTask>) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().mockExam;
  const audio = useMockAudio(target, task.plays);
  const heard = !!task.audio?.length;
  return (
    <MockTaskFrame instruction={task.instruction} hint={heard ? s.mockHintPassageListen : s.mockHintPassageRead} glossary={glossary}>
      {heard ? (
        <>
          {task.title ? <Text style={[styles.question, { color: colors.text }]}>{task.title}</Text> : null}
          <MockPlayer audio={audio} id="task" lines={task.audio!} canSpeak={canSpeak} />
        </>
      ) : task.text ? (
        <MockTextBox testID="mock-passage" title={task.title} text={task.text} scroll />
      ) : null}
      {task.questions.map((q, i) => (
        <MockQuestion key={i} n={i + 1} question={q} picked={answer[String(i)]} onPick={(o) => onAnswer(String(i), o)} id={`q${i}`} />
      ))}
    </MockTaskFrame>
  );
}
