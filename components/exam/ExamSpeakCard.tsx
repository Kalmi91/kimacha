import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing } from '@/constants/Theme';
import { Card, brutalInputStyle } from '@/components/grammar/Brutal';
import ResultBadge from '@/components/ResultBadge';
import { compareDictation, type DictationResult, type DictationWord } from '@/lib/exam/dictation';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import ExamButton from './ExamButton';

// PLAN-vizsga D. szakasz 13. lépés (Kálmán, D1 b + D3): szóbeli tétel a billentyűzet mikrofonjával.
// A tanuló a szövegmező billentyűzetének mikrofon-gombjával mondja el a mondatot, a diktált szöveg a
// mezőbe kerül; az app összeveti a várt mondattal (lib/exam/dictation.ts). Saját beszédfelismerő,
// mikrofon-engedély és natív kód nincs. Helyes mondat után NINCS visszajelzés (a vizsga megy
// tovább); hibás után az eltérő szavak ki vannak emelve mindkét oldalon, és a "Next" lép tovább.
// Újrahasználható: a próbavizsga szóbeli része és a későbbi beszéd-gyakorló is ezt a kártyát hívja.
type Props = {
  /** Amit a tanuló lát: `translate` módban a kiinduló nyelvű mondat, `repeat` módban a célnyelvi. */
  prompt: string;
  /** A várt célnyelvi mondat. */
  expected: string;
  /** `translate` = fordítsd le és mondd el; `repeat` = olvasd fel a látott mondatot. */
  mode: 'translate' | 'repeat';
  /** A tanult nyelv kódja: a felirathoz és a spanyol névmás-elhagyás szabályához. */
  targetLang: string;
  /** A "Accents count" beállítás. */
  strictAccents: boolean;
  onDone: (correct: boolean) => void;
};

function Words({ words, flag, base, mark, testID }: { words: DictationWord[]; flag: string; base: string; mark: string; testID: string }) {
  return (
    <Text testID={testID} style={[styles.revealText, { color: base }]}>
      {words.map((w, i) => (
        <Text key={i} testID={w.ok ? undefined : flag} style={w.ok ? undefined : [styles.diff, { color: mark }]}>
          {i > 0 ? ' ' : ''}
          {w.text}
        </Text>
      ))}
    </Text>
  );
}

export default function ExamSpeakCard({ prompt, expected, mode, targetLang, strictAccents, onDone }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<DictationResult | null>(null);

  const check = () => {
    const r = compareDictation(typed, expected, { strictAccents, subjectDrop: targetLang === 'es' });
    if (r.correct) onDone(true);
    else setResult(r);
  };
  const missed = result !== null;

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
        <Text testID="exam-speak-mode" style={[styles.label, { color: colors.textMuted }]}>
          {mode === 'translate' ? s.exam.speakTranslate(targetLang) : s.exam.speakRepeat}
        </Text>
        <Text testID="exam-speak-prompt" style={[styles.prompt, { color: colors.text }]}>
          {prompt}
        </Text>
        {/* Szándékosan nincs answerInputProps: az kikapcsolja a javaslat-sávot, és vele a billentyűzet
            mikrofon-gombját is eltüntetheti; a diktáláshoz az alap billentyűzet kell. */}
        <TextInput
          testID="exam-speak-input"
          style={[
            styles.input,
            { color: colors.text, borderColor: missed ? colors.danger : colors.border },
            g.brutal && brutalInputStyle(g),
          ]}
          placeholder={s.exam.speakPlaceholder}
          placeholderTextColor={colors.textMuted}
          value={typed}
          onChangeText={setTyped}
          editable={!missed}
          multiline
          autoFocus
        />
        {!missed && (
          <Text testID="exam-speak-hint" style={[styles.hint, { color: colors.textMuted }]}>
            {s.exam.speakHint}
          </Text>
        )}
        {result && (
          <View style={styles.reveal}>
            <ResultBadge correct={false} label={s.games.wrongFeedback} />
            <Text style={[styles.revealLabel, { color: colors.textMuted }]}>{s.exam.speakYouSaid}</Text>
            <Words testID="exam-speak-heard" words={result.heard} flag="exam-speak-extra" base={colors.text} mark={colors.danger} />
            <Text style={[styles.revealLabel, { color: colors.textMuted }]}>{s.exam.correctAnswer}</Text>
            <Words testID="exam-speak-correct" words={result.expected} flag="exam-speak-missing" base={colors.success} mark={colors.danger} />
          </View>
        )}
      </Card>
      {missed ? (
        <ExamButton testID="exam-next" label={`${s.card.next} →`} onPress={() => onDone(false)} />
      ) : (
        <>
          <ExamButton testID="exam-check" label={s.card.check} onPress={check} disabled={typed.trim().length === 0} />
          <ExamButton testID="exam-dont-know" secondary label={s.exam.dontKnow} onPress={() => setResult(compareDictation('', expected, { strictAccents, subjectDrop: false }))} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  brutalCard: { padding: spacing.lg, gap: spacing.md },
  label: { fontSize: fontSize.sm, textAlign: 'center' },
  prompt: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' },
  hint: { fontSize: fontSize.sm, textAlign: 'center' },
  input: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    textAlignVertical: 'top',
  },
  reveal: { gap: spacing.xs },
  revealLabel: { fontSize: fontSize.sm },
  revealText: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  diff: { fontWeight: fontWeight.bold, textDecorationLine: 'underline' },
});
