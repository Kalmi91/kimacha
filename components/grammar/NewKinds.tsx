import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '@/components/KText';

import EasySentenceCard from '@/components/EasySentenceCard';
import ResultBadge from '@/components/ResultBadge';
import AnswerCompare from '@/components/grammar/AnswerCompare';
import SpeakButton from '@/components/SpeakButton';
import { BrutalBox, inkButtonText, resultFill, resultInk } from '@/components/grammar/Brutal';
import MistypedButton, { mistypedDock } from '@/components/grammar/MistypedButton';
import { useDockedAction } from '@/components/learn/DockSlot';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { answerInputProps } from '@/lib/inputProps';
import { useFocusOnNewCard } from '@/lib/learn/useFocusOnNewCard';
import { speechLang } from '@/lib/languages';
import { gradeSentenceAnswer, suggestedGrade } from '@/lib/pcicMatch';
import { tileWords } from '@/lib/sentenceCards';
import { hashString, shuffleOptions } from '@/lib/shuffle';
import { speak, stopSpeaking } from '@/lib/speech';
import { speechBusy, useSpeechStatus } from '@/lib/speechStatus';
import { fixedSentence } from '@/lib/grammar/fixedSentence';
import { orderDistractors } from '@/lib/grammar/orderTiles';
import type { BankItem, ClozeItem, ContentLang, DictationItem, FixItem, NounItem, OrderItem, SpotItem, WriteItem } from '@/lib/grammar/lessonTypes';
import { isWriteAnswerRight } from '@/lib/grammar/writeAnswer';
import { BankDrillItem, ClozeDrillItem, FixDrillItem, NounDrillItem } from './TypedKinds';

// three new task kinds, FOR NOW only in the
// ser-estar (error spotting + dictation) and negacion (word order + error spotting) lessons. All three are 1 unit in
// scoring (right or not), and the right sentence is spoken after the answer.
// Sentence writing (`write`) joined them later, in the por-para and ser-estar lessons, with the same rules.

type Lang = ContentLang;

export { fixedSentence };

function ItemHead({ title }: { title: string }) {
  const g = useGrammarColors();
  return (
    <View style={styles.head}>
      <Text style={[styles.headText, { color: g.mu }]}>{title}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- error spotting
export function SpotDrillItem({
  item,
  learnedLang,
  contentLang,
  onDone,
}: {
  item: SpotItem;
  learnedLang: string;
  contentLang: Lang;
  onDone: (correct: boolean) => void;
}) {
  const g = useGrammarColors();
  const s = t();
  const words = useMemo(() => item.es.split(/\s+/).filter(Boolean), [item.es]);
  const [wrongTaps, setWrongTaps] = useState<Set<number>>(new Set());
  const [found, setFound] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const shuffled = useMemo(
    () => shuffleOptions(item.options, item.correctIndex, hashString(item.id)),
    [item.options, item.correctIndex, item.id]
  );
  const phase: 'find' | 'fix' | 'done' = picked !== null ? 'done' : found ? 'fix' : 'find';
  const missedTap = wrongTaps.size > 0;
  const pickedCorrect = picked !== null && picked === shuffled.correctIndex;
  const correct = pickedCorrect && !missedTap;
  const fixed = fixedSentence(item.es, item.wrongIndex, item.options[item.correctIndex]);

  const tapWord = (i: number) => {
    if (phase !== 'find') return;
    if (i === item.wrongIndex) setFound(true);
    else setWrongTaps((prev) => new Set(prev).add(i));
  };

  const pick = (i: number) => {
    if (phase !== 'fix') return;
    setPicked(i);
    // the right (corrected) sentence is spoken, after right and wrong answers alike
    speak(fixed, speechLang(learnedLang));
  };

  return (
    <View style={styles.body} testID="spot-item">
      <ItemHead title={phase === 'fix' ? s.grammar.spotPickFix : s.grammar.spotPrompt} />
      <BrutalBox boxStyle={styles.sentenceBox}>
        <View style={styles.wordRow}>
          {words.map((w, i) => {
            const isWrong = i === item.wrongIndex;
            const missed = wrongTaps.has(i);
            const revealed = phase !== 'find' && isWrong;
            return (
              <BrutalBox
                key={i}
                testID={`spot-word-${i}`}
                fill={revealed ? (phase === 'done' && correct ? 'a' : 'b') : 'paper'}
                dashed={missed}
                offset={2}
                style={missed ? styles.dim : undefined}
                boxStyle={styles.chip}
                onPress={() => tapWord(i)}
                disabled={phase !== 'find'}
              >
                <Text style={[styles.chipText, { color: revealed ? (phase === 'done' && correct ? g.onA : g.onB) : g.ink }]}>{w}</Text>
              </BrutalBox>
            );
          })}
        </View>
      </BrutalBox>

      {phase === 'find' && missedTap ? <Text style={[styles.note, { color: g.mu }]}>{s.grammar.spotWordFine}</Text> : null}

      {phase === 'fix' ? (
        <View style={styles.options}>
          {shuffled.options.map((opt, i) => (
            <BrutalBox key={`${opt}-${i}`} testID="spot-option" offset={2} style={styles.option} boxStyle={styles.optionInner} onPress={() => pick(i)}>
              <Text style={[styles.optionText, { color: g.ink }]}>{opt === '' ? s.grammar.spotDelete : opt}</Text>
            </BrutalBox>
          ))}
        </View>
      ) : null}

      {phase === 'done' ? (
        <>
          <ResultBadge correct={correct} testID="spot-result" />
          <BrutalBox fill={resultFill(correct)} boxStyle={styles.feedback}>
            <Text style={[styles.fixedLine, { color: resultInk(g, correct) }]}>{fixed}</Text>
            <Text style={[styles.explain, { color: resultInk(g, correct) }]}>{item.explain[contentLang] ?? item.explain.en}</Text>
            <Text style={[styles.translation, { color: resultInk(g, correct) }]}>{item.tr[contentLang] ?? item.tr.en}</Text>
          </BrutalBox>
          <BrutalBox testID="grammar-next" fill="ink" boxStyle={styles.next} onPress={() => onDone(correct)}>
            <Text style={[styles.nextText, { color: inkButtonText(g) }]}>{s.grammar.nextArrow}</Text>
          </BrutalBox>
        </>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- word order
// It reuses the existing tap-tile card (EasySentenceCard): the sentence at
// the top is in the UI language, below it the tiles of the Spanish words; Check and Next are
// the card's own buttons. Nothing is read aloud (no tile, no sentence; FB671); 2 or 3 tiles are not needed (FB672).
export function OrderDrillItem({
  item,
  contentLang,
  lessonItems = [],
  onDone,
}: {
  item: OrderItem;
  learnedLang?: string;
  contentLang: Lang;
  /** The items of the item's lesson: the unneeded tiles are words of their sentences. */
  lessonItems?: readonly unknown[];
  onDone: (correct: boolean) => void;
}) {
  const s = t();
  return (
    <View style={styles.body} testID="order-item">
      <ItemHead title={s.grammar.orderHint} />
      <EasySentenceCard
        key={item.id}
        sourceSentence={item.prompt[contentLang] ?? item.prompt.en}
        targetWords={tileWords(item.es)}
        acceptWords={item.accept?.map(tileWords)}
        trapWords={orderDistractors(item, lessonItems)}
        onResult={onDone}
      />
    </View>
  );
}

// ---------------------------------------------------------------- dictation
export function DictationDrillItem({
  item,
  learnedLang,
  contentLang,
  strictAccents,
  onDone,
}: {
  item: DictationItem;
  learnedLang: string;
  contentLang: Lang;
  strictAccents: boolean;
  onDone: (correct: boolean, mistyped?: boolean) => void;
}) {
  const g = useGrammarColors();
  const s = t();
  const locale = speechLang(learnedLang);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<{ correct: boolean } | null>(null);
  const inputRef = useRef<TextInput>(null);
  useFocusOnNewCard(inputRef, true, item.id);
  const audio = useSpeechStatus();
  const active = audio.text === item.es && speechBusy(audio.phase);

  // The sentence is spoken once, when the task appears.
  useEffect(() => {
    speak(item.es, locale);
    return () => stopSpeaking();
  }, [item.es, locale]);

  const check = () => {
    if (result) return;
    Keyboard.dismiss();
    // Lenient check (punctuation, sentence without a pronoun, accent setting), as on the sentence card.
    const grade = gradeSentenceAnswer(typed, item.es, strictAccents, learnedLang);
    const ok = suggestedGrade(grade) === 'good';
    setResult({ correct: ok });
    speak(item.es, locale); // the right sentence is also spoken after the answer
  };

  // Check (and then Next) is a bar docked above the keyboard, as on the word card (DockSlot).
  const { docked, padBottom } = useDockedAction(
    result
      ? { label: s.grammar.nextArrow, tone: 'next', testID: 'grammar-next', onPress: () => onDone(result.correct), secondary: mistypedDock(!result.correct, () => onDone(true, true)) }
      : { label: `✓ ${s.grammar.check}`, tone: 'check', testID: 'dictation-check', onPress: check }
  );

  return (
    <View style={styles.body} testID="dictation-item">
      <ItemHead title={s.grammar.dictationHint} />
      <View style={styles.playRow}>
        <SpeakButton
          testID="dictation-play"
          label={s.grammar.dictationPlay}
          onPress={() => speak(item.es, locale)}
          style={[styles.playBtn, styles.playClassic, { backgroundColor: g.a }]}
          iconStyle={[styles.playText, { color: g.onFill }]}
          labelStyle={[styles.playText, { color: g.onFill }]}
        />
        <SpeakButton
          testID="dictation-slow"
          icon={active ? '🔉' : '🐢'}
          label={s.grammar.dictationSlow}
          onPress={() => speak(item.es, locale, { rate: 0.55 })}
          style={[styles.playBtn, styles.playClassic, { backgroundColor: g.paper }]}
          iconStyle={[styles.playText, { color: g.ink }]}
          labelStyle={[styles.playText, { color: g.ink }]}
        />
      </View>
      <BrutalBox dashed={!!result && !result.correct} boxStyle={styles.inputBox}>
        <TextInput
          ref={inputRef}
          testID="dictation-input"
          {...answerInputProps}
          style={[styles.input, { color: g.ink }]}
          value={typed}
          onChangeText={setTyped}
          editable={!result}
          placeholder={s.card.typeIn(learnedLang)}
          placeholderTextColor={g.mu}
          onSubmitEditing={result ? undefined : check}
        />
      </BrutalBox>
      {result ? (
        <>
          <ResultBadge correct={result.correct} testID="dictation-result" />
          <BrutalBox fill={resultFill(result.correct)} boxStyle={styles.feedback}>
            {!result.correct ? <AnswerCompare typed={typed} correct={item.es} g={g} onFill /> : <Text style={[styles.fixedLine, { color: resultInk(g, true) }]}>{item.es}</Text>}
            <Text style={[styles.translation, { color: resultInk(g, result.correct) }]}>{item.tr[contentLang] ?? item.tr.en}</Text>
          </BrutalBox>
          {!result.correct && !docked ? <MistypedButton onPress={() => onDone(true, true)} /> : null}
          {docked ? null : (
            <BrutalBox testID="grammar-next" fill="ink" boxStyle={styles.next} onPress={() => onDone(result.correct)}>
              <Text style={[styles.nextText, { color: inkButtonText(g) }]}>{s.grammar.nextArrow}</Text>
            </BrutalBox>
          )}
        </>
      ) : docked ? null : (
        <BrutalBox testID="dictation-check" fill="ink" boxStyle={styles.next} onPress={check}>
          <Text style={[styles.nextText, { color: inkButtonText(g) }]}>{s.grammar.check}</Text>
        </BrutalBox>
      )}
      {docked ? <View style={{ height: padBottom }} /> : null}
    </View>
  );
}

// ---------------------------------------------------------------- sentence writing
export function WriteDrillItem({
  item,
  learnedLang,
  contentLang,
  strictAccents,
  onDone,
}: {
  item: WriteItem;
  learnedLang: string;
  contentLang: Lang;
  strictAccents: boolean;
  onDone: (correct: boolean, mistyped?: boolean) => void;
}) {
  const g = useGrammarColors();
  const s = t();
  const locale = speechLang(learnedLang);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<{ correct: boolean } | null>(null);
  const inputRef = useRef<TextInput>(null);
  useFocusOnNewCard(inputRef, true, item.id);

  // The right sentence is spoken after the answer only; leaving the task silences it.
  useEffect(() => () => stopSpeaking(), []);

  const check = () => {
    if (result || typed.trim() === '') return;
    Keyboard.dismiss();
    setResult({ correct: isWriteAnswerRight(typed, item, strictAccents) });
    speak(item.es, locale);
  };

  // Check (and then Next) is a bar docked above the keyboard, as on the dictation (DockSlot).
  const { docked, padBottom } = useDockedAction(
    result
      ? { label: s.grammar.nextArrow, tone: 'next', testID: 'grammar-next', onPress: () => onDone(result.correct), secondary: mistypedDock(!result.correct, () => onDone(true, true)) }
      : { label: `✓ ${s.grammar.check}`, tone: 'check', testID: 'write-check', onPress: check }
  );

  const why = item.why[contentLang] ?? item.why.en;

  return (
    <View style={styles.body} testID="write-item">
      <BrutalBox boxStyle={styles.promptBox}>
        <Text testID="write-prompt" style={[styles.promptText, { color: g.ink }]}>
          {item.prompt[contentLang] ?? item.prompt.en}
        </Text>
      </BrutalBox>
      <Text style={[styles.writeLabel, { color: g.ink }]}>{s.grammar.writeHint}</Text>
      <BrutalBox dashed={!!result && !result.correct} boxStyle={styles.inputBox}>
        <TextInput
          ref={inputRef}
          testID="write-input"
          {...answerInputProps}
          multiline
          submitBehavior="blurAndSubmit"
          style={[styles.input, styles.writeInput, { color: g.ink }]}
          value={typed}
          onChangeText={setTyped}
          editable={!result}
          placeholder={s.card.typeIn(learnedLang)}
          placeholderTextColor={g.mu}
          onSubmitEditing={result ? undefined : check}
        />
      </BrutalBox>
      {result ? (
        <>
          <BrutalBox testID={result.correct ? 'write-correct' : 'write-wrong'} fill={resultFill(result.correct)} boxStyle={styles.feedback}>
            {result.correct ? (
              <>
                <Text style={[styles.fixedLine, { color: resultInk(g, true) }]}>{s.grammar.correct}</Text>
                {/* the lesson's own form, with its accents: the learner may have typed another accepted one */}
                <Text testID="write-sentence" style={[styles.writeSentence, { color: resultInk(g, true) }]}>
                  {item.es}
                </Text>
              </>
            ) : (
              <AnswerCompare typed={typed} correct={item.es} g={g} onFill />
            )}
            <Text testID="write-why" style={[styles.explain, { color: resultInk(g, result.correct) }]}>
              {why}
            </Text>
          </BrutalBox>
          {!result.correct && !docked ? <MistypedButton onPress={() => onDone(true, true)} /> : null}
          {docked ? null : (
            <BrutalBox testID="grammar-next" fill="ink" boxStyle={styles.next} onPress={() => onDone(result.correct)}>
              <Text style={[styles.nextText, { color: inkButtonText(g) }]}>{s.grammar.nextArrow}</Text>
            </BrutalBox>
          )}
        </>
      ) : docked ? null : (
        <BrutalBox testID="write-check" fill="ink" boxStyle={styles.next} onPress={check}>
          <Text style={[styles.nextText, { color: inkButtonText(g) }]}>{s.grammar.check}</Text>
        </BrutalBox>
      )}
      {!strictAccents ? (
        <Text testID="write-accent-hint" style={[styles.explain, { color: g.mu }]}>
          {s.grammar.accentHint}
        </Text>
      ) : null}
      {docked ? <View style={{ height: padBottom }} /> : null}
    </View>
  );
}

// One entry for the trial kinds: GrammarDrill hands over whichever of them the round item is.
export function NewKindDrillItem({
  item,
  learnedLang,
  contentLang,
  strictAccents,
  lessonItems,
  onDone,
  onShown,
}: {
  item: SpotItem | OrderItem | DictationItem | WriteItem | ClozeItem | FixItem | BankItem | NounItem;
  learnedLang: string;
  contentLang: Lang;
  strictAccents: boolean;
  /** The items of the lesson (the word order task takes its unneeded tiles from them). */
  lessonItems?: readonly unknown[];
  onDone: (correct: boolean, mistyped?: boolean) => void;
  /** The typed kinds: the answer is checked and its feedback is on screen, before Next. */
  onShown?: (correct: boolean) => void;
}) {
  switch (item.kind) {
    case 'spot':
      return <SpotDrillItem item={item} learnedLang={learnedLang} contentLang={contentLang} onDone={onDone} />;
    case 'order':
      return <OrderDrillItem item={item} contentLang={contentLang} lessonItems={lessonItems} onDone={onDone} />;
    case 'dictation':
      return <DictationDrillItem item={item} learnedLang={learnedLang} contentLang={contentLang} strictAccents={strictAccents} onDone={onDone} />;
    case 'write':
      return <WriteDrillItem item={item} learnedLang={learnedLang} contentLang={contentLang} strictAccents={strictAccents} onDone={onDone} />;
    case 'opencloze':
      return <ClozeDrillItem item={item} learnedLang={learnedLang} contentLang={contentLang} strictAccents={strictAccents} onDone={onDone} onShown={onShown} />;
    case 'fix':
      return <FixDrillItem item={item} learnedLang={learnedLang} contentLang={contentLang} strictAccents={strictAccents} onDone={onDone} onShown={onShown} />;
    case 'bank':
      return <BankDrillItem item={item} learnedLang={learnedLang} contentLang={contentLang} strictAccents={strictAccents} onDone={onDone} onShown={onShown} />;
    case 'noun':
      return <NounDrillItem item={item} learnedLang={learnedLang} contentLang={contentLang} strictAccents={strictAccents} onDone={onDone} onShown={onShown} />;
  }
}

const styles = StyleSheet.create({
  body: { gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', flexShrink: 1 },
  sentenceBox: { padding: 14 },
  wordRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 10 },
  chipText: { fontSize: 18, fontWeight: '600', flexShrink: 1 },
  dim: { opacity: 0.55 },
  note: { fontSize: 13, textAlign: 'center' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  option: { flexBasis: '46%', flexGrow: 1 },
  optionInner: { paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center' },
  optionText: { fontSize: 17, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  feedback: { padding: 14, gap: 6 },
  fixedLine: { fontSize: 20, fontWeight: '700' },
  writeSentence: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  explain: { fontSize: 14, lineHeight: 20 },
  translation: { fontSize: 14, fontStyle: 'italic' },
  next: { paddingVertical: 14, alignItems: 'center' },
  nextText: { fontSize: 16, fontWeight: '700', textTransform: 'uppercase' },
  playRow: { flexDirection: 'row', gap: 12 },
  playBtn: { paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center' },
  playClassic: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8 },
  playText: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  inputBox: { padding: 0 },
  input: { paddingVertical: 12, paddingHorizontal: 14, fontSize: 18 },
  promptBox: { padding: 16 },
  promptText: { fontSize: 22, lineHeight: 29, fontWeight: '600' },
  writeLabel: { fontSize: 15, fontWeight: '600' },
  writeInput: { minHeight: 96, textAlignVertical: 'top' },
});
