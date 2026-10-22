import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { Card } from '@/components/grammar/Brutal';
import type { MockMatchPoolTask } from '@/lib/exam/mock/types';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import { MockChips } from './MockChoice';
import MockPlayer from './MockPlayer';
import MockTaskFrame from './MockTaskFrame';
import { letterOf, mockStyles as styles, type MockKindProps } from './mockStyles';
import { useMockAudio } from './useMockAudio';

// match_pool: the options on cards (letter, title, text; a long text folds), and under them one row of letter buttons per
// prompt (a text or a recording). `unique`: a letter that is used at another prompt moves to the one just tapped.

/** A text longer than this folds to three lines on its card. */
const FOLD_AT = 200;

export default function MatchPoolTask({ task, answer, onAnswer, target, canSpeak, glossary }: MockKindProps<MockMatchPoolTask>) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().mockExam;
  const audio = useMockAudio(target, task.plays);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const optionIds = task.options.map((o) => o.id);
  const used = new Set(task.prompts.map((p) => answer[p.id]).filter((v): v is string => typeof v === 'string'));

  const choose = (promptId: string, optionId: string) => {
    if (answer[promptId] === optionId) {
      onAnswer(promptId, null);
      return;
    }
    if (task.unique) for (const p of task.prompts) if (p.id !== promptId && answer[p.id] === optionId) onAnswer(p.id, null);
    onAnswer(promptId, optionId);
  };

  return (
    <MockTaskFrame instruction={task.instruction} hint={task.unique ? s.mockHintMatchUnique : s.mockHintMatch} glossary={glossary}>
      {task.options.map((opt, i) => {
        const long = opt.text.length > FOLD_AT;
        const unfolded = !!open[opt.id];
        return (
          <Card key={opt.id} classicStyle={styles.optionCard} boxStyle={styles.optionCardBox}>
            <Text testID={`mock-card-${opt.id}`} style={[styles.bold, { color: colors.tint }]}>
              {`${letterOf(i)}${opt.title ? `. ${opt.title}` : ''}`}
            </Text>
            <Text style={[styles.body, { color: colors.text }]} numberOfLines={long && !unfolded ? 3 : undefined}>
              {opt.text}
            </Text>
            {long && (
              <Pressable testID={`mock-card-toggle-${opt.id}`} accessibilityRole="button" style={styles.linkBox} onPress={() => setOpen((o) => ({ ...o, [opt.id]: !unfolded }))}>
                <Text style={[styles.link, { color: colors.tint }]}>{unfolded ? s.mockShowLess : s.mockShowMore}</Text>
              </Pressable>
            )}
          </Card>
        );
      })}
      {task.prompts.map((prompt, i) => (
        <View key={prompt.id} testID={`mock-prompt-${prompt.id}`} style={styles.item}>
          {prompt.audio?.length ? (
            <>
              <Text style={[styles.question, { color: colors.text }]}>{s.recording(i + 1)}</Text>
              <MockPlayer audio={audio} id={prompt.id} lines={prompt.audio} canSpeak={canSpeak} testKey={prompt.id} />
            </>
          ) : (
            <Text style={[styles.question, { color: colors.text }]}>
              {i + 1}. {prompt.text}
            </Text>
          )}
          <MockChips
            keys={optionIds}
            picked={answer[prompt.id]}
            taken={task.unique ? used : undefined}
            onPick={(optionId) => choose(prompt.id, optionId)}
            testID={(optionId) => `mock-match-${prompt.id}-${optionId}`}
          />
        </View>
      ))}
    </MockTaskFrame>
  );
}
