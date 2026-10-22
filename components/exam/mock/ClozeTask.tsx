import { Text, TextInput, View } from 'react-native';

import Colors from '@/constants/Colors';
import type { MockClozeTask } from '@/lib/exam/mock/types';
import { answerInputProps } from '@/lib/inputProps';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import { MockOptions } from './MockChoice';
import MockPlayer from './MockPlayer';
import MockTaskFrame from './MockTaskFrame';
import MockTextBox, { GapParagraph } from './MockTextBox';
import { mockStyles as styles, type MockKindProps } from './mockStyles';
import { useMockAudio } from './useMockAudio';

// cloze: the text with numbered gaps, and under it one row per gap: the options (multiple choice) or an input (open gap;
// the word to transform stands beside it in capitals). With a recording (note completion) the player comes first.

/** What stands in the gap chip of the text once the gap is answered: the chosen word or the typed one, shortened. */
const SHOWN_MAX = 14;
const shorten = (text: string) => (text.length > SHOWN_MAX ? `${text.slice(0, SHOWN_MAX - 1)}…` : text);

export default function ClozeTask({ task, answer, onAnswer, target, canSpeak, glossary }: MockKindProps<MockClozeTask>) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().mockExam;
  const audio = useMockAudio(target, task.plays);
  const choiceGaps = task.gaps.filter((g) => 'options' in g).length;
  const hint = task.gaps.some((g) => 'stem' in g && g.stem)
    ? s.mockHintClozeStem
    : choiceGaps === task.gaps.length
      ? s.mockHintClozeChoice
      : choiceGaps === 0
        ? s.mockHintClozeOpen
        : s.mockHintClozeMixed;

  const shown = (n: number) => {
    const gap = task.gaps[n - 1];
    const given = answer[String(n - 1)];
    if (!gap) return String(n);
    if ('options' in gap) return typeof given === 'number' && gap.options[given] !== undefined ? `${n}: ${shorten(gap.options[given])}` : String(n);
    return typeof given === 'string' && given.trim() !== '' ? `${n}: ${shorten(given.trim())}` : String(n);
  };

  return (
    <MockTaskFrame instruction={task.instruction} hint={hint} glossary={glossary}>
      {task.audio?.length ? <MockPlayer audio={audio} id="task" lines={task.audio} canSpeak={canSpeak} /> : null}
      <MockTextBox
        testID="mock-cloze-text"
        title={task.title}
        text={task.text}
        scroll
        renderParagraph={(p) => <GapParagraph paragraph={p} color={colors.text} chipColor={colors.tint} label={shown} />}
      />
      {task.gaps.map((gap, i) =>
        'options' in gap ? (
          <View key={i} style={styles.item}>
            <Text style={[styles.question, { color: colors.text }]}>{s.mockGapLabel(i + 1)}</Text>
            <MockOptions options={gap.options} picked={answer[String(i)]} onPick={(o) => onAnswer(String(i), o)} id={`c${i}`} />
          </View>
        ) : (
          <View key={i} style={styles.row}>
            <Text style={[styles.question, { color: colors.text }]}>{i + 1}.</Text>
            <TextInput
              testID={`mock-cloze-${i}`}
              accessibilityLabel={s.mockGapLabel(i + 1)}
              {...answerInputProps}
              value={String(answer[String(i)] ?? '')}
              onChangeText={(v) => onAnswer(String(i), v)}
              style={[styles.input, styles.inlineInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
            />
            {gap.stem ? (
              <Text testID={`mock-cloze-stem-${i}`} style={[styles.bold, { color: colors.tint }]}>
                {gap.stem.toUpperCase()}
              </Text>
            ) : null}
          </View>
        ),
      )}
    </MockTaskFrame>
  );
}
