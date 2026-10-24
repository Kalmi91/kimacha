import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { t } from '@/lib/i18n';
import { type FormItem, type LessonBlock, type MatchItem } from '@/lib/grammar/lessonTypes';
import { speak } from '@/lib/speech';
import SpeakButton from '@/components/SpeakButton';
import { speechLang } from '@/lib/languages';
import { strictAnswerMatch } from '@/lib/answerMatch';
import { hashString, shuffleNoFixedPoints } from '@/lib/shuffle';
import { useDockedAction } from '@/components/learn/DockSlot';
import LessonBody from '@/components/grammar/LessonBody';
import { BrutalBox } from '@/components/grammar/Brutal';
import AnswerCompare from '@/components/grammar/AnswerCompare';
import ResultBadge from '@/components/ResultBadge';
import { useGrammarColors } from '@/lib/grammarColors';
import { BrutalFeedback, BrutalInkButton, TenseBadge } from '@/components/grammar/drill/shared';
import { styles } from '@/components/grammar/GrammarDrill.styles';

// matching. The left column (English) stays in authored order,
// the right column (Spanish) uses a seeded shuffle so the test stays deterministic
// (seed computed from item.id, not Date.now()).
export function MatchDrillItem({
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
            const bg = isMatched ? colors.successFill + '22' : isWrong ? '#EF444422' : isSelected ? colors.tint + '22' : colors.card;
            const border = isMatched ? colors.successFill : isWrong ? '#EF4444' : isSelected ? colors.tint : colors.tabIconDefault;
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
            const bg = isMatched ? colors.successFill + '22' : isWrong ? '#EF444422' : colors.card;
            const border = isMatched ? colors.successFill : isWrong ? '#EF4444' : colors.tabIconDefault;
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
export function FormDrillItem({
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
  contentLang: 'en' | 'es';
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
    const targets = [item.answer, ...(item.accept ?? [])];
    // Hungarian: the word cards' rule (accents are phonemic, öt/őt, never forgiven; case and punctuation are).
    const ok =
      learnedLang === 'hu'
        ? targets.some((c) => strictAnswerMatch(value, c, { lang: 'hu' }))
        : targets.some((c) => value.trim().toLowerCase() === c.trim().toLowerCase());
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
