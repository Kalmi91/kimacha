import { Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import type { MockClipsMcTask } from '@/lib/exam/mock/types';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import { MockQuestion } from './MockChoice';
import MockPlayer from './MockPlayer';
import MockTaskFrame from './MockTaskFrame';
import MockTextBox from './MockTextBox';
import { mockStyles as styles, type MockKindProps } from './mockStyles';
import { useMockAudio } from './useMockAudio';

// clips_mc: several short texts or recordings, each with its own questions. The questions are numbered across the
// clips, and so is the answer key (the question index counted across the clips).

export default function ClipsMcTask({ task, answer, onAnswer, target, canSpeak, glossary }: MockKindProps<MockClipsMcTask>) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().mockExam;
  const audio = useMockAudio(target, task.plays);
  // The index of each clip's first question.
  const starts = task.clips.map((_, i) => task.clips.slice(0, i).reduce((n, c) => n + c.questions.length, 0));
  const anyAudio = task.clips.some((c) => c.audio?.length);
  return (
    <MockTaskFrame instruction={task.instruction} hint={anyAudio ? s.mockHintClipsListen : s.mockHintClipsRead} glossary={glossary}>
      {task.clips.map((clip, ci) => {
        const heard = !!clip.audio?.length;
        return (
          <View key={ci} testID={`mock-clip-${ci}`} style={styles.item}>
            <Text style={[styles.bold, { color: colors.tint }]}>{heard ? s.recording(ci + 1) : s.mockClipText(ci + 1)}</Text>
            {heard ? <MockPlayer audio={audio} id={`clip${ci}`} lines={clip.audio!} canSpeak={canSpeak} testKey={String(ci)} /> : clip.text ? <MockTextBox text={clip.text} /> : null}
            {clip.questions.map((q, qi) => {
              const n = starts[ci] + qi;
              return <MockQuestion key={qi} n={n + 1} question={q} picked={answer[String(n)]} onPick={(o) => onAnswer(String(n), o)} id={`q${n}`} />;
            })}
          </View>
        );
      })}
    </MockTaskFrame>
  );
}
