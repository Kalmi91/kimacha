import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BetaSticker } from '@/components/BetaSticker';
import { Text } from '@/components/KText';
import ExamStrip from '@/components/grammar/ExamStrip';
import Colors from '@/constants/Colors';
import type { Level } from '@/data/words';
import { EXAM_LEVELS } from '@/lib/exam/types';
import { levelHasLesson } from '@/lib/exam/unlock';
import { useExamStatus } from '@/lib/exam/useExamStatus';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import ScreenFeedback from '@/lib/screenFeedback';
import { useTheme } from '@/lib/ThemeContext';

// The Exam tab (after Grammar): a level picker over the levels that have a lesson, and the exam strip of the picked level.
// The levels above A1 carry a Beta sticker; the A1 exam part is finished.
export default function ExamTab() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  const { learnedLang, contentLang, evidence, examStatus } = useExamStatus();
  const [picked, setPicked] = useState<Level | null>(null);

  const levels: Level[] = EXAM_LEVELS.filter((l) => levelHasLesson(l, learnedLang)) as Level[];
  const shown = picked && levels.includes(picked) ? picked : levels.includes('A1') ? 'A1' : levels[0];
  const ink = g.brutal ? g.ink : colors.text;

  return (
    <View style={[styles.screen, { backgroundColor: g.brutal ? g.bg : colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {g.brutal ? (
          <Text variant="title" accessibilityRole="header" style={[styles.title, { color: ink }]}>{s.tabs.exam}</Text>
        ) : null}
        <View style={styles.levels}>
          {levels.map((l) => {
            const on = l === shown;
            return (
              <Pressable
                key={l}
                testID={`exam-tab-level-${l}`}
                accessibilityRole="button"
                accessibilityLabel={l}
                accessibilityState={{ selected: on }}
                onPress={() => setPicked(l)}
                style={[
                  styles.levelButton,
                  g.brutal
                    ? { borderColor: g.ink, backgroundColor: on ? g.a : g.paper }
                    : { borderColor: on ? colors.tint : colors.border, backgroundColor: on ? colors.tint : colors.card },
                ]}
              >
                <Text style={[styles.levelText, { color: on ? (g.brutal ? g.onFill : colors.onTint) : ink }]}>{l}</Text>
              </Pressable>
            );
          })}
        </View>
        {shown ? (
          <>
            {shown !== 'A1' ? (
              <View style={styles.levelHead}>
                <Text style={[styles.levelName, { color: ink }]}>{shown}</Text>
                <BetaSticker testID={`beta-sticker-exam-${shown}`} />
              </View>
            ) : null}
            <ExamStrip level={shown} learnedLang={learnedLang} contentLang={contentLang} evidence={evidence} examStatus={examStatus.get(shown)} />
          </>
        ) : null}
      </ScrollView>
      <ScreenFeedback placement="header" level={shown ?? '-'} languagePair={`${contentLang}→${learnedLang}`} currentCard="exam-tab" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  levels: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  levelButton: { minWidth: 56, minHeight: 44, paddingHorizontal: 14, borderWidth: 2, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  levelText: { fontSize: 15, fontWeight: '700' },
  levelHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  levelName: { fontSize: 17, fontWeight: '700' },
});
