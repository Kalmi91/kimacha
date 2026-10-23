import { useEffect, useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text } from '@/components/KText';
import { speak as speakIn, stop as stopSpeech } from '@/lib/speech';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { BrutalBox, Card } from '@/components/grammar/Brutal';
import { ActionButton } from '@/components/grammar/Themed';
import ResultBadge from '@/components/ResultBadge';
import SentenceGradeRow from '@/components/learn/SentenceGradeRow';
import { t } from '@/lib/i18n';
import { sentenceBuildMatch, sentenceBuildMisplaced } from '@/lib/answerMatch';
import { useDiffStyles } from '@/lib/useDiffStyles';
import HintedSentence from '@/components/HintedSentence';
import type { HintPiece } from '@/lib/sentenceHint';

interface Props {
  sourceSentence: string;
  targetWords: string[];
  trapWords: string[];
  onResult: (correct: boolean) => void;
  // speech locale of the learned language, so a placed tile can be heard.
  speechLocale?: string;
  // The prompt sentence (in the source language) is spoken when the card opens,
  // like the word card's prompt.
  sourceSpeechLocale?: string;
  // The word card's "Didn't know" / "Knew it" button row after Check (overrides the displayed grade).
  gradeButtons?: boolean;
  // Tap-a-word hints on the prompt sentence (Sentences tab, beta sentenceHint): the marked words, and what to do with the cards a
  // looked-at word belongs to.
  sourceHints?: HintPiece[] | null;
  onSourceHint?: (ids: string[]) => void;
}

export default function EasySentenceCard({ sourceSentence, targetWords, trapWords, onResult, speechLocale, sourceSpeechLocale, gradeButtons = false, sourceHints, onSourceHint }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const diff = useDiffStyles();
  const s = t();

  // Word bank shuffled once. Positions never change — clicking a word leaves a
  // same-size dashed placeholder in its spot instead of reflowing the whole row.
  const [bank] = useState<string[]>(() =>
    [...targetWords, ...trapWords].sort(() => Math.random() - 0.5)
  );
  // placed = bank indices, in the order the user tapped them.
  const [placed, setPlaced] = useState<number[]>([]);
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  // Check judged the build wrong; the correct sentence is also shown after an override ("Knew it").
  const [missed, setMissed] = useState(false);
  const targetSentence = targetWords.join(' ');

  useEffect(() => {
    if (sourceSpeechLocale) speakIn(sourceSentence, sourceSpeechLocale);
    return () => stopSpeech();
  }, [sourceSentence, sourceSpeechLocale]);

  const usedSet = new Set(placed);

  const addWord = (bankIdx: number) => {
    if (result) return;
    setPlaced([...placed, bankIdx]);
    // User feedback: "when a tile is put up there, also pronounce the word I put in,
    // so I can hear the pronunciation". Only the single tile is
    // spoken, so the whole sentence is never given away.
    if (speechLocale) {
      stopSpeech();
      speakIn(bank[bankIdx], speechLocale);
    }
  };

  const removeWord = (posInPlaced: number) => {
    if (result) return;
    setPlaced(placed.filter((_, i) => i !== posInPlaced));
  };

  const handleCheck = () => {
    // tile for tile, no character tolerance, see sentenceBuildMatch.
    const isCorrect = sentenceBuildMatch(placed.map(i => bank[i]), targetWords);
    setResult(isCorrect ? 'correct' : 'wrong');
    setMissed(!isCorrect);
    // The correct sentence is ALWAYS spoken, after a good and after a bad
    // build alike (after a bad build it is also shown).
    if (speechLocale) {
      stopSpeech();
      speakIn(targetSentence, speechLocale);
    }
  };

  const canCheck = placed.length > 0;

  // Where the build went wrong: while the correct sentence is shown, the tiles outside the longest
  // common run with the target (trap word / wrong place) are red; colour + strikethrough.
  const misplaced = result && (result === 'wrong' || missed) ? sentenceBuildMisplaced(placed.map((i) => bank[i]), targetWords) : null;
  const bad = (pos: number) => !!misplaced?.[pos];
  const badBox = { backgroundColor: diff.wrong.backgroundColor };
  const badText = { color: diff.wrong.color, textDecorationLine: 'line-through' as const };

  return (
    <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
      <HintedSentence text={sourceSentence} pieces={sourceHints} onHint={onSourceHint} style={[styles.sourceText, { color: colors.text }]} />

      <View style={[styles.placedArea, { borderColor: result === 'correct' ? colors.successFill : result === 'wrong' ? colors.danger : colors.tabIconDefault, borderStyle: result === 'correct' ? 'solid' : 'dashed' }, g.brutal && styles.brutalPlaced]}>
        {placed.length === 0 ? (
          <Text style={[styles.placeholder, { color: colors.tabIconDefault }]}>...</Text>
        ) : (
          <View style={styles.wordRow}>
            {placed.map((bankIdx, pos) => (
              g.brutal ? (
                <BrutalBox key={`placed-${bankIdx}-${pos}`} testID={bad(pos) ? 'sentence-tile-wrong' : undefined} fill="b" offset={2} boxStyle={[styles.brutalChip, bad(pos) && badBox]} onPress={() => removeWord(pos)}>
                  <Text style={[styles.chipText, { color: g.onB }, bad(pos) && badText]}>{bank[bankIdx]}</Text>
                </BrutalBox>
              ) : (
              <Pressable key={`placed-${bankIdx}-${pos}`} testID={bad(pos) ? 'sentence-tile-wrong' : undefined} style={[styles.wordChip, styles.placedChip, bad(pos) && badBox]} onPress={() => removeWord(pos)}>
                <Text style={[styles.chipText, bad(pos) && badText]}>{bank[bankIdx]}</Text>
              </Pressable>
              )
            ))}
          </View>
        )}
      </View>

      {result && (result === 'wrong' || missed) && (
        <Text style={[styles.correctLine, { color: colors.success }]}>{targetSentence}</Text>
      )}

      <View style={styles.wordRow}>
        {bank.map((w, idx) =>
          usedSet.has(idx) ? (
            // Same-size dashed slot keeps the layout fixed while the word is in use.
            <View key={`slot-${idx}`} style={[styles.wordChip, styles.emptySlot, { borderColor: colors.tabIconDefault }, g.brutal && styles.brutalSlot]}>
              <Text style={[styles.chipText, styles.hiddenText]}>{w}</Text>
            </View>
          ) : (
            g.brutal ? (
              <BrutalBox key={`bank-${idx}`} fill="a" offset={2} boxStyle={styles.brutalChip} onPress={() => addWord(idx)}>
                <Text style={[styles.chipText, { color: g.onFill }]}>{w}</Text>
              </BrutalBox>
            ) : (
            <Pressable key={`bank-${idx}`} style={[styles.wordChip, { backgroundColor: '#2563EB' }]} onPress={() => addWord(idx)}>
              <Text style={styles.chipText}>{w}</Text>
            </Pressable>
            )
          )
        )}
      </View>

      {/* the same correct / wrong indicator on every card (colour + shape + ✓/✗ + text). */}
      {result && <ResultBadge correct={result === 'correct'} label={result === 'correct' ? s.card.correct : s.card.wrong} align="center" />}

      {result && gradeButtons && <SentenceGradeRow colors={colors} result={result} onOverride={(ok) => setResult(ok ? 'correct' : 'wrong')} />}

      {!result ? (
        <ActionButton
          label={s.card.check}
          onPress={handleCheck}
          disabled={!canCheck}
          brutalStyle={styles.brutalBtn}
          classicStyle={[styles.checkBtn, styles.checkBtnPrimary, { backgroundColor: colors.accent, opacity: canCheck ? 1 : 0.4 }]}
          classicTextStyle={styles.checkBtnText}
          classicRole={null}
        />
      ) : (
        <ActionButton
          label={`${s.card.next} →`}
          fill="a"
          onPress={() => onResult(result === 'correct')}
          brutalStyle={styles.brutalBtn}
          classicStyle={[styles.checkBtn, { backgroundColor: result === 'correct' ? colors.successFill : colors.danger }]}
          classicTextStyle={styles.checkBtnText}
          classicRole={null}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 24, alignItems: 'center', minHeight: 280, gap: 16 },
  brutalCard: { padding: 24, alignItems: 'center', minHeight: 280, gap: 16 },
  brutalPlaced: { borderRadius: 0, borderWidth: 2.5 },
  brutalChip: { paddingHorizontal: 12, paddingVertical: 6 },
  brutalSlot: { borderRadius: 0, borderWidth: 2.5, paddingHorizontal: 12, paddingVertical: 6, marginRight: 2, marginBottom: 2 },
  brutalBtn: { alignSelf: 'stretch' },
  sourceText: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  placedArea: { borderWidth: 2, borderStyle: 'dashed', borderRadius: 12, padding: 12, minHeight: 50, width: '100%', justifyContent: 'center', alignItems: 'center' },
  placeholder: { fontSize: 16 },
  wordRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  // Transparent border here keeps the chip box model identical to emptySlot so sizes match exactly.
  wordChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#2563EB', borderWidth: 2, borderColor: 'transparent' },
  placedChip: { backgroundColor: '#1E40AF' },
  emptySlot: { backgroundColor: 'transparent', borderStyle: 'dashed' },
  hiddenText: { opacity: 0 },
  chipText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  correctLine: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  checkBtn: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
  checkBtnPrimary: { paddingHorizontal: 44, paddingVertical: 14, borderRadius: 24, alignSelf: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
  checkBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
