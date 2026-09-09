import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { normalizeWordToken } from '@/data/words';
import { cumulativeCorpusWordIds, type GrammarTopicData } from '@/lib/games/content';
import { buildGrammarRound, wrongExplanation } from '@/lib/games/grammarChoice';
import { buildGlossMap } from '@/lib/games/gloss';
import { hashString } from '@/lib/shuffle';
import GlossText from '@/components/games/GlossText';
import MoreBlocks from '@/components/grammar/MoreBlocks';

// The "which one is right, and why" drill, shared by the grammar course
// (app/grammar/[topic].tsx) and the Game tab's grammar-choice screen. It was
// only in the game before; the course needs exactly the same drill after its
// lesson, and a second copy would have drifted from this one within a month.
//
// GAMES.md 4.11: the explanation appears after EVERY answer, right or wrong,
// with the rule, why the picked wrong option is wrong, and two more examples.

interface Props {
  topic: GrammarTopicData;
  learnedLang: string;
  contentLang: string;
  /** Fired once, when the last item has been answered and dismissed. */
  onFinish: (correct: number, total: number) => void;
  /** Extra rows under the explanation (e.g. the course's "back to the rule"). */
  footer?: React.ReactNode;
}

export default function GrammarDrill({ topic, learnedLang, contentLang, onFinish, footer }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  const [seed] = useState(() => hashString(`${topic.topic}:${Date.now()}`));
  const round = useMemo(() => buildGrammarRound(topic, seed), [topic, seed]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showMore, setShowMore] = useState(false);

  const current = round[index];
  if (!current) return null;

  const answered = selected !== null;
  const isCorrect = answered && selected === current.correctIndex;
  const pickedText = answered ? current.options[selected] : undefined;
  const [before, after] = current.item.sentence.split('___');

  const knownIds = cumulativeCorpusWordIds(topic.level, learnedLang);
  const overrides = Object.fromEntries((topic.glossary ?? []).map((g) => [normalizeWordToken(g.word), g.gloss]));

  const selectOption = (optIdx: number) => {
    if (answered) return;
    setSelected(optIdx);
    if (optIdx === current.correctIndex) setCorrectCount((c) => c + 1);
  };

  const next = () => {
    if (index + 1 < round.length) {
      setIndex((i) => i + 1);
      setSelected(null);
      setShowMore(false);
      return;
    }
    // The answer that got us here was scored on selection, so correctCount is
    // already final by the time this render exists.
    onFinish(correctCount, round.length);
  };

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text testID="grammar-drill-progress" style={[styles.progress, { color: colors.tabIconDefault }]}>
        {s.games.grammarChoice.progress(index + 1, round.length)}
      </Text>

      <View style={[styles.sentenceCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.sentence, { color: colors.text }]}>
          {before}
          <Text style={{ color: answered ? (isCorrect ? '#22C55E' : '#EF4444') : colors.tint, fontWeight: '700' }}>
            {answered ? pickedText : '____'}
          </Text>
          {after}
        </Text>
      </View>

      <View style={styles.options}>
        {current.options.map((opt, i) => {
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
              {wrongExplanation(current.item, pickedText, contentLang) ?? ''}
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
          {topic.more ? (
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
});
