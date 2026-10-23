import { Pressable, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import type { MockMcQuestion } from '@/lib/exam/mock/types';
import { useTheme } from '@/lib/ThemeContext';
import { letterOf, mockStyles as styles } from './mockStyles';

// The choosing parts shared by the authored kinds: an option row (the older kinds' option style), a numbered
// multiple-choice question, and a row of letter buttons (A..J) for matching and for the gapped text.

type OptionsProps = { options: string[]; picked: unknown; onPick: (index: number) => void; id: string };

export function MockOptions({ options, picked, onPick, id }: OptionsProps) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  return (
    <View style={styles.options}>
      {options.map((opt, i) => {
        const on = picked === i;
        return (
          <Pressable
            key={`${i}-${opt}`}
            testID={`mock-option-${id}-${i}`}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onPick(i)}
            style={[styles.option, { backgroundColor: on ? colors.tint : colors.card, borderColor: on ? colors.tint : colors.border }]}
          >
            <Text style={[styles.optionLetter, { color: on ? colors.onTint : colors.textMuted }]}>{letterOf(i)}</Text>
            <Text style={[styles.optionText, { color: on ? colors.onTint : colors.text }]}>{opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type QuestionProps = { n: number; question: MockMcQuestion; picked: unknown; onPick: (index: number) => void; id: string };

export function MockQuestion({ n, question, picked, onPick, id }: QuestionProps) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  return (
    <View style={styles.item}>
      <Text style={[styles.question, { color: colors.text }]}>{question.stem ? `${n}. ${question.stem}` : `${n}.`}</Text>
      <MockOptions options={question.options} picked={picked} onPick={onPick} id={id} />
    </View>
  );
}

type ChipsProps = {
  /** The ids of the choices; the button shows their position as a letter. */
  keys: string[];
  picked: unknown;
  /** Choices that sit at another place already (dimmed, but a tap moves them here). */
  taken?: ReadonlySet<string>;
  onPick: (key: string) => void;
  testID: (key: string) => string;
};

export function MockChips({ keys, picked, taken, onPick, testID }: ChipsProps) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  return (
    <View style={styles.chipRow}>
      {keys.map((key, i) => {
        const on = picked === key;
        return (
          <Pressable
            key={key}
            testID={testID(key)}
            accessibilityRole="button"
            accessibilityLabel={letterOf(i)}
            accessibilityState={{ selected: on }}
            onPress={() => onPick(key)}
            style={[styles.chip, { backgroundColor: on ? colors.tint : colors.card, borderColor: on ? colors.tint : colors.border, opacity: !on && taken?.has(key) ? 0.35 : 1 }]}
          >
            <Text style={[styles.chipText, { color: on ? colors.onTint : colors.text }]}>{letterOf(i)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
