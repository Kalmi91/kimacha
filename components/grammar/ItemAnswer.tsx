import { StyleSheet } from 'react-native';
import { Text } from '@/components/KText';

import AnswerCompare from '@/components/grammar/AnswerCompare';
import { Card } from '@/components/grammar/Brutal';
import { useGrammarColors } from '@/lib/grammarColors';
import Colors from '@/constants/Colors';
import { fontSize, fontWeight, spacing } from '@/constants/Theme';
import { fixedSentence } from '@/lib/grammar/fixedSentence';
import type { BankItem, ClozeItem, ContentLang, FixItem, NounItem } from '@/lib/grammar/lessonTypes';
import { filledCloze, filledSentence } from '@/lib/grammar/typedKinds';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';

// The right answer and the why of a typed task item (open text, error correction, word bank, noun form), for the Small
// test's miss card: the drill components show the same texts under their own check, the card after a miss repeats them.
// With `given` (what the learner typed) the wrong letters are marked, the same letter diff as under a word card
// (AnswerCompare): a long sentence shows only the differing part.
export default function ItemAnswer({ item, contentLang, given }: { item: ClozeItem | FixItem | BankItem | NounItem; contentLang: ContentLang; given?: string | null }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const pick = (m: { en: string } & Partial<Record<ContentLang, string>>) => m[contentLang] ?? m.en;
  let answer: string;
  let why: string;
  let tr: string | null = null;
  switch (item.kind) {
    case 'opencloze':
      answer = filledCloze(item.text, item.answers);
      why = pick(item.why);
      tr = pick(item.tr);
      break;
    case 'fix':
      answer = fixedSentence(item.es, item.wrongIndex, item.answer);
      why = pick(item.explain);
      tr = pick(item.tr);
      break;
    case 'bank':
      answer = filledSentence(item.es, item.answer);
      why = pick(item.why);
      tr = pick(item.tr);
      break;
    case 'noun':
      answer = item.answer;
      why = pick(item.why);
      break;
  }
  // what the diff compares: the typed text is the whole sentence for the open cloze, one word / form for the others
  const compareTo = item.kind === 'opencloze' ? answer : item.answer;
  const compare = given && given.trim() !== '' ? <AnswerCompare typed={given} correct={compareTo} g={g} /> : null;
  return (
    <Card testID="small-test-miss-card" classicStyle={styles.card} boxStyle={styles.box}>
      {compare ?? <Text style={[styles.label, { color: colors.textMuted }]}>{t().exam.correctAnswer}</Text>}
      {compare && item.kind === 'opencloze' ? null : <Text testID="small-test-miss-answer" style={[styles.answer, { color: colors.success }]}>{answer}</Text>}
      {tr ? <Text testID="small-test-miss-tr" style={[styles.line, { color: colors.textMuted }]}>{tr}</Text> : null}
      {why ? <Text testID="small-test-miss-why" style={[styles.line, { color: colors.text }]}>{why}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, gap: spacing.sm },
  box: { padding: spacing.lg, gap: spacing.sm },
  label: { fontSize: fontSize.sm, textAlign: 'center' },
  answer: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, textAlign: 'center' },
  line: { fontSize: fontSize.md, textAlign: 'center' },
});
