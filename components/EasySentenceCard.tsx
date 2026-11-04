import { useEffect, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View, Pressable, type PanResponderInstance } from 'react-native';
import { Text } from '@/components/KText';
import { preferredGenderFor, speak as speakIn, stop as stopSpeech } from '@/lib/speech';
import type { VoiceGender } from '@/lib/neuralVoices';
import Colors from '@/constants/Colors';
import { ON_FILL } from '@/constants/GrammarPalettes';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { BrutalBox, Card } from '@/components/grammar/Brutal';
import { ActionButton } from '@/components/grammar/Themed';
import ResultBadge from '@/components/ResultBadge';
import SentenceGradeRow from '@/components/learn/SentenceGradeRow';
import { t } from '@/lib/i18n';
import { sentenceBuildMatch, sentenceBuildMisplaced } from '@/lib/answerMatch';
import { useDiffStyles } from '@/lib/useDiffStyles';
import { dropIndex, moveItem, type TileFrame } from '@/lib/tileDrag';
import HintedSentence from '@/components/HintedSentence';
import SpeakButton from '@/components/SpeakButton';
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
  // Audio round B: the whole sentences (the prompt and the finished target sentence, not a placed tile) are spoken by this
  // speaker, the sex of the card's word voice (lib/cardSpeaker.ts), so the sentence pack finds its recording.
  speakerGender?: VoiceGender;
  // The sentence as written, spoken after Check. The tiles are lower-cased and without punctuation, which is not the
  // sentence the pack holds; without it the joined tiles are spoken as before.
  spokenSentence?: string;
  // Sentences tab (FB569): no sentence is spoken by itself, only on a press of the 🔊 button (before Check the prompt, after it
  // the right sentence); a tile still sounds when it is placed. Off (default) = the Learn tab's behaviour: the prompt is read
  // when the card opens and the right sentence after Check.
  speakOnPress?: boolean;
}

export default function EasySentenceCard({ sourceSentence, targetWords, trapWords, onResult, speechLocale, sourceSpeechLocale, gradeButtons = false, sourceHints, onSourceHint, speakerGender, spokenSentence, speakOnPress = false }: Props) {
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
  const saySentence = (text: string, locale: string) => (speakerGender ? speakIn(text, locale, { gender: speakerGender }) : speakIn(text, locale));

  useEffect(() => {
    if (sourceSpeechLocale && !speakOnPress) saySentence(sourceSentence, sourceSpeechLocale);
    return () => stopSpeech();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // FB555: every tile is read by one voice (the voice picked by the word's hash gave one sentence two voices):
      // the person picked on the Settings voice tab, else the female voice.
      speakIn(bank[bankIdx], speechLocale, { gender: preferredGenderFor(speechLocale) ?? 'f' });
    }
  };

  const removeWord = (posInPlaced: number) => {
    if (result) return;
    setPlaced(placed.filter((_, i) => i !== posInPlaced));
  };

  // FB537 ("drag the words, so a wrong first word or the order can be fixed"): a placed tile can be dragged to another
  // place in the row; a tap still sends it back to the bank (the drag only takes over once the finger moves). Where it is
  // let go decides its place (lib/tileDrag.ts). Not after the check (the tiles lose the handlers). One responder per place,
  // made once (one remade mid-drag would lose its gesture); the tiles' boxes are kept in `live` by their onLayout.
  const [live] = useState(() => ({ frames: [] as (TileFrame | undefined)[] }));
  const [pan] = useState(() => new Animated.ValueXY());
  const [dragging, setDragging] = useState<number | null>(null);
  const [responders] = useState<PanResponderInstance[]>(() =>
    Array.from({ length: targetWords.length + trapWords.length }, (_, pos) => {
      const end = () => {
        pan.setValue({ x: 0, y: 0 });
        setDragging(null);
      };
      return PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_e, g) => Math.hypot(g.dx, g.dy) > 8,
        onPanResponderGrant: () => {
          pan.setValue({ x: 0, y: 0 });
          setDragging(pos);
        },
        onPanResponderMove: (_e, g) => pan.setValue({ x: g.dx, y: g.dy }),
        onPanResponderRelease: (_e, g) => {
          // Read now: PanResponder resets its gesture state after the release, before the updater below runs.
          const { dx, dy } = g;
          const frames = [...live.frames];
          end();
          setPlaced((row) => moveItem(row, pos, dropIndex(frames.slice(0, row.length), pos, dx, dy)));
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: end,
      });
    }),
  );

  const handleCheck = () => {
    // tile for tile, no character tolerance, see sentenceBuildMatch.
    const isCorrect = sentenceBuildMatch(placed.map(i => bank[i]), targetWords);
    setResult(isCorrect ? 'correct' : 'wrong');
    setMissed(!isCorrect);
    // The correct sentence is ALWAYS spoken, after a good and after a bad
    // build alike (after a bad build it is also shown); not with speakOnPress.
    if (speechLocale && !speakOnPress) {
      stopSpeech();
      saySentence(spokenSentence ?? targetSentence, speechLocale);
    }
  };

  // speakOnPress: the 🔊 button speaks what is in front of the learner: the prompt, and once checked the right sentence.
  const speakShown = () => {
    stopSpeech();
    if (result) {
      if (speechLocale) saySentence(spokenSentence ?? targetSentence, speechLocale);
    } else if (sourceSpeechLocale) saySentence(sourceSentence, sourceSpeechLocale);
  };

  const canCheck = placed.length > 0;

  // Where the build went wrong: while the correct sentence is shown, the tiles outside the longest
  // common run with the target (trap word / wrong place) are red; colour + strikethrough.
  const misplaced = result && (result === 'wrong' || missed) ? sentenceBuildMisplaced(placed.map((i) => bank[i]), targetWords) : null;
  const bad = (pos: number) => !!misplaced?.[pos];
  const badBox = { backgroundColor: diff.wrong.backgroundColor };
  const badText = { color: diff.wrong.color, textDecorationLine: 'line-through' as const };
  // FB540 ("when the sentence is right, the word is right, the UI should turn green"): after the check every tile in its
  // right place is green (all of them on a right build); dark text on the fill, as on the result badge (7.8:1).
  const good = (pos: number) => result !== null && !bad(pos);
  const goodBox = { backgroundColor: colors.successFill };
  const goodText = { color: ON_FILL };
  const tileId = (pos: number) => (bad(pos) ? 'sentence-tile-wrong' : good(pos) ? 'sentence-tile-right' : undefined);

  return (
    <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
      <HintedSentence text={sourceSentence} pieces={sourceHints} onHint={onSourceHint} style={[styles.sourceText, { color: colors.text }]} />
      {speakOnPress && <SpeakButton testID="sentence-speak" onPress={speakShown} style={styles.speakBtn} iconStyle={styles.speakIcon} brutalStyle={styles.speakBrutal} />}

      <View style={[styles.placedArea, { borderColor: result === 'correct' ? colors.successFill : result === 'wrong' ? colors.danger : colors.tabIconDefault, borderStyle: result === 'correct' ? 'solid' : 'dashed' }, g.brutal && styles.brutalPlaced]}>
        {placed.length === 0 ? (
          <Text style={[styles.placeholder, { color: colors.tabIconDefault }]}>...</Text>
        ) : (
          <View style={styles.wordRow}>
            {placed.map((bankIdx, pos) => (
              <Animated.View
                key={`placed-${bankIdx}-${pos}`}
                testID={`sentence-placed-${pos}`}
                onLayout={(e) => { live.frames[pos] = e.nativeEvent.layout; }}
                style={dragging === pos ? [styles.dragging, { transform: pan.getTranslateTransform() }] : undefined}
                {...(result ? {} : responders[pos]?.panHandlers)}
              >
              {g.brutal ? (
                <BrutalBox key={`placed-${bankIdx}-${pos}`} testID={tileId(pos)} fill="b" offset={2} boxStyle={[styles.brutalChip, bad(pos) && badBox, good(pos) && goodBox]} onPress={() => removeWord(pos)}>
                  <Text style={[styles.chipText, { color: g.onB }, bad(pos) && badText, good(pos) && goodText]}>{bank[bankIdx]}</Text>
                </BrutalBox>
              ) : (
              <Pressable key={`placed-${bankIdx}-${pos}`} testID={tileId(pos)} style={[styles.wordChip, styles.placedChip, bad(pos) && badBox, good(pos) && goodBox]} onPress={() => removeWord(pos)}>
                <Text style={[styles.chipText, bad(pos) && badText, good(pos) && goodText]}>{bank[bankIdx]}</Text>
              </Pressable>
              )}
              </Animated.View>
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
  speakBtn: { alignSelf: 'center', padding: 4 },
  speakIcon: { fontSize: 22 },
  speakBrutal: { alignSelf: 'center' },
  placedArea: { borderWidth: 2, borderStyle: 'dashed', borderRadius: 12, padding: 12, minHeight: 50, width: '100%', justifyContent: 'center', alignItems: 'center' },
  placeholder: { fontSize: 16 },
  wordRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  // Transparent border here keeps the chip box model identical to emptySlot so sizes match exactly.
  wordChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#2563EB', borderWidth: 2, borderColor: 'transparent' },
  placedChip: { backgroundColor: '#1E40AF' },
  emptySlot: { backgroundColor: 'transparent', borderStyle: 'dashed' },
  hiddenText: { opacity: 0 },
  // The tile being dragged rides above the others.
  dragging: { zIndex: 1, elevation: 6 },
  chipText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  correctLine: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  checkBtn: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
  checkBtnPrimary: { paddingHorizontal: 44, paddingVertical: 14, borderRadius: 24, alignSelf: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
  checkBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
