import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { t } from '@/lib/i18n';
import { strictAnswerMatch } from '@/lib/answerMatch';
import { answerInputProps } from '@/lib/inputProps';
import { TENSE_NAMES, type TransformItem, type WhyItem } from '@/lib/grammar/lessonTypes';
import { speak } from '@/lib/speech';
import { speechLang } from '@/lib/languages';
import { findWholeWord } from '@/lib/grammar/whyTarget';
import { optionHint } from '@/lib/grammar/optionHints';
import { hashString, shuffleOptions } from '@/lib/shuffle';
import { useDockedAction } from '@/components/learn/DockSlot';
import { BrutalBox } from '@/components/grammar/Brutal';
import ResultBadge from '@/components/ResultBadge';
import { useGrammarColors } from '@/lib/grammarColors';
import { BrutalFeedback, BrutalInkButton, TenseBadge } from '@/components/grammar/drill/shared';
import { styles } from '@/components/grammar/GrammarDrill.styles';

// "Why this sentence?": the learner does not choose the missing word
// but the rule that makes the sentence the way it is. One
// attempt, as for the choice item (2.3): right → green + "next"; wrong
// → the chosen one red, the right one green, below it the chosen option's `wrong` text.
export function WhyDrillItem({
  item,
  learnedLang,
  contentLang,
  colors,
  s,
  onDone,
}: {
  item: WhyItem;
  learnedLang: string;
  contentLang: 'en' | 'es';
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
            <Pressable accessibilityRole="button" accessibilityLabel={t().a11y.speak} onPress={() => speak(item.es, speechLang(learnedLang))} hitSlop={10}>
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
          <Pressable accessibilityRole="button" accessibilityLabel={t().a11y.speak} onPress={() => speak(item.es, speechLang(learnedLang))} hitSlop={10}>
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
            bg = colors.successFill + '22';
            border = colors.successFill;
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

// sentence transformation from one tense to another.
// The `key={item.id}` is on the caller's side (as with the other branches),
// so the input field starts empty on the next item.
export function TransformDrillItem({
  item,
  contentLang,
  strictAccents,
  colors,
  s,
  onDone,
}: {
  item: TransformItem;
  contentLang: 'en' | 'es';
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

  const inputBorder = result === 'ok' ? colors.successFill : result === 'bad' ? '#EF4444' : colors.tabIconDefault;

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
              ? { backgroundColor: colors.successFill + '22', borderColor: colors.successFill }
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
