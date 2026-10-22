import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import Colors from '@/constants/Colors';
import { Card } from '@/components/grammar/Brutal';
import { countWords } from '@/lib/exam/mock/score';
import type { MockEssayTask } from '@/lib/exam/mock/types';
import { answerInputProps } from '@/lib/inputProps';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import MockPlayer from './MockPlayer';
import MockTaskFrame from './MockTaskFrame';
import { mockStyles as styles, type MockKindProps } from './mockStyles';
import { useMockAudio } from './useMockAudio';

// essay: with several choices one is active at a time (a chooser on top), then the prompt, the input (the text or
// recording to answer), a multiline field with a live word count against the range, and a sign under / over the range.
// The answer key: `choice` = the chosen id (none: the first choice, as the scoring reads it), `text`. Each choice keeps its own draft
// while the task is open, so switching does not lose what was typed.

export default function EssayTask({ task, answer, onAnswer, target, canSpeak, glossary }: MockKindProps<MockEssayTask>) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().mockExam;
  const audio = useMockAudio(target, task.plays);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const choice = task.choices.find((c) => c.id === answer.choice) ?? task.choices[0];
  if (!choice) return null;
  const text = String(answer.text ?? '');
  const words = countWords(text);
  const band = words < choice.minWords ? 'below' : words > choice.maxWords ? 'above' : 'in';

  const pick = (id: string) => {
    if (id === choice.id) return;
    setDrafts((d) => ({ ...d, [choice.id]: text }));
    onAnswer('choice', id);
    onAnswer('text', drafts[id] ?? '');
  };

  return (
    <MockTaskFrame instruction={task.instruction} hint={task.choices.length > 1 ? s.mockHintEssayChoose : s.mockHintEssay} glossary={glossary}>
      {task.choices.length > 1 && (
        <View style={styles.chipRow}>
          {task.choices.map((c) => {
            const on = c.id === choice.id;
            return (
              <Pressable
                key={c.id}
                testID={`mock-essay-choice-${c.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => pick(c.id)}
                style={[styles.wideChip, { backgroundColor: on ? colors.tint : colors.card, borderColor: on ? colors.tint : colors.border }]}
              >
                <Text style={[styles.chipText, { color: on ? colors.onTint : colors.text }]}>{c.title}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <Text testID="mock-essay-prompt" style={[styles.body, { color: colors.text }]}>
        {choice.prompt}
      </Text>
      {choice.audio?.length ? <MockPlayer audio={audio} id={`essay-${choice.id}`} lines={choice.audio} canSpeak={canSpeak} /> : null}
      {choice.input ? (
        <Card classicStyle={styles.optionCard} boxStyle={styles.optionCardBox}>
          <Text testID="mock-essay-input" style={[styles.body, { color: colors.text }]}>
            {choice.input}
          </Text>
        </Card>
      ) : null}
      <TextInput
        testID="mock-essay-text"
        accessibilityLabel={choice.title}
        {...answerInputProps}
        value={text}
        onChangeText={(v) => onAnswer('text', v)}
        multiline
        style={[styles.input, styles.textarea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
      />
      <Text testID="mock-essay-words" style={[styles.small, { color: colors.textMuted }]}>
        {s.mockWords(words, choice.minWords, choice.maxWords)}
      </Text>
      <Text testID={`mock-essay-band-${band}`} style={[styles.small, { color: band === 'in' ? colors.textMuted : colors.warning }]}>
        {band === 'below' ? `↓ ${s.mockWordsBelow}` : band === 'above' ? `↑ ${s.mockWordsAbove}` : `✓ ${s.mockWordsIn}`}
      </Text>
    </MockTaskFrame>
  );
}
