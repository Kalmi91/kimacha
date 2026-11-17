import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Text } from '@/components/KText';

import AnswerCompare from '@/components/grammar/AnswerCompare';
import { BrutalBox, inkButtonText } from '@/components/grammar/Brutal';
import { tapTarget } from '@/constants/Theme';
import { useDockedAction } from '@/components/learn/DockSlot';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { answerInputProps } from '@/lib/inputProps';
import { useFocusOnNewCard } from '@/lib/learn/useFocusOnNewCard';
import { speechLang } from '@/lib/languages';
import { fixedSentence } from '@/lib/grammar/fixedSentence';
import type { BankItem, ClozeItem, ContentLang, FixItem, NounItem } from '@/lib/grammar/lessonTypes';
import { clozeParts, filledCloze, filledSentence, gradeCloze, isBankAnswerRight, isFixAnswerRight, isNounAnswerRight } from '@/lib/grammar/typedKinds';
import { speak, stopSpeaking } from '@/lib/speech';

type Lang = ContentLang;

function ItemHead({ title }: { title: string }) {
  const g = useGrammarColors();
  return (
    <View style={styles.head}>
      <Text style={[styles.headText, { color: g.mu }]}>{title}</Text>
    </View>
  );
}

// The typed task kinds of the grammar tests, in their own file (NewKinds.tsx hands the round items over, see NewKindDrillItem).
// Open cloze, error correction by typing, word bank and the typed noun form. All four are 1 unit in scoring (right
// or not), the typing rules are those of the sentence writing, the right sentence is spoken after the answer.

/** One typed answer with its Check / Next bar and feedback box; the item's own head (what is asked) comes in as `head`. */
function TypedItem({
  prefix,
  itemId,
  head,
  enabled = true,
  forceWrong = false,
  isRight,
  answer,
  filled,
  why,
  whyId,
  extra,
  learnedLang,
  strictAccents,
  onDone,
}: {
  prefix: string;
  itemId: string;
  head: ReactNode;
  /** The input appears only when true (the error-correction task shows it after the faulty word is found). */
  enabled?: boolean;
  /** The result is wrong whatever was typed (e.g. a wrong word was tapped on the way). */
  forceWrong?: boolean;
  isRight: (typed: string) => boolean;
  /** The right typed answer, for the comparison under a wrong one. */
  answer: string;
  /** The completed sentence or form, shown on the feedback and spoken. */
  filled: string;
  why: string;
  whyId: string;
  extra?: string;
  learnedLang: string;
  strictAccents: boolean;
  onDone: (correct: boolean) => void;
}) {
  const g = useGrammarColors();
  const s = t();
  const locale = speechLang(learnedLang);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<{ correct: boolean; typedRight: boolean } | null>(null);
  const inputRef = useRef<TextInput>(null);
  useFocusOnNewCard(inputRef, enabled, itemId);
  useEffect(() => () => stopSpeaking(), []);

  const check = () => {
    if (result || typed.trim() === '') return;
    const typedRight = isRight(typed);
    setResult({ correct: typedRight && !forceWrong, typedRight });
    speak(filled, locale);
  };

  const { docked, padBottom } = useDockedAction(
    !enabled
      ? null
      : result
        ? { label: s.grammar.nextArrow, tone: 'next', testID: 'grammar-next', onPress: () => onDone(result.correct) }
        : { label: `✓ ${s.grammar.check}`, tone: 'check', testID: `${prefix}-check`, onPress: check }
  );

  return (
    <View style={styles.body} testID={`${prefix}-item`}>
      {head}
      {enabled ? (
        <>
          <BrutalBox dashed={!!result && !result.correct} boxStyle={styles.inputBox}>
            <TextInput
              ref={inputRef}
              testID={`${prefix}-input`}
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
              <BrutalBox testID={`${prefix}-${result.correct ? 'correct' : 'wrong'}`} fill="b" boxStyle={styles.feedback}>
                {result.typedRight ? (
                  <>
                    <Text style={[styles.fixedLine, { color: g.onB }]}>{result.correct ? s.grammar.correct : s.games.wrongFeedback}</Text>
                    <Text testID={`${prefix}-sentence`} style={[styles.writeSentence, { color: g.onB }]}>
                      {filled}
                    </Text>
                  </>
                ) : (
                  <AnswerCompare typed={typed} correct={answer} g={g} onFill />
                )}
                <Text testID={whyId} style={[styles.explain, { color: g.onB }]}>
                  {why}
                </Text>
                {extra ? <Text style={[styles.translation, { color: g.onB }]}>{extra}</Text> : null}
              </BrutalBox>
              {docked ? null : (
                <BrutalBox testID="grammar-next" fill="ink" boxStyle={styles.next} onPress={() => onDone(result.correct)}>
                  <Text style={[styles.nextText, { color: inkButtonText(g) }]}>{s.grammar.nextArrow}</Text>
                </BrutalBox>
              )}
            </>
          ) : docked ? null : (
            <BrutalBox testID={`${prefix}-check`} fill="ink" boxStyle={styles.next} onPress={check}>
              <Text style={[styles.nextText, { color: inkButtonText(g) }]}>{s.grammar.check}</Text>
            </BrutalBox>
          )}
          {!strictAccents ? (
            <Text testID={`${prefix}-accent-hint`} style={[styles.explain, { color: g.mu }]}>
              {s.grammar.accentHint}
            </Text>
          ) : null}
        </>
      ) : null}
      {docked ? <View style={{ height: padBottom }} /> : null}
    </View>
  );
}

type TypedProps<T> = {
  item: T;
  learnedLang: string;
  contentLang: Lang;
  strictAccents: boolean;
  onDone: (correct: boolean) => void;
};

// ---------------------------------------------------------------- open cloze
export function ClozeDrillItem({ item, learnedLang, contentLang, strictAccents, onDone }: TypedProps<ClozeItem>) {
  const g = useGrammarColors();
  const s = t();
  const locale = speechLang(learnedLang);
  const parts = useMemo(() => clozeParts(item.text), [item.text]);
  const [typed, setTyped] = useState<string[]>(() => item.answers.map(() => ''));
  const [result, setResult] = useState<boolean[] | null>(null);
  const firstRef = useRef<TextInput>(null);
  const inputs = useRef<(TextInput | null)[]>([]);
  useFocusOnNewCard(firstRef, true, item.id);
  useEffect(() => () => stopSpeaking(), []);

  // the next empty gap after gap i (then from the start), or -1 when i is the only one left
  const nextEmpty = (i: number) => {
    const order = [...typed.keys()].filter((k) => k > i).concat([...typed.keys()].filter((k) => k < i));
    return order.find((k) => typed[k].trim() === '') ?? -1;
  };
  const submitGap = (i: number) => {
    if (result) return;
    const n = nextEmpty(i);
    if (n >= 0) inputs.current[n]?.focus();
    else check();
  };

  const allRight = result !== null && result.every(Boolean);
  const check = () => {
    if (result || typed.some((x) => x.trim() === '')) return;
    setResult(gradeCloze(item, typed, strictAccents));
    speak(filledCloze(item.text, item.answers), locale);
  };

  const { docked, padBottom } = useDockedAction(
    result
      ? { label: s.grammar.nextArrow, tone: 'next', testID: 'grammar-next', onPress: () => onDone(allRight) }
      : { label: `✓ ${s.grammar.check}`, tone: 'check', testID: 'cloze-check', onPress: check }
  );

  return (
    <View style={styles.body} testID="cloze-item">
      <ItemHead title={s.grammar.clozeHint} />
      <BrutalBox boxStyle={styles.sentenceBox}>
        <View style={styles.clozeRow}>
          {parts.map((piece, i) => (
            <View key={i} style={styles.clozeSeg}>
              {piece
                .split(/\s+/)
                .filter(Boolean)
                .map((w, j) => (
                  <Text key={j} style={[styles.clozeWord, { color: g.ink }]}>
                    {w}
                  </Text>
                ))}
              {i < parts.length - 1 ? (
                <BrutalBox dashed={!!result && !result[i]} boxStyle={styles.clozeBox}>
                  <TextInput
                    ref={(el) => {
                      inputs.current[i] = el;
                      if (i === 0) firstRef.current = el;
                    }}
                    testID={`cloze-input-${i}`}
                    {...answerInputProps}
                    style={[styles.clozeInput, { color: g.ink }]}
                    value={typed[i]}
                    onChangeText={(v) => setTyped((prev) => prev.map((x, k) => (k === i ? v : x)))}
                    editable={!result}
                    returnKeyType={result || nextEmpty(i) < 0 ? 'done' : 'next'}
                    submitBehavior={result || nextEmpty(i) < 0 ? 'blurAndSubmit' : 'submit'}
                    onSubmitEditing={result ? undefined : () => submitGap(i)}
                  />
                </BrutalBox>
              ) : null}
            </View>
          ))}
        </View>
      </BrutalBox>
      {result ? (
        <>
          <BrutalBox testID={allRight ? 'cloze-correct' : 'cloze-wrong'} fill="b" boxStyle={styles.feedback}>
            <Text style={[styles.fixedLine, { color: g.onB }]}>{allRight ? s.grammar.correct : s.games.wrongFeedback}</Text>
            <Text testID="cloze-sentence" style={[styles.writeSentence, { color: g.onB }]}>
              {filledCloze(item.text, item.answers)}
            </Text>
            <Text testID="cloze-why" style={[styles.explain, { color: g.onB }]}>
              {item.why[contentLang] ?? item.why.en}
            </Text>
            <Text style={[styles.translation, { color: g.onB }]}>{item.tr[contentLang] ?? item.tr.en}</Text>
          </BrutalBox>
          {docked ? null : (
            <BrutalBox testID="grammar-next" fill="ink" boxStyle={styles.next} onPress={() => onDone(allRight)}>
              <Text style={[styles.nextText, { color: inkButtonText(g) }]}>{s.grammar.nextArrow}</Text>
            </BrutalBox>
          )}
        </>
      ) : docked ? null : (
        <BrutalBox testID="cloze-check" fill="ink" boxStyle={styles.next} onPress={check}>
          <Text style={[styles.nextText, { color: inkButtonText(g) }]}>{s.grammar.check}</Text>
        </BrutalBox>
      )}
      {!strictAccents ? (
        <Text testID="cloze-accent-hint" style={[styles.explain, { color: g.mu }]}>
          {s.grammar.accentHint}
        </Text>
      ) : null}
      {docked ? <View style={{ height: padBottom }} /> : null}
    </View>
  );
}

// ---------------------------------------------------------------- error correction: find AND type the fix
export function FixDrillItem({ item, learnedLang, contentLang, strictAccents, onDone }: TypedProps<FixItem>) {
  const g = useGrammarColors();
  const s = t();
  const words = useMemo(() => item.es.split(/\s+/).filter(Boolean), [item.es]);
  const [wrongTaps, setWrongTaps] = useState<Set<number>>(new Set());
  const [found, setFound] = useState(false);
  const tapWord = (i: number) => {
    if (found) return;
    if (i === item.wrongIndex) setFound(true);
    else setWrongTaps((prev) => new Set(prev).add(i));
  };
  const head = (
    <>
      <ItemHead title={found ? s.grammar.fixTypeHint : s.grammar.spotPrompt} />
      <BrutalBox boxStyle={styles.sentenceBox}>
        <View style={styles.wordRow}>
          {words.map((w, i) => {
            const isWrong = i === item.wrongIndex;
            const missed = wrongTaps.has(i);
            return (
              <BrutalBox
                key={i}
                testID={`fix-word-${i}`}
                fill={found && isWrong ? 'b' : 'paper'}
                dashed={missed}
                offset={2}
                style={missed ? styles.dim : undefined}
                boxStyle={styles.chip}
                onPress={() => tapWord(i)}
                disabled={found}
              >
                <Text style={[styles.chipText, { color: found && isWrong ? g.onB : g.ink }]}>{w}</Text>
              </BrutalBox>
            );
          })}
        </View>
      </BrutalBox>
      {!found && wrongTaps.size > 0 ? <Text style={[styles.note, { color: g.mu }]}>{s.grammar.spotWordFine}</Text> : null}
    </>
  );
  return (
    <TypedItem
      prefix="fix"
      itemId={item.id}
      head={head}
      enabled={found}
      forceWrong={wrongTaps.size > 0}
      isRight={(typed) => isFixAnswerRight(typed, item, strictAccents)}
      answer={item.answer}
      filled={fixedSentence(item.es, item.wrongIndex, item.answer)}
      why={item.explain[contentLang] ?? item.explain.en}
      whyId="fix-explain"
      extra={item.tr[contentLang] ?? item.tr.en}
      learnedLang={learnedLang}
      strictAccents={strictAccents}
      onDone={onDone}
    />
  );
}

// ---------------------------------------------------------------- word bank
export function BankDrillItem({ item, learnedLang, contentLang, strictAccents, onDone }: TypedProps<BankItem>) {
  const g = useGrammarColors();
  const s = t();
  const head = (
    <>
      <ItemHead title={s.grammar.bankHint} />
      <View style={styles.wordRow}>
        {item.bank.map((w, i) => (
          <BrutalBox key={`${w}-${i}`} testID={`bank-word-${i}`} fill="paper" offset={2} boxStyle={styles.chip}>
            <Text style={[styles.chipText, { color: g.ink }]}>{w}</Text>
          </BrutalBox>
        ))}
      </View>
      <BrutalBox boxStyle={styles.promptBox}>
        <Text testID="bank-sentence-gap" style={[styles.promptText, { color: g.ink }]}>
          {item.es}
        </Text>
      </BrutalBox>
    </>
  );
  return (
    <TypedItem
      prefix="bank"
      itemId={item.id}
      head={head}
      isRight={(typed) => isBankAnswerRight(typed, item, strictAccents)}
      answer={item.answer}
      filled={filledSentence(item.es, item.answer)}
      why={item.why[contentLang] ?? item.why.en}
      whyId="bank-why"
      extra={item.tr[contentLang] ?? item.tr.en}
      learnedLang={learnedLang}
      strictAccents={strictAccents}
      onDone={onDone}
    />
  );
}

// ---------------------------------------------------------------- typed noun form (article + plural)
export function NounDrillItem({ item, learnedLang, contentLang, strictAccents, onDone }: TypedProps<NounItem>) {
  const g = useGrammarColors();
  const head = (
    <>
      <ItemHead title={item.ask[contentLang] ?? item.ask.en} />
      <BrutalBox boxStyle={styles.promptBox}>
        <Text testID="noun-base" style={[styles.promptText, { color: g.ink }]}>
          {item.base}
        </Text>
      </BrutalBox>
    </>
  );
  return (
    <TypedItem
      prefix="noun"
      itemId={item.id}
      head={head}
      isRight={(typed) => isNounAnswerRight(typed, item, strictAccents)}
      answer={item.answer}
      filled={item.answer}
      why={item.why[contentLang] ?? item.why.en}
      whyId="noun-why"
      learnedLang={learnedLang}
      strictAccents={strictAccents}
      onDone={onDone}
    />
  );
}

const styles = StyleSheet.create({
  body: { gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', flexShrink: 1 },
  sentenceBox: { padding: 14 },
  wordRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 10, minHeight: tapTarget, justifyContent: 'center' },
  chipText: { fontSize: 18, fontWeight: '600', flexShrink: 1 },
  dim: { opacity: 0.55 },
  note: { fontSize: 13, textAlign: 'center' },
  feedback: { padding: 14, gap: 6 },
  fixedLine: { fontSize: 20, fontWeight: '700' },
  writeSentence: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  explain: { fontSize: 14, lineHeight: 20 },
  translation: { fontSize: 14, fontStyle: 'italic' },
  next: { paddingVertical: 14, alignItems: 'center' },
  nextText: { fontSize: 16, fontWeight: '700', textTransform: 'uppercase' },
  inputBox: { padding: 0 },
  input: { paddingVertical: 12, paddingHorizontal: 14, fontSize: 18 },
  promptBox: { padding: 16 },
  promptText: { fontSize: 22, lineHeight: 29, fontWeight: '600' },
  clozeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  clozeSeg: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  clozeWord: { fontSize: 20, lineHeight: 30 },
  clozeBox: { paddingVertical: 2, paddingHorizontal: 6, minWidth: 84 },
  clozeInput: { fontSize: 18, paddingVertical: 4, minWidth: 72 },
});
