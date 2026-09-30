import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { normalizeWordToken } from '@/data/words';
import { getDb } from '@/lib/database';
import { strictAnswerMatch } from '@/lib/answerMatch';
import { answerInputProps } from '@/lib/inputProps';
import {
  cumulativeCorpusWordIds,
  isFormItem,
  isLessonV2,
  isMarkItem,
  isMatchItem,
  isTransformItem,
  isWhyItem,
  type GrammarKind,
  type GrammarMarkItem,
  type GrammarTopicData,
} from '@/lib/games/content';
import { TENSE_NAMES, type FormItem, type LessonBlock, type MatchItem, type TenseId, type TransformItem, type WhyItem } from '@/lib/grammar/lessonTypes';
import { markTokens } from '@/lib/games/grammarMark';
import { speak } from '@/lib/speech';
import { speechLang } from '@/lib/languages';
import { buildGrammarRound, grammarRoundItemKind, isChoiceRoundItem, wrongExplanation } from '@/lib/games/grammarChoice';
import { pickTransformRound, TRANSFORM_ROUND_SIZE } from '@/lib/grammar/transformRounds';
import { findWholeWord } from '@/lib/grammar/whyTarget';
import { buildGlossMap } from '@/lib/games/gloss';
import { hashString, shuffleArray } from '@/lib/shuffle';
import GlossText from '@/components/games/GlossText';
import LessonBody from '@/components/grammar/LessonBody';
import MoreBlocks from '@/components/grammar/MoreBlocks';
import { BrutalBox, SegmentBar, Sticker, inkButtonText, segmentsFilled, textOnFill } from '@/components/grammar/Brutal';
import { useGrammarColors, type GrammarColors } from '@/lib/grammarColors';

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
  onFinish: (correct: number, total: number, roundItemIds?: string[]) => void;
  /** Extra rows under the explanation (e.g. the course's "back to the rule"). */
  footer?: React.ReactNode;
  /** LECKE-SEMA D3: mely fajták kerüljenek a körbe; hiányában csak a választós (Game fül). */
  kinds?: readonly GrammarKind[];
  /** FB316 (NY10): a "transform" kör legkevésbé-gyakorolt-elöl sorrendjéhez. */
  transformSeen?: Record<string, number>;
  /** FB340-342/345/356: a feedback-kontextushoz, az éppen látható item id-ja. */
  onItemChange?: (itemId: string) => void;
  /** NY24: a kör statisztikája a kör végén (onFinish ELŐTT): legjobb combo, idő, az első rontott mondat. */
  onRoundStats?: (stats: RoundStats) => void;
  /** NY22: a brutalista fejléc bezáró X-e (a lecke-oldal ← gombjával azonos: vissza a leckéhez). */
  onClose?: () => void;
}

// NY24: a kör-vége képernyő adatai; csak memóriában, nincs DB-írás.
export interface RoundStats {
  bestCombo: number;
  seconds: number;
  /** Az első rontott mondat a helyes alakkal (csak gap/mark és transform tételnél). */
  miss: { sentence: string; highlight: string } | null;
}

const CHOICE_ONLY: readonly GrammarKind[] = ['choice'];

// NY24: a kör hossza másodpercben (külön függvény, hogy ne render-időben hívjuk a Date.now-t).
const secondsSince = (startedAt: number) => Math.max(0, Math.round((Date.now() - startedAt) / 1000));

// NY22: a nem-választós fajták közös brutalista elemei: b kitöltésű visszajelző
// doboz (nagybetűs cím + egy mondat) és az ink kitöltésű gomb.
function BrutalFeedback({ g, title, children }: { g: GrammarColors; title: string; children?: React.ReactNode }) {
  return (
    <BrutalBox fill="b" boxStyle={styles.brutalFeedback}>
      <Text style={[styles.brutalFeedbackHead, { color: g.onFill }]}>{title}</Text>
      {children}
    </BrutalBox>
  );
}

function BrutalInkButton({ g, testID, label, onPress }: { g: GrammarColors; testID: string; label: string; onPress: () => void }) {
  return (
    <BrutalBox testID={testID} fill="ink" boxStyle={styles.brutalNext} onPress={onPress}>
      <Text style={[styles.brutalNextText, { color: inkButtonText(g) }]}>{label}</Text>
    </BrutalBox>
  );
}

function findFormTable(topic: GrammarTopicData, tableId: string): Extract<LessonBlock, { kind: 'table' }> | undefined {
  if (!isLessonV2(topic)) return undefined;
  return topic.body.find((b): b is Extract<LessonBlock, { kind: 'table' }> => b.kind === 'table' && b.id === tableId);
}

// LECKE-SEMA 2.1: párosítás. A bal oszlop (angol) az authored sorrendben áll,
// a jobb oszlop (spanyol) egy seedelt keveréssel, hogy a teszt determinisztikus
// maradjon (item.id-ból számolt seed, nem Date.now()).
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
  onDone: (correct: boolean) => void;
}) {
  const [rightOrder] = useState(() => shuffleArray(item.pairs.map((_, i) => i), hashString(item.id)));
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrongPair, setWrongPair] = useState<{ left: number; right: number } | null>(null);
  const [hadWrong, setHadWrong] = useState(false);
  const g = useGrammarColors();
  // `pairs` {es, en} szó szerint spanyol/angol; a jobb oszlop a TANULT nyelv
  // (es→en irányban az angol), a bal a másik.
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
      setSelectedLeft(null);
    }
  };

  // NY22: brutalista párosítás: cella = doboz, a párosított = a kitöltés + pipa,
  // a kijelölt = b kitöltés, a hibás = szaggatott keret halványan.
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
        <Text style={[styles.matchCellText, { color: state === 'matched' || state === 'selected' ? g.onFill : g.ink }]}>{text}</Text>
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
            <BrutalFeedback g={g} title={hadWrong ? s.games.wrongFeedback : s.games.correctFeedback} />
            <BrutalInkButton g={g} testID="grammar-next" label={s.grammar.nextArrow} onPress={() => onDone(!hadWrong)} />
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
  const g = useGrammarColors();

  const check = () => {
    const ok = value.trim().toLowerCase() === item.answer.trim().toLowerCase();
    setCorrect(ok);
    setChecked(true);
  };

  // NY22: brutalista ragozás-drill: a prompt dobozban, a beviteli mező 2,5 px ink
  // keretű, sarok 0; hibás válasz után szaggatott keret; b kitöltésű visszajelző.
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
            {item.verb} · {item.person}
          </Text>
        </BrutalBox>
        <BrutalBox dashed={checked && !correct} style={checked && !correct ? styles.brutalDim : undefined} boxStyle={styles.brutalInputBox}>
          <TextInput
            testID="formInput"
            style={[styles.brutalInput, { color: g.ink }]}
            value={value}
            onChangeText={setValue}
            editable={!checked}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </BrutalBox>
        {!checked ? (
          <BrutalInkButton g={g} testID="formCheck" label={s.grammar.check} onPress={check} />
        ) : (
          <>
            <BrutalFeedback g={g} title={correct ? s.games.correctFeedback : s.games.wrongFeedback}>
              {!correct ? (
                <Text style={[styles.brutalAnswer, { backgroundColor: g.a, color: g.onFill }]}> {item.answer} </Text>
              ) : null}
            </BrutalFeedback>
            <BrutalInkButton g={g} testID="grammar-next" label={s.grammar.nextArrow} onPress={() => onDone(correct)} />
          </>
        )}
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
  const [showTr, setShowTr] = useState(false);
  const answered = selected !== null;
  const isCorrect = answered && selected === item.correctIndex;
  const g = useGrammarColors();

  const select = (i: number) => {
    if (answered) return;
    setSelected(i);
  };

  // FB376: ha van `target`, a mondatban kiemelve jelenik meg, és a kérdés-sor
  // megnevezi, mire vonatkozik a kérdés (a felhasználó nem tudta kitalálni,
  // melyik szóról van szó).
  const targetSpan = item.target ? findWholeWord(item.es, item.target) : null;

  // NY22: brutalista "miért" drill: mondat dobozban (a target b kitöltéssel),
  // válaszok dobozként (helyes = a kitöltés + pipa, hibás = szaggatott, halvány).
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
                  <Text style={{ backgroundColor: g.b, color: g.onFill, fontWeight: '500' }}>
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
          {item.options.map((opt, i) => {
            const isPicked = selected === i;
            const isRightAnswer = i === item.correctIndex;
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
              </BrutalBox>
            );
          })}
        </View>

        {answered ? (
          <>
            <BrutalFeedback g={g} title={isCorrect ? s.games.correctFeedback : s.games.wrongFeedback}>
              {!isCorrect ? (
                <Text style={[styles.explainText, { color: g.onFill }]}>
                  {item.options[selected].wrong?.[contentLang] ?? item.options[selected].wrong?.en ?? ''}
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

// NY3 (NYELVTAN.md "Első szelet"): igeidő-jelvény, minden fajtán megjelenik,
// ahol az itemnek van `tense` mezője (choice/form/why/transform).
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

// NY3 (NYELVTAN.md "Első szelet"): mondat-átírás egyik igeidőből a másikba.
// A `key={item.id}` a hívó oldalon van (FB299 mintája, mint a többi ágnál),
// hogy a beviteli mező üresen induljon a következő itemen.
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
  };

  const inputBorder = result === 'ok' ? '#22C55E' : result === 'bad' ? '#EF4444' : colors.tabIconDefault;

  // NY22: brutalista mondat-átírás: a mondat dobozban, az F gomb kis doboz, a
  // beviteli mező 2,5 px ink keretű (hibás után szaggatott), b kitöltésű visszajelző.
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
              <Text style={[styles.fButtonText, { color: showF ? g.onFill : g.ink }]}>F</Text>
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
          />
        </BrutalBox>

        {result === null ? (
          <BrutalInkButton g={g} testID="transform-check" label={s.grammar.check} onPress={check} />
        ) : (
          <>
            <BrutalFeedback g={g} title={result === 'ok' ? s.grammar.correct : s.grammar.correctAnswer}>
              {result === 'bad' ? (
                <Text style={[styles.brutalAnswer, { backgroundColor: g.a, color: g.onFill }]}> {item.answer} </Text>
              ) : null}
              <Text style={[styles.explainText, { color: g.onFill }]}>{item.why[contentLang] ?? item.why.en}</Text>
            </BrutalFeedback>
            <BrutalInkButton g={g} testID="transform-next" label={s.grammar.next} onPress={() => onDone(result === 'ok')} />
          </>
        )}

        {!strictAccents ? <Text style={[styles.accentHint, { color: g.mu }]}>{s.grammar.accentHint}</Text> : null}
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
      />

      {result === null ? (
        <Pressable testID="transform-check" style={[styles.btn, { backgroundColor: colors.tint }]} onPress={check}>
          <Text style={styles.btnText}>{s.grammar.check}</Text>
        </Pressable>
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
              <Text style={[styles.explainHeader, { color: '#22C55E' }]}>{s.grammar.correct}</Text>
              <Text style={[styles.explainText, { color: colors.text }]}>{item.why[contentLang] ?? item.why.en}</Text>
            </>
          ) : (
            <>
              <Text style={[styles.explainHeader, { color: '#EF4444' }]}>{s.grammar.correctAnswer}</Text>
              <Text style={[styles.transformAnswer, { color: colors.text }]}>{item.answer}</Text>
              <Text style={[styles.explainText, { color: colors.text }]}>{item.why[contentLang] ?? item.why.en}</Text>
            </>
          )}
        </View>
      )}

      {result !== null ? (
        <Pressable testID="transform-next" style={[styles.btn, { backgroundColor: colors.text }]} onPress={() => onDone(result === 'ok')}>
          <Text style={styles.btnText}>{s.grammar.next}</Text>
        </Pressable>
      ) : null}

      {!strictAccents ? (
        <Text style={[styles.accentHint, { color: colors.tabIconDefault }]}>{s.grammar.accentHint}</Text>
      ) : null}
    </View>
  );
}

export default function GrammarDrill({ topic, learnedLang, contentLang, onFinish, footer, kinds = CHOICE_ONLY, transformSeen, onItemChange, onRoundStats, onClose }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();

  const [seed] = useState(() => hashString(`${topic.topic}:${Date.now()}`));
  const fullRound = useMemo(() => buildGrammarRound(topic, seed), [topic, seed]);
  const transformPool = useMemo(() => fullRound.map((r) => r.item).filter(isTransformItem), [fullRound]);
  // FB316 (NY10): a körös (legkevésbé-gyakorolt-elöl, legfeljebb 10 itemes)
  // adagolás csak akkor él, ha egy tiszta "csak mondat-átírás" indításnál
  // TÉNYLEG több item van, mint egy kör; kisebb leckén (ahol az egy kör úgyis
  // minden itemet lefed) a régi, szerzői sorrendű, seed nélküli viselkedés
  // marad, hogy ne boruljon fel ok nélkül a többi fajta és a kis leckék
  // determinisztikus sorrendje.
  const useTransformRounds = kinds.length === 1 && kinds[0] === 'transform' && transformPool.length > TRANSFORM_ROUND_SIZE;
  const round = useMemo(() => {
    if (useTransformRounds) {
      return pickTransformRound(transformPool, transformSeen ?? {}, TRANSFORM_ROUND_SIZE, seed).map((item) => ({ item }));
    }
    return fullRound.filter((r) => kinds.includes(grammarRoundItemKind(r)));
  }, [useTransformRounds, transformPool, transformSeen, seed, fullRound, kinds]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showMore, setShowMore] = useState(false);
  // NY22: egymás utáni helyes válaszok a körön belül, csak memóriában (nincs
  // DB-írás); hibánál nullázódik, "x2"-től látszik a combo-matrica.
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
  // NY3: a Beállítások ékezet-szigor kapcsolója, egyszer lekérve, csak ha a
  // körben van transform tétel (a többi ágnak nincs rá szüksége).
  const [strictAccents, setStrictAccents] = useState(false);
  const hasTransform = kinds.includes('transform');
  useEffect(() => {
    if (!hasTransform) return;
    getDb().getStrictAccents().then(setStrictAccents).catch(() => {});
  }, [hasTransform]);

  // FB340-342/345/356: a szülő ebből tudja a feedback-kontextusba tenni,
  // melyik itemre panaszkodott a tanuló.
  useEffect(() => {
    const id = round[index]?.item.id;
    if (id) onItemChange?.(id);
  }, [round, index, onItemChange]);

  const roundItem = round[index];
  if (!roundItem) return null;

  const advance = (finalCorrectCount: number) => {
    if (index + 1 < round.length) {
      setIndex((i) => i + 1);
      setSelected(null);
      setShowMore(false);
      return;
    }
    // FB316 (NY10): a kör item-id-jei csak a körös adagolásnál kellenek (a
    // szülő ebből számolja a `seen` térképet); a többi ág a korábbi
    // 2-argumentumos hívást kapja, hogy a meglévő onFinish-tesztek
    // (toHaveBeenCalledWith(correct, total)) ne törjenek.
    onRoundStats?.({
      bestCombo: bestComboRef.current,
      seconds: secondsSince(startedAt),
      miss: missRef.current,
    });
    if (useTransformRounds) {
      onFinish(finalCorrectCount, round.length, round.map((r) => r.item.id));
    } else {
      onFinish(finalCorrectCount, round.length);
    }
  };

  // The gap/mark answer that got us here was scored on selection (below), so
  // correctCount is already final by the time this render exists.
  const next = () => advance(correctCount);

  // Match/form score at COMPLETION time, in the same event as the "next" tap,
  // so correctCount's state update has not landed yet; the final tally is
  // computed locally instead of trusted from the (possibly stale) closure.
  const completeItem = (wasCorrect: boolean) => {
    noteResult(
      wasCorrect,
      isTransformItem(roundItem.item)
        ? { sentence: roundItem.item.answer, highlight: roundItem.item.answer }
        : undefined
    );
    const finalCount = wasCorrect ? correctCount + 1 : correctCount;
    if (wasCorrect) setCorrectCount(finalCount);
    advance(finalCount);
  };

  // NY22: neo-brutalista fejléc: szegmentált progress + combo-matrica (b).
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

  // NY3: a jelvény csak a gap-ágon (choice) jelenik meg, a jelölős tételnek
  // nincs `tense` mezője (lessonTypes.ts).
  const badgeTense = !marking && !isMarkItem(current.item) ? current.item.tense : undefined;

  // NY22 (neo-brutalista, NYELVTAN.md "Neo-brutalista stílus" 2. képernyő): a
  // mondat dobozban, a hiány b kitöltésű blokk, a válaszok 2x2 rácsban, a
  // helyes = a kitöltés + pipa, a visszajelző doboz b kitöltésű.
  if (g.brutal) {
    const blankFill = answered ? (isCorrect ? g.a : g.ink) : g.b;
    const blankColor = answered && !isCorrect ? g.bg : g.onFill;
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
          <BrutalBox fill="b" boxStyle={styles.brutalFeedback}>
            <Text style={[styles.brutalFeedbackHead, { color: g.onFill }]}>
              {isCorrect ? s.grammar.perfect : s.games.wrongFeedback}
            </Text>
            <Text style={[styles.explainText, { color: g.onFill }]}>{current.item.why[contentLang] ?? current.item.why.en}</Text>
            {!isCorrect && pickedText !== undefined ? (
              <Text style={[styles.explainText, { color: g.onFill }]}>
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
                style={[styles.example, { color: g.onFill }]}
              />
            ))}
            {'more' in topic && topic.more ? (
              <View style={[styles.moreSection, { borderTopColor: g.onFill }]}>
                <Pressable onPress={() => setShowMore((v) => !v)} hitSlop={8}>
                  <Text style={[styles.moreToggle, { color: g.onFill }]}>
                    {showMore ? `▾ ${s.games.moreLabel}` : `▸ ${s.games.moreLabel}`}
                  </Text>
                </Pressable>
                {showMore ? (
                  <View style={styles.moreBody}>
                    <MoreBlocks more={topic.more} contentLang={contentLang} color={g.onFill} />
                  </View>
                ) : null}
              </View>
            ) : null}
          </BrutalBox>
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
  // NY22: neo-brutalista drill (nagybetűs címek, 500 súly, sarok 0).
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
  brutalFeedbackHead: { fontSize: 18, fontWeight: '500', textTransform: 'uppercase' },
  // A chat-gomb (FAB) alól is kigördül az utolsó elem.
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
  brutalWhyOption: { paddingVertical: 14, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
  brutalF: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  brutalNext: { paddingVertical: 14, alignItems: 'center' },
  brutalNextText: { fontSize: 16, fontWeight: '500', textTransform: 'uppercase' },
  sentenceCard: { borderRadius: 16, padding: 20 },
  // FB405: flexShrink, hogy a sor-konténerben (mondat + 🔊) is törjön, ne tolja ki a testvért.
  sentence: { fontSize: 20, lineHeight: 30, textAlign: 'center', flexShrink: 1 },
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
  matchCellText: { fontSize: 14, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  formBody: { gap: 10 },
  formPrompt: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  formInput: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, fontSize: 17, textAlign: 'center' },
  whyBody: { gap: 12 },
  whySentenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  whyTranslation: { fontSize: 14, textAlign: 'center', marginTop: 6 },
  // FB376: a `target` kiemelése a mondatban + a kérdés-sor, ami megnevezi.
  whyTargetBold: { fontWeight: '800' },
  whyQuestion: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  // FB379: a "why" fordítás rejtve indul, gombbal előhozható.
  whyTrButton: { alignSelf: 'center', marginTop: 6, paddingVertical: 4, paddingHorizontal: 10 },
  whyTrButtonText: { fontSize: 13, fontWeight: '700' },
  speak: { fontSize: 18 },
  // NY3 (NYELVTAN.md "Első szelet"): igeidő-jelvény + mondat-átírás drill.
  tenseBadge: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  tenseBadgeText: { fontSize: 13, fontWeight: '700' },
  transformBody: { gap: 12 },
  transformCard: { borderRadius: 16, padding: 18, gap: 10 },
  transformCardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  transformSentence: { flex: 1, fontSize: 22, fontWeight: '600', lineHeight: 28 },
  fButton: { width: 44, height: 44, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  fButtonText: { fontSize: 20, fontWeight: '700' },
  transformTranslation: { fontSize: 15, fontStyle: 'italic' },
  transformLabel: { fontSize: 14, fontWeight: '700' },
  transformInput: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 17 },
  transformResultBox: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8 },
  transformAnswer: { fontSize: 20, fontWeight: '700' },
  accentHint: { fontSize: 12, textAlign: 'center' },
});
