import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { normalizeWordToken } from '@/data/words';
import {
  cumulativeCorpusWordIds,
  isFormItem,
  isLessonV2,
  isMarkItem,
  isMatchItem,
  isWhyItem,
  type GrammarKind,
  type GrammarMarkItem,
  type GrammarTopicData,
} from '@/lib/games/content';
import type { FormItem, LessonBlock, MatchItem, WhyItem } from '@/lib/grammar/lessonTypes';
import { markTokens } from '@/lib/games/grammarMark';
import { speak } from '@/lib/speech';
import { speechLang } from '@/lib/languages';
import { buildGrammarRound, grammarRoundItemKind, isChoiceRoundItem, wrongExplanation } from '@/lib/games/grammarChoice';
import { buildGlossMap } from '@/lib/games/gloss';
import { hashString, shuffleArray } from '@/lib/shuffle';
import GlossText from '@/components/games/GlossText';
import LessonBody from '@/components/grammar/LessonBody';
import MoreBlocks from '@/components/grammar/MoreBlocks';

// The "which one is right, and why" drill, shared by the grammar course
// (app/grammar/[topic].tsx) and the Game tab's grammar-choice screen. It was
// only in the game before; the course needs exactly the same drill after its
// lesson, and a second copy would have drifted from this one within a month.
//
// GAMES.md 4.11: the explanation appears after EVERY answer, right or wrong,
// with the rule, why the picked wrong option is wrong, and two more examples.
//
// LECKE-SEMA 2.1-2.2/D3 (FB290, 2026-09-17): a lecke-drill a `kinds` propban
// felsorolt fajtákat viszi végig, a lecke-oldal fajtánként külön indítja; a
// Game fül grammar-choice-a a prop híján a régi gap/mark-only (`choice`) kört
// kapja (LECKE-SEMA 6.3 D pont).

interface Props {
  topic: GrammarTopicData;
  learnedLang: string;
  contentLang: string;
  /** Fired once, when the last item has been answered and dismissed. */
  onFinish: (correct: number, total: number) => void;
  /** Extra rows under the explanation (e.g. the course's "back to the rule"). */
  footer?: React.ReactNode;
  /** LECKE-SEMA D3: mely fajták kerüljenek a körbe; hiányában csak a választós (Game fül). */
  kinds?: readonly GrammarKind[];
}

const CHOICE_ONLY: readonly GrammarKind[] = ['choice'];

function findFormTable(topic: GrammarTopicData, tableId: string): Extract<LessonBlock, { kind: 'table' }> | undefined {
  if (!isLessonV2(topic)) return undefined;
  return topic.body.find((b): b is Extract<LessonBlock, { kind: 'table' }> => b.kind === 'table' && b.id === tableId);
}

// LECKE-SEMA 2.1: párosítás. A bal oszlop (angol) az authored sorrendben áll,
// a jobb oszlop (spanyol) egy seedelt keveréssel, hogy a teszt determinisztikus
// maradjon (item.id-ból számolt seed, nem Date.now()).
function MatchDrillItem({
  item,
  colors,
  s,
  onDone,
}: {
  item: MatchItem;
  colors: (typeof Colors)['light'];
  s: ReturnType<typeof t>;
  onDone: (correct: boolean) => void;
}) {
  const [rightOrder] = useState(() => shuffleArray(item.pairs.map((_, i) => i), hashString(item.id)));
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrongPair, setWrongPair] = useState<{ left: number; right: number } | null>(null);
  const [hadWrong, setHadWrong] = useState(false);

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
      setSelectedLeft(null);
    }
  };

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
                <Text style={[styles.matchCellText, { color: colors.text }]}>{p.en}</Text>
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
                <Text style={[styles.matchCellText, { color: colors.text }]}>{item.pairs[pairId].es}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {done ? (
        <View style={[styles.explainCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.explainHeader, { color: hadWrong ? '#EF4444' : '#22C55E' }]}>
            {hadWrong ? s.games.wrongFeedback : s.games.correctFeedback}
          </Text>
          <Pressable testID="grammar-next" style={[styles.btn, { backgroundColor: colors.tint, marginTop: 12 }]} onPress={() => onDone(!hadWrong)}>
            <Text style={styles.btnText}>{s.games.understood}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

// LECKE-SEMA 2.2: ragozási drill. A táblázat egy összecsukott segítség (a
// LessonBody UGYANAZON táblázat-blokkját rajzolja ki), nem a válasz.
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
  const [value, setValue] = useState('');
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);

  const check = () => {
    const ok = value.trim().toLowerCase() === item.answer.trim().toLowerCase();
    setCorrect(ok);
    setChecked(true);
  };

  return (
    <View style={styles.formBody}>
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
        {item.verb} · {item.person}
      </Text>
      <TextInput
        testID="formInput"
        style={[styles.formInput, { color: colors.text, borderColor: colors.tabIconDefault }]}
        value={value}
        onChangeText={setValue}
        editable={!checked}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {!checked ? (
        <Pressable testID="formCheck" style={[styles.btn, { backgroundColor: colors.tint }]} onPress={check}>
          <Text style={styles.btnText}>{s.grammar.check}</Text>
        </Pressable>
      ) : (
        <View style={[styles.explainCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.explainHeader, { color: correct ? '#22C55E' : '#EF4444' }]}>
            {correct ? s.games.correctFeedback : s.games.wrongFeedback}
          </Text>
          {!correct ? <Text style={[styles.explainText, { color: colors.text }]}>{item.answer}</Text> : null}
          <Pressable testID="grammar-next" style={[styles.btn, { backgroundColor: colors.tint, marginTop: 12 }]} onPress={() => onDone(correct)}>
            <Text style={styles.btnText}>{s.games.understood}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// TASK-8 (D4, FB288): "Miért ez a mondat?", a tanuló nem a hiányzó szót
// választja, hanem a szabályt, ami miatt a mondat úgy van, ahogy van. Egy
// próbálkozás, mint a választós tételnél (2.3): jó → zöld + „következő"; rossz
// → a választott piros, a jó zöld, alatta a választott opció `wrong` szövege.
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
  const answered = selected !== null;
  const isCorrect = answered && selected === item.correctIndex;

  const select = (i: number) => {
    if (answered) return;
    setSelected(i);
  };

  return (
    <View style={styles.whyBody}>
      <View style={[styles.sentenceCard, { backgroundColor: colors.card }]}>
        <View style={styles.whySentenceRow}>
          <Text style={[styles.sentence, { color: colors.text }]}>{item.es}</Text>
          <Pressable onPress={() => speak(item.es, speechLang(learnedLang))} hitSlop={10}>
            <Text style={styles.speak}>🔊</Text>
          </Pressable>
        </View>
        <Text style={[styles.whyTranslation, { color: colors.tabIconDefault }]}>
          {item.tr[contentLang] ?? item.tr.en}
        </Text>
      </View>

      <View style={styles.options}>
        {item.options.map((opt, i) => {
          const isPicked = selected === i;
          const isRightAnswer = i === item.correctIndex;
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
            </Pressable>
          );
        })}
      </View>

      {answered ? (
        <View style={[styles.explainCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.explainHeader, { color: isCorrect ? '#22C55E' : '#EF4444' }]}>
            {isCorrect ? s.games.correctFeedback : s.games.wrongFeedback}
          </Text>
          {!isCorrect ? (
            <Text style={[styles.explainText, { color: colors.text }]}>
              {item.options[selected].wrong?.[contentLang] ?? item.options[selected].wrong?.en ?? ''}
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

export default function GrammarDrill({ topic, learnedLang, contentLang, onFinish, footer, kinds = CHOICE_ONLY }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  const [seed] = useState(() => hashString(`${topic.topic}:${Date.now()}`));
  const fullRound = useMemo(() => buildGrammarRound(topic, seed), [topic, seed]);
  const round = useMemo(
    () => fullRound.filter((r) => kinds.includes(grammarRoundItemKind(r))),
    [fullRound, kinds]
  );
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showMore, setShowMore] = useState(false);

  const roundItem = round[index];
  if (!roundItem) return null;

  const advance = (finalCorrectCount: number) => {
    if (index + 1 < round.length) {
      setIndex((i) => i + 1);
      setSelected(null);
      setShowMore(false);
      return;
    }
    onFinish(finalCorrectCount, round.length);
  };

  // The gap/mark answer that got us here was scored on selection (below), so
  // correctCount is already final by the time this render exists.
  const next = () => advance(correctCount);

  // Match/form score at COMPLETION time, in the same event as the "next" tap,
  // so correctCount's state update has not landed yet; the final tally is
  // computed locally instead of trusted from the (possibly stale) closure.
  const completeItem = (wasCorrect: boolean) => {
    const finalCount = wasCorrect ? correctCount + 1 : correctCount;
    if (wasCorrect) setCorrectCount(finalCount);
    advance(finalCount);
  };

  if (!isChoiceRoundItem(roundItem)) {
    return (
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text testID="grammar-drill-progress" style={[styles.progress, { color: colors.tabIconDefault }]}>
          {s.games.grammarChoice.progress(index + 1, round.length)}
        </Text>
        {isMatchItem(roundItem.item) ? (
          <MatchDrillItem item={roundItem.item} colors={colors} s={s} onDone={completeItem} />
        ) : isFormItem(roundItem.item) ? (
          <FormDrillItem
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
            item={roundItem.item}
            learnedLang={learnedLang}
            contentLang={contentLang as 'hu' | 'en' | 'es' | 'de'}
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
  // FB219: a jelölős feladatnál a mondat egészben áll, nincs mit kettévágni. A
  // koppintható szavak sorszáma a `current.options`-be mutat (a round-építő a
  // mondat szavait teszi oda), a szóközök és írásjelek kimaradnak belőle.
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
    if (optIdx === current.correctIndex) setCorrectCount((c) => c + 1);
  };

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text testID="grammar-drill-progress" style={[styles.progress, { color: colors.tabIconDefault }]}>
        {s.games.grammarChoice.progress(index + 1, round.length)}
      </Text>

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
          <Text style={[styles.explainHeader, { color: isCorrect ? '#22C55E' : '#EF4444' }]}>
            {isCorrect ? s.games.correctFeedback : s.games.wrongFeedback}
          </Text>
          <Text style={[styles.explainText, { color: colors.text }]}>{current.item.why[contentLang] ?? current.item.why.en}</Text>
          {!isCorrect && pickedText !== undefined ? (
            <Text style={[styles.explainText, { color: colors.tabIconDefault }]}>
              {/* FB219: a mondatban bármelyik szóra koppinthat, tehát a jelölős
                  feladatnak általános tartalék-indoklása van. */}
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
          {'more' in topic && topic.more ? (
            <View style={[styles.moreSection, { borderTopColor: colors.tabIconDefault + '33' }]}>
              <Pressable onPress={() => setShowMore((v) => !v)} hitSlop={8}>
                <Text style={[styles.moreToggle, { color: colors.tint }]}>
                  {showMore ? `▾ ${s.games.moreLabel}` : `▸ ${s.games.moreLabel}`}
                </Text>
              </Pressable>
              {showMore ? (
                <View style={styles.moreBody}>
                  <MoreBlocks more={topic.more} contentLang={contentLang} color={colors.tabIconDefault} />
                </View>
              ) : null}
            </View>
          ) : null}
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
  sentenceCard: { borderRadius: 16, padding: 20 },
  sentence: { fontSize: 20, lineHeight: 30, textAlign: 'center' },
  options: { gap: 10 },
  hiddenOptions: { height: 0 },
  markPrompt: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  option: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  optionText: { fontSize: 17, fontWeight: '600' },
  explainCard: { borderRadius: 16, padding: 16, gap: 8 },
  explainHeader: { fontSize: 16, fontWeight: '800' },
  explainText: { fontSize: 14, lineHeight: 20 },
  example: { fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  moreSection: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 2 },
  moreToggle: { fontSize: 13, fontWeight: '700' },
  moreBody: { marginTop: 10 },
  btn: { paddingVertical: 14, borderRadius: 24, alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  hint: { fontSize: 13, textAlign: 'center' },
  matchBody: { gap: 12 },
  matchColumns: { flexDirection: 'row', gap: 12 },
  matchColumn: { flex: 1, gap: 8 },
  matchCell: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center' },
  matchCellText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  formBody: { gap: 10 },
  formPrompt: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  formInput: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, fontSize: 17, textAlign: 'center' },
  whyBody: { gap: 12 },
  whySentenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  whyTranslation: { fontSize: 14, textAlign: 'center', marginTop: 6 },
  speak: { fontSize: 18 },
});
