import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Text } from '@/components/KText';

import EasySentenceCard from '@/components/EasySentenceCard';
import ResultBadge from '@/components/ResultBadge';
import TrialBadge from '@/components/TrialBadge';
import AnswerCompare from '@/components/grammar/AnswerCompare';
import { BrutalBox, inkButtonText } from '@/components/grammar/Brutal';
import { useDockedAction } from '@/components/learn/DockSlot';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { answerInputProps } from '@/lib/inputProps';
import { speechLang } from '@/lib/languages';
import { gradeSentenceAnswer, suggestedGrade } from '@/lib/pcicMatch';
import { tileWords } from '@/lib/sentenceCards';
import { hashString, shuffleOptions } from '@/lib/shuffle';
import { speak, stopSpeaking } from '@/lib/speech';
import type { DictationItem, OrderItem, SpotItem } from '@/lib/grammar/lessonTypes';

// three new task kinds, FOR NOW only in the
// ser-estar (error spotting + dictation) and negacion (word order + error spotting) lessons, with the
// temporary "ÚJ · TESZT" ("NEW · TEST") label (components/TrialBadge.tsx). All three are 1 unit in
// scoring (right or not), and the right sentence is spoken after the answer.

type Lang = 'hu' | 'en' | 'es' | 'de';

const PUNCT_TAIL = /[.,;:!?¡¿]+$/;

/** The word without the punctuation at its end, and the punctuation separately. */
function splitPunct(token: string): { core: string; tail: string } {
  const m = token.match(PUNCT_TAIL);
  return m ? { core: token.slice(0, -m[0].length), tail: m[0] } : { core: token, tail: '' };
}

/** The corrected sentence: the wrong word replaced by the option (or removed if the option is empty), the punctuation stays in place. */
export function fixedSentence(es: string, wrongIndex: number, fix: string): string {
  const words = es.split(/\s+/).filter(Boolean);
  const wrong = words[wrongIndex] ?? '';
  const { tail } = splitPunct(wrong);
  if (fix === '') {
    const rest = words.filter((_, i) => i !== wrongIndex);
    if (tail && rest.length > 0) {
      const at = Math.min(wrongIndex, rest.length) - 1;
      if (at >= 0) rest[at] = `${splitPunct(rest[at]).core}${tail}`;
    }
    return rest.join(' ');
  }
  words[wrongIndex] = `${fix}${tail}`;
  return words.join(' ');
}

function ItemHead({ trial, title }: { trial?: boolean; title: string }) {
  const g = useGrammarColors();
  return (
    <View style={styles.head}>
      <Text style={[styles.headText, { color: g.mu }]}>{title}</Text>
      {trial ? <TrialBadge /> : null}
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
      <ItemHead trial={item.trial} title={phase === 'fix' ? s.grammar.spotPickFix : s.grammar.spotPrompt} />
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
          <BrutalBox fill="b" boxStyle={styles.feedback}>
            <Text style={[styles.fixedLine, { color: g.onB }]}>{fixed}</Text>
            <Text style={[styles.explain, { color: g.onB }]}>{item.explain[contentLang] ?? item.explain.en}</Text>
            <Text style={[styles.translation, { color: g.onB }]}>{item.tr[contentLang] ?? item.tr.en}</Text>
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
// the card's own buttons, the right sentence is spoken.
export function OrderDrillItem({
  item,
  learnedLang,
  contentLang,
  onDone,
}: {
  item: OrderItem;
  learnedLang: string;
  contentLang: Lang;
  onDone: (correct: boolean) => void;
}) {
  const s = t();
  return (
    <View style={styles.body} testID="order-item">
      <ItemHead trial={item.trial} title={s.grammar.orderHint} />
      <EasySentenceCard
        key={item.id}
        sourceSentence={item.prompt[contentLang] ?? item.prompt.en}
        targetWords={tileWords(item.es)}
        trapWords={[]}
        speechLocale={speechLang(learnedLang)}
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
  onDone: (correct: boolean) => void;
}) {
  const g = useGrammarColors();
  const s = t();
  const locale = speechLang(learnedLang);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<{ correct: boolean } | null>(null);

  // The sentence is spoken once, when the task appears.
  useEffect(() => {
    speak(item.es, locale);
    return () => stopSpeaking();
  }, [item.es, locale]);

  const check = () => {
    if (result) return;
    // Lenient check (punctuation, sentence without a pronoun, accent setting), as on the sentence card.
    const grade = gradeSentenceAnswer(typed, item.es, strictAccents);
    const ok = suggestedGrade(grade) === 'good';
    setResult({ correct: ok });
    speak(item.es, locale); // the right sentence is also spoken after the answer
  };

  // Check (and then Next) is a bar docked above the keyboard, as on the word card (DockSlot).
  const { docked, padBottom } = useDockedAction(
    result
      ? { label: s.grammar.nextArrow, tone: 'next', testID: 'grammar-next', onPress: () => onDone(result.correct) }
      : { label: `✓ ${s.grammar.check}`, tone: 'check', testID: 'dictation-check', onPress: check }
  );

  return (
    <View style={styles.body} testID="dictation-item">
      <ItemHead trial={item.trial} title={s.grammar.dictationHint} />
      <View style={styles.playRow}>
        <BrutalBox testID="dictation-play" fill="a" offset={3} boxStyle={styles.playBtn} onPress={() => speak(item.es, locale)} accessibilityLabel={s.grammar.dictationPlay}>
          <Text style={[styles.playText, { color: g.onFill }]}>🔊 {s.grammar.dictationPlay}</Text>
        </BrutalBox>
        <BrutalBox testID="dictation-slow" fill="paper" offset={3} boxStyle={styles.playBtn} onPress={() => speak(item.es, locale, { rate: 0.55 })} accessibilityLabel={s.grammar.dictationSlow}>
          <Text style={[styles.playText, { color: g.ink }]}>🐢 {s.grammar.dictationSlow}</Text>
        </BrutalBox>
      </View>
      <BrutalBox dashed={!!result && !result.correct} boxStyle={styles.inputBox}>
        <TextInput
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
          <BrutalBox fill="b" boxStyle={styles.feedback}>
            {!result.correct ? <AnswerCompare typed={typed} correct={item.es} g={g} onFill /> : <Text style={[styles.fixedLine, { color: g.onB }]}>{item.es}</Text>}
            <Text style={[styles.translation, { color: g.onB }]}>{item.tr[contentLang] ?? item.tr.en}</Text>
          </BrutalBox>
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
  explain: { fontSize: 14, lineHeight: 20 },
  translation: { fontSize: 14, fontStyle: 'italic' },
  next: { paddingVertical: 14, alignItems: 'center' },
  nextText: { fontSize: 16, fontWeight: '700', textTransform: 'uppercase' },
  playRow: { flexDirection: 'row', gap: 12 },
  playBtn: { paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center' },
  playText: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  inputBox: { padding: 0 },
  input: { paddingVertical: 12, paddingHorizontal: 14, fontSize: 18 },
});
