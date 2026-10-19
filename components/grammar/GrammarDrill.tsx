import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/KText';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { normalizeWordToken } from '@/data/words';
import { getDb } from '@/lib/database';
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
import { type LessonBlock } from '@/lib/grammar/lessonTypes';
import { markTokens } from '@/lib/games/grammarMark';
import { speak } from '@/lib/speech';
import { speechLang } from '@/lib/languages';
import { buildGrammarRound, grammarRoundItemKind, isChoiceRoundItem, wrongExplanation } from '@/lib/games/grammarChoice';
import { pickTransformRound, TRANSFORM_ROUND_SIZE } from '@/lib/grammar/transformRounds';
import { buildGlossMap } from '@/lib/games/gloss';
import { hashString } from '@/lib/shuffle';
import GlossText from '@/components/games/GlossText';
import { BrutalBox, SegmentBar, Sticker, inkButtonText, segmentsFilled, textOnFill } from '@/components/grammar/Brutal';
import ResultBadge from '@/components/ResultBadge';
import { DictationDrillItem, OrderDrillItem, SpotDrillItem } from '@/components/grammar/NewKinds';
import { useGrammarColors, type GrammarColors } from '@/lib/grammarColors';
import { MatchDrillItem, FormDrillItem } from '@/components/grammar/drill/MatchFormItems';
import { WhyDrillItem, TransformDrillItem } from '@/components/grammar/drill/WhyTransformItems';
import { TenseBadge } from '@/components/grammar/drill/shared';
import { styles } from '@/components/grammar/GrammarDrill.styles';

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
    getDb().getStrictAccents().then(setStrictAccents).catch(() => {
      // a failed read leaves the accent setting at its default (off)
    });
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
          <BrutalBox testID="grammar-back" accessibilityLabel={s.a11y.close} offset={2} boxStyle={styles.brutalClose} onPress={onClose}>
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
            contentLang={contentLang as 'en' | 'es'}
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
            contentLang={contentLang as 'en' | 'es'}
            colors={colors}
            s={s}
            onDone={completeItem}
          />
        ) : isSpotItem(roundItem.item) ? (
          <SpotDrillItem
            key={roundItem.item.id}
            item={roundItem.item}
            learnedLang={learnedLang}
            contentLang={contentLang as 'en' | 'es'}
            onDone={completeItem}
          />
        ) : isOrderItem(roundItem.item) ? (
          <OrderDrillItem
            key={roundItem.item.id}
            item={roundItem.item}
            learnedLang={learnedLang}
            contentLang={contentLang as 'en' | 'es'}
            onDone={completeItem}
          />
        ) : isDictationItem(roundItem.item) ? (
          <DictationDrillItem
            key={roundItem.item.id}
            item={roundItem.item}
            learnedLang={learnedLang}
            contentLang={contentLang as 'en' | 'es'}
            strictAccents={strictAccents}
            onDone={completeItem}
          />
        ) : isTransformItem(roundItem.item) ? (
          <TransformDrillItem
            key={roundItem.item.id}
            item={roundItem.item}
            contentLang={contentLang as 'en' | 'es'}
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
  const choiceTr = current.item.tr ? (current.item.tr[contentLang as 'en' | 'es'] ?? current.item.tr.en) : undefined;

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
                const color = answered && isRightAnswer ? colors.successFill : answered && isPicked ? '#EF4444' : colors.tint;
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
            <Text style={{ color: answered ? (isCorrect ? colors.successFill : '#EF4444') : colors.tint, fontWeight: '700' }}>
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
            bg = colors.successFill + '22';
            border = colors.successFill;
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
