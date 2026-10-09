import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '@/components/KText';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { normalizeWordToken } from '@/data/words';
import { getDb } from '@/lib/database';
import { strictAnswerMatch } from '@/lib/answerMatch';
import { answerInputProps } from '@/lib/inputProps';
import {
  cumulativeCorpusWordIds,
  isDictationItem,
  isFormItem,
  isArticleSetItem,
  isMarkItem,
  isMatchItem,
  isOrderItem,
  isSpotItem,
  isTransformItem,
  isWhyItem,
  type GrammarKind,
  type GrammarMarkItem,
  type GrammarTopicData,
} from '@/lib/games/content';
import { TENSE_NAMES, type FormItem, type LessonBlock, type MatchItem, type TenseId, type TransformItem, type WhyItem } from '@/lib/grammar/lessonTypes';
import { markTokens } from '@/lib/games/grammarMark';
import { speak } from '@/lib/speech';
import SpeakButton from '@/components/SpeakButton';
import { speechLang } from '@/lib/languages';
import { buildGrammarRound, grammarRoundItemKind, isChoiceRoundItem, wrongExplanation } from '@/lib/games/grammarChoice';
import { pickTransformRound, TRANSFORM_ROUND_SIZE } from '@/lib/grammar/transformRounds';
import { findWholeWord } from '@/lib/grammar/whyTarget';
import { optionHint } from '@/lib/grammar/optionHints';
import { buildGlossMap } from '@/lib/games/gloss';
import { hashString, shuffleNoFixedPoints, shuffleOptions } from '@/lib/shuffle';
import GlossText from '@/components/games/GlossText';
import { useDockedAction } from '@/components/learn/DockSlot';
import LessonBody from '@/components/grammar/LessonBody';
import { BrutalBox, SegmentBar, Sticker, inkButtonText, segmentsFilled, textOnFill } from '@/components/grammar/Brutal';
import AnswerCompare from '@/components/grammar/AnswerCompare';
import ResultBadge from '@/components/ResultBadge';
import { DictationDrillItem, OrderDrillItem, SpotDrillItem } from '@/components/grammar/NewKinds';
import { useGrammarColors, type GrammarColors } from '@/lib/grammarColors';

// The "which one is right, and why" drill, shared by the grammar course
// (app/grammar/[topic].tsx) and the Game tab's grammar-choice screen. It was
// only in the game before; the course needs exactly the same drill after its
// lesson, and a second copy would have drifted from this one within a month.
//
// the explanation appears after EVERY answer, right or wrong,
// with the rule, why the picked wrong option is wrong, and two more examples.
//
// The lesson drill walks through the kinds listed in the `kinds` prop and the
// lesson page starts each kind separately; without the prop, the Game tab's
// grammar-choice screen gets the old gap/mark-only (`choice`) round.

interface Props {
  topic: GrammarTopicData;
  learnedLang: string;
  contentLang: string;
  /** Fired once, when the last item has been answered and dismissed. */
  onFinish: (correct: number, total: number, roundItemIds?: string[]) => void;
  /** Extra rows under the explanation (e.g. the course's "back to the rule"). */
  footer?: React.ReactNode;
  /** which kinds go into the round; without it, only the choice kind (Game tab). */
  kinds?: readonly GrammarKind[];
  /** for the "transform" round's least-practiced-first ordering. */
  transformSeen?: Record<string, number>;
  /** for the feedback context: id of the item currently visible. */
  onItemChange?: (itemId: string) => void;
  /** stats of the round at its end (BEFORE onFinish): best combo, time, the first mistaken sentence. */
  onRoundStats?: (stats: RoundStats) => void;
  /** the X closing the brutalist header (same as the lesson page's ← button: back to the lesson). */
  onClose?: () => void;
  /**
   * resumes an unfinished round: same seed and item list, from where it
   * stopped. If the item list no longer matches (the lesson changed), the
   * round restarts from the beginning.
   */
  resume?: { seed: number; ids: string[]; index: number; correct: number };
  /** the round state after every answered item; the parent persists it. */
  onProgress?: (p: { seed: number; ids: string[]; index: number; correct: number; total: number }) => void;
}

// data for the end-of-round screen; in memory only, no DB write.
export interface RoundStats {
  bestCombo: number;
  seconds: number;
  /** The first mistaken sentence with the correct form (only for gap/mark and transform items). */
  miss: { sentence: string; highlight: string } | null;
}

const CHOICE_ONLY: readonly GrammarKind[] = ['choice'];

// the round length in seconds (a separate function so Date.now is not called at render time).
const secondsSince = (startedAt: number) => Math.max(0, Math.round((Date.now() - startedAt) / 1000));

// shared brutalist elements of the non-choice kinds: the b-filled feedback
// box (uppercase title + one sentence) and the ink-filled button.
// The right / wrong signal is the shared ResultBadge (colour + shape + ✓/✗ + text)
// above the box; the b-filled box only carries the explanation (if there is one).
function BrutalFeedback({ title, correct, children }: { title: string; correct: boolean; children?: React.ReactNode }) {
  return (
    <>
      <ResultBadge correct={correct} label={title} />
      {children ? (
        <BrutalBox fill="b" boxStyle={styles.brutalFeedback}>
          {children}
        </BrutalBox>
      ) : null}
    </>
  );
}

function BrutalInkButton({ g, testID, label, onPress }: { g: GrammarColors; testID: string; label: string; onPress: () => void }) {
  return (
    <BrutalBox testID={testID} fill="ink" boxStyle={styles.brutalNext} onPress={onPress}>
      <Text style={[styles.brutalNextText, { color: inkButtonText(g) }]}>{label}</Text>
    </BrutalBox>
  );
}

// The sentence translation of a choice (gap / mark) item sits behind the F button, just like
// for the transform item (transform-f). It is only drawn when the item has a `tr`
// (filled in by scripts/grammar-translate.py), otherwise there is no button.
function ChoiceTranslation({
  text,
  show,
  onToggle,
  g,
  colors,
  label,
}: {
  text: string;
  show: boolean;
  onToggle: () => void;
  g: GrammarColors;
  colors: (typeof Colors)['light'];
  label: string;
}) {
  return (
    <View style={styles.choiceTrRow}>
      {show ? (
        <Text testID="choice-translation" style={[styles.transformTranslation, styles.choiceTrText, { color: g.brutal ? g.mu : colors.tabIconDefault }]}>
          {text}
        </Text>
      ) : (
        <View style={styles.choiceTrText} />
      )}
      {g.brutal ? (
        <BrutalBox testID="choice-f" accessibilityLabel={label} fill={show ? 'b' : 'paper'} offset={2} boxStyle={styles.brutalF} onPress={onToggle}>
          <Text style={[styles.fButtonText, { color: show ? g.onB : g.ink }]}>F</Text>
        </BrutalBox>
      ) : (
        <Pressable
          testID="choice-f"
          accessibilityLabel={label}
          onPress={onToggle}
          style={[styles.fButton, { borderColor: colors.tint, backgroundColor: show ? colors.tint : 'transparent' }]}
        >
          <Text style={[styles.fButtonText, { color: show ? '#FFFFFF' : colors.tint }]}>F</Text>
        </Pressable>
      )}
    </View>
  );
}

function findFormTable(topic: GrammarTopicData, tableId: string): Extract<LessonBlock, { kind: 'table' }> | undefined {
  return topic.body.find((b): b is Extract<LessonBlock, { kind: 'table' }> => b.kind === 'table' && b.id === tableId);
}

// matching. The left column (English) stays in authored order,
// the right column (Spanish) uses a seeded shuffle so the test stays deterministic
// (seed computed from item.id, not Date.now()).
function MatchDrillItem({
  item,
  learnedLang,
  colors,
  s,
  onDone,
}: {
  item: MatchItem;
  learnedLang: string;
  colors: (typeof Colors)['light'];
  s: ReturnType<typeof t>;
  // the second argument is the number of right pairs (one mistake = one pair lost).
  onDone: (correct: boolean, correctUnits?: number) => void;
}) {
  const [rightOrder] = useState(() => shuffleNoFixedPoints(item.pairs.length, hashString(item.id)));
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrongPair, setWrongPair] = useState<{ left: number; right: number } | null>(null);
  const [hadWrong, setHadWrong] = useState(false);
  // matching earns partial credit: the pair that had a wrong tap loses
  // (a pair once, however many times it was missed), the rest count.
  const [errLefts, setErrLefts] = useState<Set<number>>(new Set());
  const g = useGrammarColors();
  // `pairs` {es, en} are literally Spanish/English; the right column is the LEARNED language
  // (English in the es→en direction), the left one is the other.
  const leftText = (p: MatchItem['pairs'][number]) => (learnedLang === 'en' ? p.es : p.en);
  const rightText = (p: MatchItem['pairs'][number]) => (learnedLang === 'en' ? p.en : p.es);

  const done = matched.size === item.pairs.length;

  const pressLeft = (li: number) => {
    if (matched.has(li) || done) return;
    setWrongPair(null);
    setSelectedLeft(li);
  };

  const pressRight = (pos: number) => {
    if (done || selectedLeft === null) return;
    const pairId = rightOrder[pos];
    if (matched.has(pairId)) return;
    if (selectedLeft === pairId) {
      const next = new Set(matched);
      next.add(pairId);
      setMatched(next);
      setSelectedLeft(null);
      setWrongPair(null);
    } else {
      setWrongPair({ left: selectedLeft, right: pos });
      setHadWrong(true);
      setErrLefts((prev) => new Set(prev).add(selectedLeft));
      setSelectedLeft(null);
    }
  };

  // brutalist matching: cell = box, matched = fill + tick,
  // selected = b fill, wrong = dashed border, faded.
  if (g.brutal) {
    const cell = (
      key: string,
      testID: string,
      text: string,
      state: 'matched' | 'selected' | 'wrong' | 'idle',
      onPress: () => void
    ) => (
      <BrutalBox
        key={key}
        testID={testID}
        fill={state === 'matched' ? 'a' : state === 'selected' ? 'b' : 'paper'}
        dashed={state === 'wrong'}
        style={state === 'wrong' ? styles.brutalDim : undefined}
        boxStyle={styles.brutalMatchInner}
        onPress={onPress}
        disabled={state === 'matched'}
      >
        <Text style={[styles.matchCellText, { color: state === 'matched' ? g.onA : state === 'selected' ? g.onB : g.ink }]}>{text}</Text>
        {state === 'matched' ? <Text style={[styles.matchCellText, { color: g.onFill }]}> ✓</Text> : null}
      </BrutalBox>
    );
    return (
      <View style={styles.matchBody}>
        <Text style={[styles.brutalHint, { color: g.mu }]}>{s.grammar.matchHint}</Text>
        <View style={styles.matchColumns}>
          <View style={styles.matchColumn}>
            {item.pairs.map((p, li) =>
              cell(
                `l${li}`,
                `match-left-${li}`,
                leftText(p),
                matched.has(li) ? 'matched' : wrongPair?.left === li ? 'wrong' : selectedLeft === li ? 'selected' : 'idle',
                () => pressLeft(li)
              )
            )}
          </View>
          <View style={styles.matchColumn}>
            {rightOrder.map((pairId, pos) =>
              cell(
                `r${pos}`,
                `match-right-${pos}`,
                rightText(item.pairs[pairId]),
                matched.has(pairId) ? 'matched' : wrongPair?.right === pos ? 'wrong' : 'idle',
                () => pressRight(pos)
              )
            )}
          </View>
        </View>
        {done ? (
          <>
            <BrutalFeedback correct={!hadWrong} title={hadWrong ? s.games.wrongFeedback : s.games.correctFeedback} />
            <BrutalInkButton g={g} testID="grammar-next" label={s.grammar.nextArrow} onPress={() => onDone(!hadWrong, item.pairs.length - errLefts.size)} />
          </>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.matchBody}>
      <Text style={[styles.hint, { color: colors.tabIconDefault }]}>{s.grammar.matchHint}</Text>
      <View style={styles.matchColumns}>
        <View style={styles.matchColumn}>
          {item.pairs.map((p, li) => {
            const isMatched = matched.has(li);
            const isSelected = selectedLeft === li;
            const isWrong = wrongPair?.left === li;
            const bg = isMatched ? '#22C55E22' : isWrong ? '#EF444422' : isSelected ? colors.tint + '22' : colors.card;
            const border = isMatched ? '#22C55E' : isWrong ? '#EF4444' : isSelected ? colors.tint : colors.tabIconDefault;
            return (
              <Pressable
                key={li}
                testID={`match-left-${li}`}
                style={[styles.matchCell, { backgroundColor: bg, borderColor: border }]}
                onPress={() => pressLeft(li)}
                disabled={isMatched}
              >
                <Text style={[styles.matchCellText, { color: colors.text }]}>{leftText(p)}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.matchColumn}>
          {rightOrder.map((pairId, pos) => {
            const isMatched = matched.has(pairId);
            const isWrong = wrongPair?.right === pos;
            const bg = isMatched ? '#22C55E22' : isWrong ? '#EF444422' : colors.card;
            const border = isMatched ? '#22C55E' : isWrong ? '#EF4444' : colors.tabIconDefault;
            return (
              <Pressable
                key={pos}
                testID={`match-right-${pos}`}
                style={[styles.matchCell, { backgroundColor: bg, borderColor: border }]}
                onPress={() => pressRight(pos)}
                disabled={isMatched}
              >
                <Text style={[styles.matchCellText, { color: colors.text }]}>{rightText(item.pairs[pairId])}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {done ? (
        <View style={[styles.explainCard, { backgroundColor: colors.card }]}>
          <ResultBadge correct={!hadWrong} label={hadWrong ? s.games.wrongFeedback : s.games.correctFeedback} />
          <Pressable testID="grammar-next" style={[styles.btn, { backgroundColor: colors.tint, marginTop: 12 }]} onPress={() => onDone(!hadWrong, item.pairs.length - errLefts.size)}>
            <Text style={styles.btnText}>{s.games.understood}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

// inflection drill. The table is a collapsed hint (LessonBody
// renders the SAME table block), not the answer.
function FormDrillItem({
  item,
  table,
  contentLang,
  learnedLang,
  colors,
  s,
  onDone,
}: {
  item: FormItem;
  table: Extract<LessonBlock, { kind: 'table' }> | undefined;
  contentLang: 'hu' | 'en' | 'es' | 'de';
  learnedLang: string;
  colors: (typeof Colors)['light'];
  s: ReturnType<typeof t>;
  onDone: (correct: boolean) => void;
}) {
  const [tableOpen, setTableOpen] = useState(false);
  // the question label ("Sustantivo") is Spanish, while the hint table's column header
  // is in the UI language ("Noun"), so the learner could not find it in the table. If the header
  // differs in another language, the table's name is given in parentheses next to the label.
  const headerCell = table?.header.find((h) => h.es === item.verb);
  const localizedVerb = headerCell ? (headerCell[contentLang] ?? headerCell.en) : undefined;
  const verbLabel = localizedVerb && localizedVerb !== item.verb ? `${item.verb} (${localizedVerb})` : item.verb;
  const [value, setValue] = useState('');
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);
  const g = useGrammarColors();

  const check = () => {
    const ok = [item.answer, ...(item.accept ?? [])].some((c) => value.trim().toLowerCase() === c.trim().toLowerCase());
    setCorrect(ok);
    setChecked(true);
    // the correct form is spoken after Check, after right and wrong answers alike, as on the
    // word card; the 🔊 is the same SpeakButton as there; the transform item already did this.
    speak(item.answer, speechLang(learnedLang));
  };

  // Check (and then Next) is a bar docked above the keyboard, as on the word card (DockSlot).
  const { docked, padBottom } = useDockedAction(
    checked
      ? { label: g.brutal ? s.grammar.nextArrow : s.games.understood, tone: 'next', testID: 'grammar-next', onPress: () => onDone(correct) }
      : { label: `✓ ${s.grammar.check}`, tone: 'check', testID: 'formCheck', onPress: check }
  );

  // brutalist inflection drill: the prompt in a box, the input field has a 2.5 px ink
  // border, corner 0; dashed border after a wrong answer; b-filled feedback.
  if (g.brutal) {
    return (
      <View style={styles.formBody}>
        {item.tense ? <TenseBadge tense={item.tense} colors={colors} /> : null}
        {table ? (
          <>
            <Pressable onPress={() => setTableOpen((v) => !v)} hitSlop={8}>
              <Text style={[styles.moreToggle, styles.brutalUnderline, { color: g.ink }]}>
                {tableOpen ? `▾ ${s.grammar.showTable}` : `▸ ${s.grammar.showTable}`}
              </Text>
            </Pressable>
            {tableOpen ? <LessonBody blocks={[table]} contentLang={contentLang} learnedLang={learnedLang} /> : null}
          </>
        ) : null}

        <Text style={[styles.brutalHint, { color: g.mu }]}>{s.grammar.formHint}</Text>
        <BrutalBox boxStyle={styles.brutalSentenceBox}>
          <Text style={[styles.formPrompt, { color: g.ink }]}>
            {verbLabel} · {item.person}
          </Text>
        </BrutalBox>
        <BrutalBox dashed={checked && !correct} style={checked && !correct ? styles.brutalDim : undefined} boxStyle={styles.brutalInputBox}>
          <TextInput
            testID="formInput"
            style={[styles.brutalInput, { color: g.ink }]}
            value={value}
            onChangeText={setValue}
            editable={!checked}
            placeholder={s.card.typeIn(learnedLang)}
            placeholderTextColor={g.mu}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </BrutalBox>
        {!checked ? (
          docked ? null : <BrutalInkButton g={g} testID="formCheck" label={s.grammar.check} onPress={check} />
        ) : (
          <>
            <BrutalFeedback correct={correct} title={correct ? s.games.correctFeedback : s.games.wrongFeedback}>
              {!correct ? <AnswerCompare typed={value} correct={item.answer} g={g} onFill /> : null}
            </BrutalFeedback>
            <SpeakButton testID="form-speak" onPress={() => speak(item.answer, speechLang(learnedLang))} brutalStyle={styles.formSpeakBrutal} />
            {docked ? null : <BrutalInkButton g={g} testID="grammar-next" label={s.grammar.nextArrow} onPress={() => onDone(correct)} />}
          </>
        )}
        {docked ? <View style={{ height: padBottom }} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.formBody}>
      {item.tense ? <TenseBadge tense={item.tense} colors={colors} /> : null}
      {table ? (
        <>
          <Pressable onPress={() => setTableOpen((v) => !v)} hitSlop={8}>
            <Text style={[styles.moreToggle, { color: colors.tint }]}>
              {tableOpen ? `▾ ${s.grammar.showTable}` : `▸ ${s.grammar.showTable}`}
            </Text>
          </Pressable>
          {tableOpen ? <LessonBody blocks={[table]} contentLang={contentLang} learnedLang={learnedLang} /> : null}
        </>
      ) : null}

      <Text style={[styles.hint, { color: colors.tabIconDefault }]}>{s.grammar.formHint}</Text>
      <Text style={[styles.formPrompt, { color: colors.text }]}>
        {verbLabel} · {item.person}
      </Text>
      <TextInput
        testID="formInput"
        style={[styles.formInput, { color: colors.text, borderColor: colors.tabIconDefault }]}
        value={value}
        onChangeText={setValue}
        editable={!checked}
        placeholder={s.card.typeIn(learnedLang)}
        placeholderTextColor={colors.tabIconDefault}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {!checked ? (
        docked ? null : (
          <Pressable testID="formCheck" style={[styles.btn, { backgroundColor: colors.tint }]} onPress={check}>
            <Text style={styles.btnText}>{s.grammar.check}</Text>
          </Pressable>
        )
      ) : (
        <View style={[styles.explainCard, { backgroundColor: colors.card }]}>
          <ResultBadge correct={correct} label={correct ? s.games.correctFeedback : s.games.wrongFeedback} />
          {!correct ? <AnswerCompare typed={value} correct={item.answer} g={g} /> : null}
          <SpeakButton testID="form-speak" onPress={() => speak(item.answer, speechLang(learnedLang))} style={styles.formSpeak} iconStyle={styles.formSpeakIcon} />
          {docked ? null : (
            <Pressable testID="grammar-next" style={[styles.btn, { backgroundColor: colors.tint, marginTop: 12 }]} onPress={() => onDone(correct)}>
              <Text style={styles.btnText}>{s.games.understood}</Text>
            </Pressable>
          )}
        </View>
      )}
      {docked ? <View style={{ height: padBottom }} /> : null}
    </View>
  );
}

// "Why this sentence?": the learner does not choose the missing word
// but the rule that makes the sentence the way it is. One
// attempt, as for the choice item (2.3): right → green + "next"; wrong
// → the chosen one red, the right one green, below it the chosen option's `wrong` text.
function WhyDrillItem({
  item,
  learnedLang,
  contentLang,
  colors,
  s,
  onDone,
}: {
  item: WhyItem;
  learnedLang: string;
  contentLang: 'hu' | 'en' | 'es' | 'de';
  colors: (typeof Colors)['light'];
  s: ReturnType<typeof t>;
  onDone: (correct: boolean) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [showTr, setShowTr] = useState(false);
  // the correct option should not always be the first; seeded shuffle from the item id.
  const [shown] = useState(() => shuffleOptions(item.options, item.correctIndex, hashString(item.id)));
  const answered = selected !== null;
  const isCorrect = answered && selected === shown.correctIndex;
  const g = useGrammarColors();

  const select = (i: number) => {
    if (answered) return;
    setSelected(i);
  };

  // if there is a `target`, it is shown highlighted in the sentence, and the question line
  // names what the question refers to (the user could not figure out
  // which word it was about).
  const targetSpan = item.target ? findWholeWord(item.es, item.target) : null;

  // brutalist "why" drill: sentence in a box (the target with b fill),
  // answers as boxes (right = fill + tick, wrong = dashed, faded).
  if (g.brutal) {
    return (
      <View style={styles.whyBody}>
        {item.tense ? <TenseBadge tense={item.tense} colors={colors} /> : null}
        <BrutalBox boxStyle={styles.brutalSentenceBox}>
          <View style={styles.whySentenceRow}>
            <Text style={[styles.sentence, { color: g.ink }]}>
              {targetSpan ? (
                <>
                  {item.es.slice(0, targetSpan.start)}
                  <Text style={{ backgroundColor: g.b, color: g.onB, fontWeight: '500' }}>
                    {item.es.slice(targetSpan.start, targetSpan.end)}
                  </Text>
                  {item.es.slice(targetSpan.end)}
                </>
              ) : (
                item.es
              )}
            </Text>
            <Pressable onPress={() => speak(item.es, speechLang(learnedLang))} hitSlop={10}>
              <Text style={styles.speak}>🔊</Text>
            </Pressable>
          </View>
          {answered || showTr ? (
            <Text style={[styles.whyTranslation, { color: g.mu }]}>{item.tr[contentLang] ?? item.tr.en}</Text>
          ) : (
            <Pressable testID="why-show-translation" onPress={() => setShowTr(true)} style={styles.whyTrButton}>
              <Text style={[styles.whyTrButtonText, styles.brutalUnderline, { color: g.ink }]}>{s.grammar.showTranslation}</Text>
            </Pressable>
          )}
        </BrutalBox>
        {item.target ? (
          <Text style={[styles.brutalQuestion, { color: g.ink }]}>{s.games.grammarChoice.whyQuestion(item.target)}</Text>
        ) : null}

        <View style={styles.brutalWhyOptions}>
          {shown.options.map((opt, i) => {
            const isPicked = selected === i;
            const isRightAnswer = i === shown.correctIndex;
            const hit = answered && isRightAnswer;
            const miss = answered && isPicked && !isRightAnswer;
            return (
              <BrutalBox
                key={i}
                testID="grammar-option"
                fill={hit ? 'a' : 'paper'}
                dashed={miss}
                style={miss ? styles.brutalDim : undefined}
                boxStyle={styles.brutalWhyOption}
                onPress={() => select(i)}
                disabled={answered}
              >
                <Text style={[styles.brutalOptionText, { color: hit ? g.onFill : g.ink }]}>{opt.text[contentLang] ?? opt.text.en}</Text>
                {hit ? <Text style={[styles.brutalOptionText, { color: g.onFill }]}> ✓</Text> : null}
                {/* lowercase example line under the rule's name, showing what belongs to it. */}
                {optionHint(opt.text, contentLang) ? (
                  <Text testID="why-option-hint" style={[styles.optionHint, { color: hit ? g.onFill : g.mu }]}>
                    {optionHint(opt.text, contentLang)}
                  </Text>
                ) : null}
              </BrutalBox>
            );
          })}
        </View>

        {answered ? (
          <>
            <BrutalFeedback correct={isCorrect} title={isCorrect ? s.games.correctFeedback : s.games.wrongFeedback}>
              {!isCorrect ? (
                <Text style={[styles.explainText, { color: g.onB }]}>
                  {shown.options[selected].wrong?.[contentLang] ?? shown.options[selected].wrong?.en ?? ''}
                </Text>
              ) : null}
            </BrutalFeedback>
            <BrutalInkButton g={g} testID="grammar-next" label={s.grammar.nextArrow} onPress={() => onDone(isCorrect)} />
          </>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.whyBody}>
      {item.tense ? <TenseBadge tense={item.tense} colors={colors} /> : null}
      <View style={[styles.sentenceCard, { backgroundColor: colors.card }]}>
        <View style={styles.whySentenceRow}>
          <Text style={[styles.sentence, { color: colors.text }]}>
            {targetSpan ? (
              <>
                {item.es.slice(0, targetSpan.start)}
                <Text style={[styles.whyTargetBold, { color: colors.tint }]}>
                  {item.es.slice(targetSpan.start, targetSpan.end)}
                </Text>
                {item.es.slice(targetSpan.end)}
              </>
            ) : (
              item.es
            )}
          </Text>
          <Pressable onPress={() => speak(item.es, speechLang(learnedLang))} hitSlop={10}>
            <Text style={styles.speak}>🔊</Text>
          </Pressable>
        </View>
        {answered || showTr ? (
          <Text style={[styles.whyTranslation, { color: colors.tabIconDefault }]}>
            {item.tr[contentLang] ?? item.tr.en}
          </Text>
        ) : (
          <Pressable testID="why-show-translation" onPress={() => setShowTr(true)} style={styles.whyTrButton}>
            <Text style={[styles.whyTrButtonText, { color: colors.tint }]}>{s.grammar.showTranslation}</Text>
          </Pressable>
        )}
      </View>
      {item.target ? (
        <Text style={[styles.whyQuestion, { color: colors.tint }]}>
          {s.games.grammarChoice.whyQuestion(item.target)}
        </Text>
      ) : null}

      <View style={styles.options}>
        {shown.options.map((opt, i) => {
          const isPicked = selected === i;
          const isRightAnswer = i === shown.correctIndex;
          let bg = colors.card;
          let border = colors.tabIconDefault;
          if (answered && isRightAnswer) {
            bg = '#22C55E22';
            border = '#22C55E';
          } else if (answered && isPicked && !isRightAnswer) {
            bg = '#EF444422';
            border = '#EF4444';
          }
          return (
            <Pressable
              key={i}
              testID="grammar-option"
              style={[styles.option, { backgroundColor: bg, borderColor: border }]}
              onPress={() => select(i)}
              disabled={answered}
            >
              <Text style={[styles.optionText, { color: colors.text }]}>{opt.text[contentLang] ?? opt.text.en}</Text>
              {optionHint(opt.text, contentLang) ? (
                <Text testID="why-option-hint" style={[styles.optionHint, { color: colors.tabIconDefault }]}>
                  {optionHint(opt.text, contentLang)}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {answered ? (
        <View style={[styles.explainCard, { backgroundColor: colors.card }]}>
          <ResultBadge correct={isCorrect} label={isCorrect ? s.games.correctFeedback : s.games.wrongFeedback} />
          {!isCorrect ? (
            <Text style={[styles.explainText, { color: colors.text }]}>
              {shown.options[selected].wrong?.[contentLang] ?? shown.options[selected].wrong?.en ?? ''}
            </Text>
          ) : null}
          <Pressable testID="grammar-next" style={[styles.btn, { backgroundColor: colors.tint, marginTop: 12 }]} onPress={() => onDone(isCorrect)}>
            <Text style={styles.btnText}>{s.games.understood}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

// tense badge, shown on every kind
// where the item has a `tense` field (choice/form/why/transform).
function TenseBadge({ tense, colors }: { tense: { from: TenseId; to: TenseId }; colors: (typeof Colors)['light'] }) {
  const g = useGrammarColors();
  if (g.brutal) {
    return <Sticker label={`${TENSE_NAMES[tense.from].es} → ${TENSE_NAMES[tense.to].es}`} fill="b" rotate={-3} />;
  }
  return (
    <View style={[styles.tenseBadge, { backgroundColor: colors.tint + '22' }]}>
      <Text style={[styles.tenseBadgeText, { color: colors.tint }]}>
        {TENSE_NAMES[tense.from].es} → {TENSE_NAMES[tense.to].es}
      </Text>
    </View>
  );
}

// sentence transformation from one tense to another.
// The `key={item.id}` is on the caller's side (as with the other branches),
// so the input field starts empty on the next item.
function TransformDrillItem({
  item,
  contentLang,
  strictAccents,
  colors,
  s,
  onDone,
}: {
  item: TransformItem;
  contentLang: 'hu' | 'en' | 'es' | 'de';
  strictAccents: boolean;
  colors: (typeof Colors)['light'];
  s: ReturnType<typeof t>;
  onDone: (correct: boolean) => void;
}) {
  const [showF, setShowF] = useState(false);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<'ok' | 'bad' | null>(null);
  const g = useGrammarColors();

  const check = () => {
    const candidates = [item.answer, ...(item.accept ?? [])];
    const ok = candidates.some((c) => strictAnswerMatch(input, c, { strictAccents }));
    setResult(ok ? 'ok' : 'bad');
    // the correct sentence is spoken, after right and wrong answers alike.
    speak(item.answer, speechLang('es'));
  };

  const inputBorder = result === 'ok' ? '#22C55E' : result === 'bad' ? '#EF4444' : colors.tabIconDefault;

  // Check (and then Next) is a bar docked above the keyboard, as on the word card (DockSlot).
  const { docked, padBottom } = useDockedAction(
    result === null
      ? { label: `✓ ${s.grammar.check}`, tone: 'check', testID: 'transform-check', onPress: check }
      : { label: s.grammar.next, tone: 'next', testID: 'transform-next', onPress: () => onDone(result === 'ok') }
  );

  // brutalist sentence transformation: the sentence in a box, the F button a small box, the
  // input field has a 2.5 px ink border (dashed after a wrong answer), b-filled feedback.
  if (g.brutal) {
    return (
      <View style={styles.transformBody}>
        <TenseBadge tense={item.tense} colors={colors} />

        <BrutalBox boxStyle={styles.brutalSentenceBox}>
          <View style={styles.transformCardRow}>
            <Text style={[styles.transformSentence, { color: g.ink }]}>{item.prompt.es}</Text>
            <BrutalBox
              testID="transform-f"
              accessibilityLabel={s.grammar.showTranslation}
              fill={showF ? 'b' : 'paper'}
              offset={2}
              boxStyle={styles.brutalF}
              onPress={() => setShowF((v) => !v)}
            >
              <Text style={[styles.fButtonText, { color: showF ? g.onB : g.ink }]}>F</Text>
            </BrutalBox>
          </View>
          {showF ? (
            <Text style={[styles.transformTranslation, { color: g.mu }]}>{item.prompt[contentLang] ?? item.prompt.en}</Text>
          ) : null}
        </BrutalBox>

        <Text style={[styles.brutalQuestion, { color: g.ink }]}>
          {s.grammar.rewriteTo(TENSE_NAMES[item.tense.to][contentLang] ?? TENSE_NAMES[item.tense.to].en)}
        </Text>
        <BrutalBox dashed={result === 'bad'} style={result === 'bad' ? styles.brutalDim : undefined} boxStyle={styles.brutalInputBox}>
          <TextInput
            testID="transform-input"
            {...answerInputProps}
            style={[styles.brutalInput, { color: g.ink }]}
            value={input}
            onChangeText={setInput}
            editable={result === null}
            placeholder={s.card.typeIn('es')}
            placeholderTextColor={g.mu}
          />
        </BrutalBox>

        {result === null ? (
          docked ? null : <BrutalInkButton g={g} testID="transform-check" label={s.grammar.check} onPress={check} />
        ) : (
          <>
            <BrutalFeedback correct={result === 'ok'} title={result === 'ok' ? s.grammar.correct : s.grammar.correctAnswer}>
              {result === 'bad' ? (
                <Text style={[styles.brutalAnswer, { backgroundColor: g.a, color: g.onFill }]}> {item.answer} </Text>
              ) : null}
              <Text style={[styles.explainText, { color: g.onB }]}>{item.why[contentLang] ?? item.why.en}</Text>
            </BrutalFeedback>
            {docked ? null : <BrutalInkButton g={g} testID="transform-next" label={s.grammar.next} onPress={() => onDone(result === 'ok')} />}
          </>
        )}

        {!strictAccents ? <Text style={[styles.accentHint, { color: g.mu }]}>{s.grammar.accentHint}</Text> : null}
        {docked ? <View style={{ height: padBottom }} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.transformBody}>
      <TenseBadge tense={item.tense} colors={colors} />

      <View style={[styles.transformCard, { backgroundColor: colors.card }]}>
        <View style={styles.transformCardRow}>
          <Text style={[styles.transformSentence, { color: colors.text }]}>{item.prompt.es}</Text>
          <Pressable
            testID="transform-f"
            accessibilityLabel={s.grammar.showTranslation}
            onPress={() => setShowF((v) => !v)}
            style={[styles.fButton, { borderColor: colors.tint, backgroundColor: showF ? colors.tint : 'transparent' }]}
          >
            <Text style={[styles.fButtonText, { color: showF ? '#FFFFFF' : colors.tint }]}>F</Text>
          </Pressable>
        </View>
        {showF ? (
          <Text style={[styles.transformTranslation, { color: colors.tabIconDefault }]}>
            {item.prompt[contentLang] ?? item.prompt.en}
          </Text>
        ) : null}
      </View>

      <Text style={[styles.transformLabel, { color: colors.text }]}>
        {s.grammar.rewriteTo(TENSE_NAMES[item.tense.to][contentLang] ?? TENSE_NAMES[item.tense.to].en)}
      </Text>
      <TextInput
        testID="transform-input"
        {...answerInputProps}
        style={[styles.transformInput, { color: colors.text, borderColor: inputBorder }]}
        value={input}
        onChangeText={setInput}
        editable={result === null}
        placeholder={s.card.typeIn('es')}
        placeholderTextColor={colors.tabIconDefault}
      />

      {result === null ? (
        docked ? null : (
          <Pressable testID="transform-check" style={[styles.btn, { backgroundColor: colors.tint }]} onPress={check}>
            <Text style={styles.btnText}>{s.grammar.check}</Text>
          </Pressable>
        )
      ) : (
        <View
          style={[
            styles.transformResultBox,
            result === 'ok'
              ? { backgroundColor: '#22C55E22', borderColor: '#22C55E' }
              : { backgroundColor: '#EF444422', borderColor: '#EF4444' },
          ]}
        >
          {result === 'ok' ? (
            <>
              <ResultBadge correct label={s.grammar.correct} />
              <Text style={[styles.explainText, { color: colors.text }]}>{item.why[contentLang] ?? item.why.en}</Text>
            </>
          ) : (
            <>
              <ResultBadge correct={false} label={s.grammar.correctAnswer} />
              <Text style={[styles.transformAnswer, { color: colors.text }]}>{item.answer}</Text>
              <Text style={[styles.explainText, { color: colors.text }]}>{item.why[contentLang] ?? item.why.en}</Text>
            </>
          )}
        </View>
      )}

      {result !== null && !docked ? (
        <Pressable testID="transform-next" style={[styles.btn, { backgroundColor: colors.text }]} onPress={() => onDone(result === 'ok')}>
          <Text style={styles.btnText}>{s.grammar.next}</Text>
        </Pressable>
      ) : null}

      {!strictAccents ? (
        <Text style={[styles.accentHint, { color: colors.tabIconDefault }]}>{s.grammar.accentHint}</Text>
      ) : null}
      {docked ? <View style={{ height: padBottom }} /> : null}
    </View>
  );
}

export default function GrammarDrill({ topic, learnedLang, contentLang, onFinish, footer, kinds = CHOICE_ONLY, transformSeen, onItemChange, onRoundStats, onClose, resume, onProgress }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();

  const [seed] = useState(() => resume?.seed ?? hashString(`${topic.topic}:${Date.now()}`));
  const fullRound = useMemo(() => buildGrammarRound(topic, seed), [topic, seed]);
  const transformPool = useMemo(() => fullRound.map((r) => r.item).filter(isTransformItem), [fullRound]);
  // round-based batching (least-practiced first, at most 10 items)
  // only applies when a pure "sentence transformation only" start
  // REALLY has more items than one round; on a smaller lesson (where one round covers
  // every item anyway) the old authored-order, seedless behaviour
  // stays, so the other kinds and the small lessons' deterministic
  // order are not upset for no reason.
  const useTransformRounds = kinds.length === 1 && kinds[0] === 'transform' && transformPool.length > TRANSFORM_ROUND_SIZE;
  const round = useMemo(() => {
    if (useTransformRounds) {
      return pickTransformRound(transformPool, transformSeen ?? {}, TRANSFORM_ROUND_SIZE, seed).map((item) => ({ item }));
    }
    return fullRound.filter((r) => kinds.includes(grammarRoundItemKind(r)));
  }, [useTransformRounds, transformPool, transformSeen, seed, fullRound, kinds]);
  // id list of the round's items (for saving an unfinished round and for validating
  // the resume) and the round's units: one item is 1 unit, matching is as many as it has
  // pairs (the partial credit is the ratio of right pairs, so the round total is in pairs too).
  const roundIds = useMemo(() => round.map((r) => r.item.id), [round]);
  const totalUnits = useMemo(() => round.reduce((n, r) => n + (isMatchItem(r.item) ? r.item.pairs.length : 1), 0), [round]);
  const resumeOk =
    !!resume &&
    resume.index > 0 &&
    resume.index < roundIds.length &&
    resume.ids.length === roundIds.length &&
    resume.ids.every((id, i) => id === roundIds[i]);
  const [index, setIndex] = useState(resumeOk ? resume.index : 0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(resumeOk ? resume.correct : 0);
  // whether the choice item's sentence translation (F button) is open; closed again for a new item.
  const [showTr, setShowTr] = useState(false);
  // consecutive right answers within the round, in memory only (no
  // DB write); resets on a mistake, the combo sticker shows from "x2".
  const [combo, setCombo] = useState(0);
  const comboRef = useRef(0);
  const bestComboRef = useRef(0);
  const missRef = useRef<RoundStats['miss']>(null);
  const [startedAt] = useState(() => Date.now());
  const noteResult = (wasCorrect: boolean, miss?: RoundStats['miss']) => {
    comboRef.current = wasCorrect ? comboRef.current + 1 : 0;
    bestComboRef.current = Math.max(bestComboRef.current, comboRef.current);
    setCombo(comboRef.current);
    if (!wasCorrect && miss && !missRef.current) missRef.current = miss;
  };
  // the Settings accent-strictness switch, fetched once, only if the
  // round has a transform item (the other branches don't need it).
  const [strictAccents, setStrictAccents] = useState(false);
  // dictation uses the accent setting too.
  const hasTransform = kinds.includes('transform') || kinds.includes('dictation');
  useEffect(() => {
    if (!hasTransform) return;
    getDb().getStrictAccents().then(setStrictAccents).catch(() => {});
  }, [hasTransform]);

  // from this the parent knows which item the learner
  // complained about, to put it in the feedback context.
  useEffect(() => {
    const id = round[index]?.item.id;
    if (id) onItemChange?.(id);
  }, [round, index, onItemChange]);

  const roundItem = round[index];
  if (!roundItem) return null;

  const advance = (finalCorrectCount: number) => {
    if (index + 1 < round.length) {
      onProgress?.({ seed, ids: roundIds, index: index + 1, correct: finalCorrectCount, total: totalUnits });
      setIndex((i) => i + 1);
      setSelected(null);
      setShowTr(false);
      return;
    }
    // the round's item ids are only needed for round-based batching (the
    // parent computes the `seen` map from them); the other branches get the earlier
    // 2-argument call, so the existing onFinish tests
    // (toHaveBeenCalledWith(correct, total)) don't break.
    onRoundStats?.({
      bestCombo: bestComboRef.current,
      seconds: secondsSince(startedAt),
      miss: missRef.current,
    });
    if (useTransformRounds) {
      onFinish(finalCorrectCount, totalUnits, round.map((r) => r.item.id));
    } else {
      onFinish(finalCorrectCount, totalUnits);
    }
  };

  // The gap/mark answer that got us here was scored on selection (below), so
  // correctCount is already final by the time this render exists.
  const next = () => advance(correctCount);

  // Match/form score at COMPLETION time, in the same event as the "next" tap,
  // so correctCount's state update has not landed yet; the final tally is
  // computed locally instead of trusted from the (possibly stale) closure.
  // `correctUnits` is the partial credit (matching's right pairs); without it the item is 1 unit, right or not.
  const completeItem = (wasCorrect: boolean, correctUnits?: number) => {
    noteResult(
      wasCorrect,
      isTransformItem(roundItem.item)
        ? { sentence: roundItem.item.answer, highlight: roundItem.item.answer }
        : undefined
    );
    const finalCount = correctCount + (correctUnits ?? (wasCorrect ? 1 : 0));
    if (finalCount !== correctCount) setCorrectCount(finalCount);
    advance(finalCount);
  };

  // neo-brutalist header: segmented progress + combo sticker (b).
  const progressText = s.games.grammarChoice.progress(index + 1, round.length);
  const header = g.brutal ? (
    <View style={styles.brutalHead}>
      <View style={styles.brutalHeadRow}>
        {onClose ? (
          <BrutalBox testID="grammar-back" offset={2} boxStyle={styles.brutalClose} onPress={onClose}>
            <Text style={[styles.brutalCloseText, { color: g.ink }]}>✕</Text>
          </BrutalBox>
        ) : null}
        <SegmentBar
          testID="grammar-drill-segments"
          segments={Math.min(8, Math.max(5, round.length))}
          filled={segmentsFilled((index / round.length) * 100, Math.min(8, Math.max(5, round.length)))}
          style={styles.brutalSegments}
        />
        {combo >= 2 ? <Sticker testID="grammar-combo" label={s.grammar.comboLabel(combo)} fill="b" rotate={5} /> : null}
      </View>
      <Text testID="grammar-drill-progress" style={[styles.brutalProgress, { color: g.mu }]}>
        {progressText}
      </Text>
    </View>
  ) : (
    <Text testID="grammar-drill-progress" style={[styles.progress, { color: colors.tabIconDefault }]}>
      {progressText}
    </Text>
  );

  if (!isChoiceRoundItem(roundItem)) {
    return (
      <ScrollView contentContainerStyle={[styles.body, g.brutal && styles.brutalBodyPad]} keyboardShouldPersistTaps="handled">
        {header}
        {isMatchItem(roundItem.item) ? (
          <MatchDrillItem key={roundItem.item.id} item={roundItem.item} learnedLang={learnedLang} colors={colors} s={s} onDone={completeItem} />
        ) : isFormItem(roundItem.item) ? (
          <FormDrillItem
            key={roundItem.item.id}
            item={roundItem.item}
            table={findFormTable(topic, roundItem.item.table)}
            contentLang={contentLang as 'hu' | 'en' | 'es' | 'de'}
            learnedLang={learnedLang}
            colors={colors}
            s={s}
            onDone={completeItem}
          />
        ) : isWhyItem(roundItem.item) ? (
          <WhyDrillItem
            key={roundItem.item.id}
            item={roundItem.item}
            learnedLang={learnedLang}
            contentLang={contentLang as 'hu' | 'en' | 'es' | 'de'}
            colors={colors}
            s={s}
            onDone={completeItem}
          />
        ) : isSpotItem(roundItem.item) ? (
          <SpotDrillItem
            key={roundItem.item.id}
            item={roundItem.item}
            learnedLang={learnedLang}
            contentLang={contentLang as 'hu' | 'en' | 'es' | 'de'}
            onDone={completeItem}
          />
        ) : isOrderItem(roundItem.item) ? (
          <OrderDrillItem
            key={roundItem.item.id}
            item={roundItem.item}
            learnedLang={learnedLang}
            contentLang={contentLang as 'hu' | 'en' | 'es' | 'de'}
            onDone={completeItem}
          />
        ) : isDictationItem(roundItem.item) ? (
          <DictationDrillItem
            key={roundItem.item.id}
            item={roundItem.item}
            learnedLang={learnedLang}
            contentLang={contentLang as 'hu' | 'en' | 'es' | 'de'}
            strictAccents={strictAccents}
            onDone={completeItem}
          />
        ) : isTransformItem(roundItem.item) ? (
          <TransformDrillItem
            key={roundItem.item.id}
            item={roundItem.item}
            contentLang={contentLang as 'hu' | 'en' | 'es' | 'de'}
            strictAccents={strictAccents}
            colors={colors}
            s={s}
            onDone={completeItem}
          />
        ) : null}
      </ScrollView>
    );
  }

  const current = roundItem;
  const answered = selected !== null;
  const isCorrect = answered && selected === current.correctIndex;
  const pickedText = answered ? current.options[selected] : undefined;
  // in the mark task the sentence stays whole, there is nothing to split in two. The
  // index of the tappable words points into `current.options` (the round builder puts
  // the sentence's words there), spaces and punctuation are left out of it.
  const marking = isMarkItem(current.item);
  const [before, after] = marking ? ['', ''] : current.item.sentence.split('___');
  const markParts = marking ? markTokens(current.item.sentence) : [];
  const wordIndexByToken: number[] = [];
  let wordCursor = 0;
  for (const part of markParts) wordIndexByToken.push(part.isWord ? wordCursor++ : -1);

  const knownIds = cumulativeCorpusWordIds(topic.level, learnedLang);
  const overrides = Object.fromEntries((topic.glossary ?? []).map((g) => [normalizeWordToken(g.word), g.gloss]));

  const selectOption = (optIdx: number) => {
    if (answered) return;
    setSelected(optIdx);
    // for the el / la item the noun's meaning (tr) opens by itself after the answer; the F button still toggles.
    if (isArticleSetItem(current.item)) setShowTr(true);
    if (optIdx === current.correctIndex) setCorrectCount((c) => c + 1);
    // the correct, filled-in sentence is spoken, after right and wrong answers alike.
    speak(
      marking ? current.item.sentence : current.item.sentence.replace('___', current.options[current.correctIndex]),
      speechLang(learnedLang)
    );
    noteResult(
      optIdx === current.correctIndex,
      marking
        ? { sentence: (current.item as GrammarMarkItem).sentence, highlight: current.options[current.correctIndex] }
        : {
            sentence: current.item.sentence.replace('___', current.options[current.correctIndex]),
            highlight: current.options[current.correctIndex],
          }
    );
  };

  // the badge only shows on the gap branch (choice); the mark item
  // has no `tense` field (lessonTypes.ts).
  const badgeTense = !marking && !isMarkItem(current.item) ? current.item.tense : undefined;
  // the sentence's translation in the UI language (if the item has a `tr`).
  const choiceTr = current.item.tr ? (current.item.tr[contentLang as 'hu' | 'en' | 'es' | 'de'] ?? current.item.tr.en) : undefined;

  // Neo-brutalist: the sentence in a box, the gap a b-filled block,
  // the answers in a 2x2 grid, the right one = fill + tick,
  // the feedback box b-filled.
  if (g.brutal) {
    const blankFill = answered ? (isCorrect ? g.a : g.ink) : g.b;
    const blankColor = answered ? (isCorrect ? g.onA : g.bg) : g.onB;
    return (
      <ScrollView contentContainerStyle={[styles.body, g.brutal && styles.brutalBodyPad]} keyboardShouldPersistTaps="handled">
        {header}
        {badgeTense ? <TenseBadge tense={badgeTense} colors={colors} /> : null}

        {marking ? (
          <Text style={[styles.markPrompt, { color: g.ink, textTransform: 'uppercase' }]}>
            {s.games.grammarChoice.markPrompt(
              s.games.grammarChoice.wordClass[(current.item as GrammarMarkItem).target] ??
                (current.item as GrammarMarkItem).target
            )}
          </Text>
        ) : null}
        <BrutalBox boxStyle={styles.brutalSentenceBox}>
          {marking ? (
            <Text style={[styles.sentence, { color: g.ink }]}>
              {markParts.map((tok, i) => {
                if (!tok.isWord) return <Text key={`s${i}`}>{tok.text}</Text>;
                const wordIndex = wordIndexByToken[i];
                const isRightAnswer = wordIndex === current.correctIndex;
                const isPicked = selected === wordIndex;
                const hit = answered && isRightAnswer;
                const miss = answered && isPicked && !isRightAnswer;
                return (
                  <Text
                    key={`w${i}`}
                    testID="grammar-mark-word"
                    onPress={() => selectOption(wordIndex)}
                    style={{
                      color: hit ? g.onFill : miss ? g.bg : g.ink,
                      backgroundColor: hit ? g.a : miss ? g.ink : undefined,
                      fontWeight: '500',
                      textDecorationLine: answered ? 'none' : 'underline',
                    }}
                  >
                    {tok.text}
                  </Text>
                );
              })}
            </Text>
          ) : (
            <Text style={[styles.sentence, { color: g.ink }]}>
              {before}
              <Text style={{ backgroundColor: blankFill, color: blankColor, fontWeight: '500' }}>
                {` ${answered ? pickedText : '____'} `}
              </Text>
              {after}
            </Text>
          )}
        </BrutalBox>
        {choiceTr ? (
          <ChoiceTranslation text={choiceTr} show={showTr} onToggle={() => setShowTr((v) => !v)} g={g} colors={colors} label={s.grammar.showTranslation} />
        ) : null}

        <View style={marking ? styles.hiddenOptions : styles.brutalOptions}>
          {(marking ? [] : current.options).map((opt, i) => {
            const isPicked = selected === i;
            const isRightAnswer = i === current.correctIndex;
            const fill = answered && isRightAnswer ? 'a' : answered && isPicked ? 'ink' : 'paper';
            return (
              <BrutalBox
                key={opt}
                testID="grammar-option"
                fill={fill}
                style={styles.brutalOption}
                boxStyle={styles.brutalOptionInner}
                onPress={() => selectOption(i)}
                disabled={answered}
              >
                <Text style={[styles.brutalOptionText, { color: textOnFill(g, fill) }]}>{opt}</Text>
                {answered && isRightAnswer ? (
                  <Text style={[styles.brutalOptionText, { color: textOnFill(g, fill) }]}> ✓</Text>
                ) : null}
              </BrutalBox>
            );
          })}
        </View>

        {answered ? (
          <>
          <ResultBadge correct={isCorrect} label={isCorrect ? s.grammar.perfect : s.games.wrongFeedback} />
          <BrutalBox fill="b" boxStyle={styles.brutalFeedback}>
            <Text style={[styles.explainText, { color: g.onB }]}>{current.item.why[contentLang] ?? current.item.why.en}</Text>
            {!isCorrect && pickedText !== undefined ? (
              <Text style={[styles.explainText, { color: g.onB }]}>
                {wrongExplanation(current.item, pickedText, contentLang) ??
                  (marking ? s.games.grammarChoice.markWrong : '')}
              </Text>
            ) : null}
            {current.item.examples.map((ex, i) => (
              <GlossText
                key={i}
                text={ex}
                glosses={buildGlossMap(ex, { learnedLang, nativeLang: contentLang, knownWordIds: knownIds, overrides })}
                learnedLang={learnedLang}
                style={[styles.example, { color: g.onB }]}
              />
            ))}
          </BrutalBox>
          </>
        ) : null}
        {answered ? (
          <BrutalBox testID="grammar-next" fill="ink" boxStyle={styles.brutalNext} onPress={next}>
            <Text style={[styles.brutalNextText, { color: inkButtonText(g) }]}>{s.grammar.nextArrow}</Text>
          </BrutalBox>
        ) : null}
        {answered ? footer : null}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.body, g.brutal && styles.brutalBodyPad]} keyboardShouldPersistTaps="handled">
      <Text testID="grammar-drill-progress" style={[styles.progress, { color: colors.tabIconDefault }]}>
        {s.games.grammarChoice.progress(index + 1, round.length)}
      </Text>
      {badgeTense ? <TenseBadge tense={badgeTense} colors={colors} /> : null}

      {marking ? (
        <>
          <Text style={[styles.markPrompt, { color: colors.text }]}>
            {s.games.grammarChoice.markPrompt(
              s.games.grammarChoice.wordClass[(current.item as GrammarMarkItem).target] ??
                (current.item as GrammarMarkItem).target
            )}
          </Text>
          <View style={[styles.sentenceCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.sentence, { color: colors.text }]}>
              {markParts.map((tok, i) => {
                if (!tok.isWord) return <Text key={`s${i}`}>{tok.text}</Text>;
                const wordIndex = wordIndexByToken[i];
                const isRightAnswer = wordIndex === current.correctIndex;
                const isPicked = selected === wordIndex;
                const color = answered && isRightAnswer ? '#22C55E' : answered && isPicked ? '#EF4444' : colors.tint;
                return (
                  <Text
                    key={`w${i}`}
                    testID="grammar-mark-word"
                    onPress={() => selectOption(wordIndex)}
                    style={{ color, fontWeight: answered && (isRightAnswer || isPicked) ? '700' : '400' }}
                  >
                    {tok.text}
                  </Text>
                );
              })}
            </Text>
          </View>
        </>
      ) : (
        <View style={[styles.sentenceCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sentence, { color: colors.text }]}>
            {before}
            <Text style={{ color: answered ? (isCorrect ? '#22C55E' : '#EF4444') : colors.tint, fontWeight: '700' }}>
              {answered ? pickedText : '____'}
            </Text>
            {after}
          </Text>
        </View>
      )}
      {choiceTr ? (
        <ChoiceTranslation text={choiceTr} show={showTr} onToggle={() => setShowTr((v) => !v)} g={g} colors={colors} label={s.grammar.showTranslation} />
      ) : null}

      <View style={marking ? styles.hiddenOptions : styles.options}>
        {(marking ? [] : current.options).map((opt, i) => {
          const isPicked = selected === i;
          const isRightAnswer = i === current.correctIndex;
          let bg = colors.card;
          let border = colors.tabIconDefault;
          if (answered && isRightAnswer) {
            bg = '#22C55E22';
            border = '#22C55E';
          } else if (answered && isPicked && !isRightAnswer) {
            bg = '#EF444422';
            border = '#EF4444';
          }
          return (
            <Pressable
              key={opt}
              testID="grammar-option"
              style={[styles.option, { backgroundColor: bg, borderColor: border }]}
              onPress={() => selectOption(i)}
              disabled={answered}
            >
              <Text style={[styles.optionText, { color: colors.text }]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>

      {answered ? (
        <View style={[styles.explainCard, { backgroundColor: colors.card }]}>
          <ResultBadge correct={isCorrect} label={isCorrect ? s.games.correctFeedback : s.games.wrongFeedback} />
          <Text style={[styles.explainText, { color: colors.text }]}>{current.item.why[contentLang] ?? current.item.why.en}</Text>
          {!isCorrect && pickedText !== undefined ? (
            <Text style={[styles.explainText, { color: colors.tabIconDefault }]}>
              {/* any word in the sentence can be tapped, so the mark
                  task has a generic fallback explanation. */}
              {wrongExplanation(current.item, pickedText, contentLang) ??
                (marking ? s.games.grammarChoice.markWrong : '')}
            </Text>
          ) : null}
          {current.item.examples.map((ex, i) => (
            <GlossText
              key={i}
              text={ex}
              glosses={buildGlossMap(ex, { learnedLang, nativeLang: contentLang, knownWordIds: knownIds, overrides })}
              learnedLang={learnedLang}
              style={[styles.example, { color: colors.text }]}
            />
          ))}
          <Pressable testID="grammar-next" style={[styles.btn, { backgroundColor: colors.tint, marginTop: 12 }]} onPress={next}>
            <Text style={styles.btnText}>{s.games.understood}</Text>
          </Pressable>
          {footer}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 12, paddingBottom: 60 },
  progress: { fontSize: 13, textAlign: 'center' },
  // neo-brutalist drill (uppercase titles, weight 500, corner 0).
  brutalHead: { gap: 4 },
  brutalHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brutalSegments: { flex: 1 },
  brutalProgress: { fontSize: 11, fontWeight: '500', textTransform: 'uppercase' },
  brutalSentenceBox: { padding: 20 },
  brutalOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  brutalOption: { flexBasis: '46%', flexGrow: 1 },
  brutalOptionInner: { paddingVertical: 16, paddingHorizontal: 8, flexDirection: 'row', justifyContent: 'center' },
  brutalOptionText: { fontSize: 17, fontWeight: '500', flexShrink: 1, textAlign: 'center' },
  brutalFeedback: { padding: 16, gap: 8 },
  // The last item also rolls out from under the chat button (FAB).
  brutalBodyPad: { paddingBottom: 130 },
  brutalClose: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  brutalCloseText: { fontSize: 16, fontWeight: '500' },
  brutalDim: { opacity: 0.55 },
  brutalHint: { fontSize: 11, fontWeight: '500', textTransform: 'uppercase', textAlign: 'center' },
  brutalUnderline: { textDecorationLine: 'underline' },
  brutalMatchInner: { paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', flexWrap: 'wrap' },
  brutalInputBox: { padding: 0 },
  brutalInput: { paddingVertical: 12, paddingHorizontal: 14, fontSize: 17, fontWeight: '500' },
  brutalAnswer: { fontSize: 20, fontWeight: '500', alignSelf: 'flex-start' },
  brutalQuestion: { fontSize: 15, fontWeight: '500', textTransform: 'uppercase', textAlign: 'center' },
  brutalWhyOptions: { gap: 12 },
  // lowercase example line under the rule option (wraps onto a new line in the wrap row).
  optionHint: { fontSize: 12, textAlign: 'center', flexBasis: '100%', marginTop: 2 },
  brutalWhyOption: { paddingVertical: 14, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
  brutalF: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  brutalNext: { paddingVertical: 14, alignItems: 'center' },
  brutalNextText: { fontSize: 16, fontWeight: '500', textTransform: 'uppercase' },
  sentenceCard: { borderRadius: 16, padding: 20 },
  // flexShrink so it wraps inside the row container (sentence + 🔊) too and does not push out its sibling.
  sentence: { fontSize: 20, lineHeight: 30, textAlign: 'center', flexShrink: 1 },
  options: { gap: 10 },
  hiddenOptions: { height: 0 },
  markPrompt: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  option: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  optionText: { fontSize: 17, fontWeight: '600' },
  explainCard: { borderRadius: 16, padding: 16, gap: 8 },
  formSpeak: { alignSelf: 'center', padding: 4 },
  formSpeakIcon: { fontSize: 22 },
  formSpeakBrutal: { alignSelf: 'center' },
  explainText: { fontSize: 14, lineHeight: 20 },
  example: { fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  moreToggle: { fontSize: 13, fontWeight: '700' },
  btn: { paddingVertical: 14, borderRadius: 24, alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  hint: { fontSize: 13, textAlign: 'center' },
  matchBody: { gap: 12 },
  matchColumns: { flexDirection: 'row', gap: 12 },
  matchColumn: { flex: 1, gap: 8 },
  matchCell: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center' },
  matchCellText: { fontSize: 14, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  formBody: { gap: 10 },
  formPrompt: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  formInput: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, fontSize: 17, textAlign: 'center' },
  whyBody: { gap: 12 },
  whySentenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  whyTranslation: { fontSize: 14, textAlign: 'center', marginTop: 6 },
  // highlighting the `target` in the sentence + the question line that names it.
  whyTargetBold: { fontWeight: '800' },
  whyQuestion: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  // the "why" translation starts hidden, can be brought up with a button.
  whyTrButton: { alignSelf: 'center', marginTop: 6, paddingVertical: 4, paddingHorizontal: 10 },
  whyTrButtonText: { fontSize: 13, fontWeight: '700' },
  speak: { fontSize: 18 },
  // tense badge + sentence transformation drill.
  tenseBadge: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  tenseBadgeText: { fontSize: 13, fontWeight: '700' },
  transformBody: { gap: 12 },
  transformCard: { borderRadius: 16, padding: 18, gap: 10 },
  transformCardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  transformSentence: { flex: 1, fontSize: 22, fontWeight: '600', lineHeight: 28 },
  fButton: { width: 44, height: 44, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  fButtonText: { fontSize: 20, fontWeight: '700' },
  transformTranslation: { fontSize: 15, fontStyle: 'italic' },
  choiceTrRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  choiceTrText: { flex: 1 },
  transformLabel: { fontSize: 14, fontWeight: '700' },
  transformInput: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 17 },
  transformResultBox: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8 },
  transformAnswer: { fontSize: 20, fontWeight: '700' },
  accentHint: { fontSize: 12, textAlign: 'center' },
});
