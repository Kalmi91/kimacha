import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, Keyboard } from 'react-native';
import { speak, stop as stopSpeech } from '@/lib/speech';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { Card, brutalInputStyle } from '@/components/grammar/Brutal';
import DockedAction, { DOCK_RESERVE } from '@/components/learn/DockedAction';
import { t } from '@/lib/i18n';
import { gradeSentenceAnswer, suggestedGrade } from '@/lib/pcicMatch';
import { stripSentencePunct } from '@/lib/sentenceCards';
import { answerInputProps } from '@/lib/inputProps';

interface Props {
  sourceSentence: string;
  targetSentence: string;
  onResult: (correct: boolean) => void;
  // Speech locale of the learned language, the right sentence is read aloud.
  speechLocale?: string;
  // Same accent rule as the word card (Settings -> Difficulty).
  strictAccents?: boolean;
  // FB397 (PLAN-fb0929 2. lépés): a Check/Next sáv ugyanaz a dokkolt sáv a
  // billentyűzet fölött, mint a PCIC szókártyán (DockedAction). A szülő adja a
  // billentyűzet-emelést (useDockLift) és fogadja a sáv magasságát, hogy a 💬 gomb
  // fölé tudjon kerülni; alapértékkel önállóan (tesztben) is renderel.
  dockLift?: number;
  dockH?: number;
  onDockHeight?: (h: number) => void;
}

export default function TypedSentenceCard({
  sourceSentence,
  targetSentence,
  onResult,
  speechLocale,
  strictAccents = false,
  dockLift = 0,
  dockH = DOCK_RESERVE,
  onDockHeight,
}: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();

  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);

  const handleCheck = () => {
    Keyboard.dismiss();
    // Graded like the word card, on the sentence without its punctuation (the
    // tile card drops it too).
    // FB399: a névmás nélküli válasz is jó ("Como en casa." a "Yo como en casa." helyett).
    const grade = gradeSentenceAnswer(stripSentencePunct(typed), stripSentencePunct(targetSentence), strictAccents);
    const isCorrect = suggestedGrade(grade) === 'good';
    setResult(isCorrect ? 'correct' : 'wrong');
    // FB412 (PLAN-fb0929 5. lépés): a helyes mondat MINDIG elhangzik, jó és rossz válasz után is.
    if (speechLocale) {
      stopSpeech();
      speak(targetSentence, speechLocale);
    }
  };

  // Az input és a visszajelzés a görgethető kártyában marad; a Check / Next
  // a képernyő aljára dokkolt sáv (a szülő KeyboardAvoidingView-jának közvetlen
  // gyereke, mint a PCIC szókártyán), a billentyűzet felső élén.
  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 16 + dockH + dockLift }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          <Text style={[styles.sourceText, { color: colors.text }]}>{sourceSentence}</Text>

          <TextInput
            style={[
              styles.input,
              { color: colors.text, borderColor: result === 'correct' ? '#22C55E' : result === 'wrong' ? '#EF4444' : colors.tabIconDefault },
              g.brutal && brutalInputStyle(g),
              g.brutal && result && { borderColor: result === 'correct' ? '#22C55E' : '#EF4444' },
            ]}
            placeholder={s.card.typeSentence}
            placeholderTextColor={colors.tabIconDefault}
            value={typed}
            onChangeText={(v) => {
              setTyped(v);
              // Editing after a miss clears the verdict, so the same field takes
              // another try instead of ending on "wrong".
              if (result === 'wrong') setResult(null);
            }}
            onSubmitEditing={result ? () => onResult(result === 'correct') : handleCheck}
            editable={result !== 'correct'}
            autoFocus
            {...answerInputProps}
          />

          {result === 'wrong' && <Text style={[styles.correctLine, { color: '#22C55E' }]}>{targetSentence}</Text>}

          {result && (
            <Text style={[styles.resultText, { color: result === 'correct' ? '#22C55E' : '#EF4444' }]}>
              {result === 'correct' ? s.card.correct : s.card.wrong}
            </Text>
          )}
        </Card>
      </ScrollView>

      <DockedAction
        label={result ? `${s.card.next} →` : `✓ ${s.card.check}`}
        onPress={result ? () => onResult(result === 'correct') : handleCheck}
        tone={result ? 'next' : 'check'}
        color={result ? (result === 'correct' ? '#22C55E' : '#EF4444') : undefined}
        bottom={dockLift}
        colors={colors}
        onHeight={onDockHeight}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 24, alignItems: 'center', minHeight: 280, gap: 16 },
  brutalCard: { padding: 24, alignItems: 'center', minHeight: 280, gap: 16 },
  scroll: { flex: 1 },
  sourceText: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  input: { width: '100%', borderWidth: 2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  resultText: { fontSize: 18, fontWeight: '700' },
  correctLine: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
