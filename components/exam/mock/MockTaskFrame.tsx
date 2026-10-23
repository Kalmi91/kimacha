import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import type { GlossaryEntry } from '@/lib/exam/mock/glossary';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import { mockStyles as styles } from './mockStyles';

// The frame every authored task shares: the instruction in the target language (as on a real paper), a short help in the
// interface language under it, the task itself, and the list of words the learner has not learned yet (tap to open).

type Props = {
  instruction: string;
  hint: string;
  glossary: GlossaryEntry[];
  children: ReactNode;
};

export default function MockTaskFrame({ instruction, hint, glossary, children }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().mockExam;
  const [showGlossary, setShowGlossary] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text testID="mock-instruction" style={[styles.instruction, { color: colors.tint }]}>
        {instruction}
      </Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text>
      {children}
      {glossary.length > 0 && (
        <View style={styles.glossary}>
          <Pressable testID="mock-glossary-toggle" accessibilityRole="button" style={styles.linkBox} onPress={() => setShowGlossary((v) => !v)}>
            <Text style={[styles.link, { color: colors.tint }]}>{showGlossary ? s.glossaryHide : s.glossaryShow(glossary.length)}</Text>
          </Pressable>
          {showGlossary &&
            glossary.map((e) => (
              <Text key={e.itemId} testID="mock-glossary-entry" style={[styles.small, { color: colors.text }]}>
                {e.term} = {e.meaning}
              </Text>
            ))}
        </View>
      )}
    </View>
  );
}
