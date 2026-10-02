import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, Keyboard } from 'react-native';
import { Text } from '@/components/KText';
import { speak, stop as stopSpeech } from '@/lib/speech';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { Card, brutalInputStyle } from '@/components/grammar/Brutal';
import ResultBadge from '@/components/ResultBadge';
import DockedAction, { DOCK_RESERVE, FAB_CLEARANCE } from '@/components/learn/DockedAction';
import SentenceGradeRow from '@/components/learn/SentenceGradeRow';
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
  // PLAN-fb1001 10. lépés (FB434): a feladat-mondat (a kiinduló nyelven) a kártya megnyitásakor
  // elhangzik, mint a szókártya promptja (FB319).
  sourceSpeechLocale?: string;
  // Same accent rule as the word card (Settings -> Difficulty).
  strictAccents?: boolean;
  // FB397 (PLAN-fb0929 2. lépés): a Check/Next sáv ugyanaz a dokkolt sáv a
  // billentyűzet fölött, mint a PCIC szókártyán (DockedAction). A szülő adja a
  // billentyűzet-emelést (useDockLift) és fogadja a sáv magasságát, hogy a 💬 gomb
  // fölé tudjon kerülni; alapértékkel önállóan (tesztben) is renderel.
  dockLift?: number;
  dockH?: number;
  onDockHeight?: (h: number) => void;
  // FB455: a szókártya "Didn't know" / "Knew it" gombsora Check után (felülbírálja a kijelzett értékelést).
  gradeButtons?: boolean;
}

export default function TypedSentenceCard({
  sourceSentence,
  targetSentence,
  onResult,
  speechLocale,
  sourceSpeechLocale,
  strictAccents = false,
  dockLift = 0,
  dockH = DOCK_RESERVE,
  onDockHeight,
  gradeButtons = false,
}: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();

  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  // FB455: a Check rossz válaszra ítélt; a helyes mondat felülbírálás ("Knew it") után is látszik.
  const [missed, setMissed] = useState(false);

  useEffect(() => {
    if (sourceSpeechLocale) speak(sourceSentence, sourceSpeechLocale);
    return () => stopSpeech();
  }, [sourceSentence, sourceSpeechLocale]);

  const handleCheck = () => {
    Keyboard.dismiss();
    // Graded like the word card, on the sentence without its punctuation (the
    // tile card drops it too).
    // FB399: a névmás nélküli válasz is jó ("Como en casa." a "Yo como en casa." helyett).
    const grade = gradeSentenceAnswer(stripSentencePunct(typed), stripSentencePunct(targetSentence), strictAccents);
    const isCorrect = suggestedGrade(grade) === 'good';
    setResult(isCorrect ? 'correct' : 'wrong');
    setMissed(!isCorrect);
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
        contentContainerStyle={{ paddingBottom: FAB_CLEARANCE + dockH + dockLift }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          <Text style={[styles.sourceText, { color: colors.text }]}>{sourceSentence}</Text>

          <TextInput
            style={[
              styles.input,
              { color: colors.text, borderColor: result === 'correct' ? colors.successFill : result === 'wrong' ? colors.danger : colors.tabIconDefault },
              g.brutal && brutalInputStyle(g),
              g.brutal && result && { borderColor: result === 'correct' ? colors.successFill : colors.danger },
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

          {result && (result === 'wrong' || missed) && <Text style={[styles.correctLine, { color: colors.success }]}>{targetSentence}</Text>}

          {/* FB403: minden kártyán ugyanaz a jó / rossz jelzés (szín + alak + ✓/✗ + szöveg). */}
          {result && <ResultBadge correct={result === 'correct'} label={result === 'correct' ? s.card.correct : s.card.wrong} />}

          {result && gradeButtons && <SentenceGradeRow colors={colors} result={result} onOverride={(ok) => setResult(ok ? 'correct' : 'wrong')} />}
        </Card>
      </ScrollView>

      <DockedAction
        label={result ? `${s.card.next} →` : `✓ ${s.card.check}`}
        onPress={result ? () => onResult(result === 'correct') : handleCheck}
        tone={result ? 'next' : 'check'}
        color={result ? (result === 'correct' ? colors.successFill : colors.danger) : undefined}
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
