import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '@/components/KText';
import { useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { dismissKeyboardOnTap, keyboardDismissOnDrag } from '@/lib/keyboardTap';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { brutalHeaderRowStyle } from '@/lib/brutalHeader';
import { themedInputStyle, themedEdgeStyle, BackButton, ProgressBar, ActionButton, Badge } from '@/components/grammar/Themed';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { useLearner } from '@/lib/learner';
import { useLoadOnMount } from '@/lib/useLoadOnMount';
import { countLearningToday } from '@/lib/learningDay';
import { charDiff } from '@/lib/charDiff';
import { speak } from '@/lib/speech';
import { speechLang } from '@/lib/languages';
import { sourceFor } from '@/lib/languagePair';
import { answerInputProps } from '@/lib/inputProps';
import type { DeLevel } from '@/lib/deForms';
import type { DeDrillTense } from '@/lib/deConjugate';
import { DE_DRILL_LEVELS, buildTenseRound, gradeTense, tensesAtLevel, type TenseQuestion } from '@/lib/games/deTenseDrill';
import ScreenFeedback from '@/lib/screenFeedback';
import FitText from '@/components/FitText';
import SpeakButton from '@/components/SpeakButton';
import { useDiffStyles } from '@/lib/useDiffStyles';
import CardShell from '@/components/learn/CardShell';
import DockedAction, { DOCK_RESERVE, FAB_CLEARANCE } from '@/components/learn/DockedAction';
import { useDockLift } from '@/components/learn/useDockLift';

// The German tense drill (Grammar tab, German course): a verb, a person and a tense are shown ("er/sie/es · aufstehen",
// Perfekt), the learner types the form with its pronoun ("er ist aufgestanden"). The verbs are the verbs of the German deck up to
// the picked level, the tenses the ones that level teaches (lib/games/deTenseDrill.ts); the forms come from lib/deConjugate.ts,
// which leaves out every verb the tables cannot vouch for. The umlaut and the ß are graded (keepUmlauts), like the form drill.

type Phase = 'setup' | 'play' | 'done';
type TenseChoice = DeDrillTense | 'mixed';

function startLevel(level: string | undefined): DeLevel {
  const known = DE_DRILL_LEVELS.find((l) => l === level);
  if (known) return known;
  return level === 'C2' ? 'C1' : 'A1';
}

export default function TenseDrillScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const diff = useDiffStyles();
  const s = t();
  const d = s.tenseDrill;
  const router = useRouter();
  const { strictAccents, refresh } = useLearner();

  const [loading, setLoading] = useState(true);
  const [contentLang, setContentLang] = useState('en');
  const [phase, setPhase] = useState<Phase>('setup');
  const [level, setLevel] = useState<DeLevel>('A1');
  const [tense, setTense] = useState<TenseChoice>('mixed');
  const [empty, setEmpty] = useState(false);
  const [round, setRound] = useState<TenseQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [right, setRight] = useState(0);
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState<{ correct: boolean } | null>(null);
  // the input remounts for every question, so that autoFocus runs again (the same reason as on the deck screen)
  const [seq, setSeq] = useState(0);
  const [dockH, setDockH] = useState(DOCK_RESERVE);
  const { dockLift } = useDockLift();

  const load = useCallback(async () => {
    const { target, source } = await refresh(['direction', 'strictAccents']);
    setContentLang(sourceFor(target, source));
    const stored = startLevel((await getDb().getLevel()).level);
    setLevel(stored);
    setLoading(false);
  }, [refresh]);

  useLoadOnMount(load);

  const chooseLevel = (next: DeLevel) => {
    setLevel(next);
    // a tense this level does not teach yet falls back to "all tenses"
    if (tense !== 'mixed' && !tensesAtLevel(next).includes(tense)) setTense('mixed');
  };

  const begin = () => {
    const questions = buildTenseRound({ level, tense, seed: Date.now() % 2147483647 });
    setRound(questions);
    setIndex(0);
    setRight(0);
    setTyped('');
    setChecked(null);
    setSeq((n) => n + 1);
    setEmpty(questions.length === 0);
    setPhase(questions.length > 0 ? 'play' : 'setup');
  };

  const current = round[index];

  const handleCheck = () => {
    if (!current) return;
    const correct = gradeTense(typed, current, { strictAccents });
    setChecked({ correct });
    speak(current.answer, speechLang('de'));
  };

  const handleNext = () => {
    if (!current || !checked) return;
    void countLearningToday();
    if (checked.correct) setRight((n) => n + 1);
    setTyped('');
    setChecked(null);
    setSeq((n) => n + 1);
    if (index + 1 >= round.length) setPhase('done');
    else setIndex(index + 1);
  };

  const meaning = current ? current.meaning[contentLang as 'es' | 'en' | 'hu'] || current.meaning.en : '';

  const header = (
    <View style={[styles.header, brutalHeaderRowStyle(g)]}>
      <BackButton testID="tensedrill-back" onPress={() => (phase === 'play' ? setPhase('setup') : router.back())} arrowStyle={[styles.back, { color: colors.text }]} />
      <FitText variant="title" base={17} maxLines={2} reserve={g.brutal ? 190 : 150} caps={g.brutal} style={[styles.title, { color: colors.text }, g.brutal && styles.brutalTitle]}>
        {d.title}
      </FitText>
      {phase === 'play' ? (
        <Badge
          label={d.progress(index + 1, round.length)}
          rotate={4}
          classicStyle={[styles.progressChip, { backgroundColor: colors.tint }]}
          classicTextStyle={[styles.progressChipText, { color: colors.onTint }]}
        />
      ) : (
        <View style={styles.headerSpacer} />
      )}
    </View>
  );

  const feedback = <ScreenFeedback level={level} languagePair={`${contentLang}→de`} currentCard={`grammar:tense-drill:${phase}`} />;

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  const chip = (testID: string, label: string, selected: boolean, onPress: () => void, hint?: string) => (
    <Pressable
      key={testID}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, themedEdgeStyle(g), { borderColor: selected ? colors.tint : colors.tabIconDefault, backgroundColor: selected ? colors.tint : colors.card }]}
    >
      <Text style={[styles.chipText, { color: selected ? colors.onTint : colors.text }]}>{label}</Text>
      {hint ? <Text style={[styles.chipHint, { color: selected ? colors.onTint : colors.tabIconDefault }]}>{hint}</Text> : null}
    </Pressable>
  );

  if (phase === 'setup') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        <ScrollView contentContainerStyle={styles.setupBody} keyboardShouldPersistTaps="handled">
          <Text style={[styles.setupLabel, { color: colors.tabIconDefault }]}>{d.levelLabel}</Text>
          <View style={styles.chipRow}>
            {DE_DRILL_LEVELS.map((lvl) => chip(`tensedrill-level-${lvl}`, lvl, level === lvl, () => chooseLevel(lvl)))}
          </View>
          <Text style={[styles.setupLabel, { color: colors.tabIconDefault }]}>{d.tenseLabel}</Text>
          <View style={styles.chipColumn}>
            {chip('tensedrill-tense-mixed', d.mixed, tense === 'mixed', () => setTense('mixed'))}
            {tensesAtLevel(level).map((tn) => chip(`tensedrill-tense-${tn}`, d.tenseNames[tn], tense === tn, () => setTense(tn), d.tenseHints[tn]))}
          </View>
          <ActionButton
            testID="tensedrill-begin"
            fill="a"
            label={d.begin}
            onPress={begin}
            brutalStyle={styles.brutalBtn}
            classicStyle={[styles.btn, { backgroundColor: colors.tint }]}
            classicTextStyle={[styles.btnTextOnTint, { color: colors.onTint }]}
            classicRole={null}
          />
          {empty ? <Text style={[styles.empty, { color: colors.tabIconDefault }]}>{d.empty}</Text> : null}
        </ScrollView>
        {feedback}
      </View>
    );
  }

  if (phase === 'done') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        <ProgressBar testID="tensedrill-segments" pct={100} brutalStyle={styles.brutalBar} trackStyle={styles.progressTrack} trackColor={colors.card} fillStyle={styles.progressFill} fillColor={colors.successFill} />
        <View style={styles.doneBody}>
          <Text style={styles.doneEmoji}>{right === round.length ? '🎉' : '👍'}</Text>
          <Text testID="tensedrill-result" variant="title" style={[styles.doneTitle, { color: colors.text }]}>{d.resultTitle(right, round.length)}</Text>
          <ActionButton
            testID="tensedrill-again"
            fill="a"
            label={d.again}
            onPress={begin}
            brutalStyle={styles.brutalBtn}
            classicStyle={[styles.btn, { backgroundColor: colors.tint }]}
            classicTextStyle={[styles.btnTextOnTint, { color: colors.onTint }]}
            classicRole={null}
          />
          <ActionButton
            testID="tensedrill-change"
            fill="paper"
            label={d.changeChoice}
            onPress={() => setPhase('setup')}
            brutalStyle={styles.brutalBtn}
            classicStyle={[styles.btn, styles.btnOutline, { borderColor: colors.tint }]}
            classicTextStyle={[styles.btnTextOnTint, { color: colors.tint }]}
            classicRole={null}
          />
          <Pressable style={styles.ghostBtn} onPress={() => router.back()}>
            <Text style={[styles.ghostBtnText, { color: colors.tabIconDefault }]}>{d.backToCourse}</Text>
          </Pressable>
        </View>
        {feedback}
      </View>
    );
  }

  const pct = round.length > 0 ? (index / round.length) * 100 : 0;

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      <ProgressBar testID="tensedrill-segments" pct={pct} brutalStyle={styles.brutalBar} trackStyle={styles.progressTrack} trackColor={colors.card} fillStyle={styles.progressFill} fillColor={colors.successFill} />

      <ScrollView
        style={styles.cardScroll}
        contentContainerStyle={[styles.cardScrollContent, { paddingBottom: FAB_CLEARANCE + dockH + dockLift }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={keyboardDismissOnDrag()}
      >
        <CardShell compact colors={colors} chip={d.tenseNames[current.tense].toUpperCase()} onPress={dismissKeyboardOnTap}>
          <Text style={[styles.promptCaption, { color: colors.tabIconDefault }]}>{d.tenseHints[current.tense]}</Text>
          <FitText testID="tensedrill-prompt" variant="word" base={32} maxLines={3} reserve={100} style={[styles.promptBig, { color: colors.text }]}>
            {`${current.personLabel} · ${current.infinitive}`}
          </FitText>
          {meaning ? <Text style={[styles.promptInfinitive, { color: colors.tabIconDefault }]}>{meaning}</Text> : null}
          {current.own ? <Text style={[styles.ownHint, { color: colors.tabIconDefault }]}>{d.ownHint}</Text> : null}

          <TextInput
            key={`tense-in-${current.id}-${seq}`}
            testID="tensedrill-input"
            style={[styles.input, { color: colors.text, borderColor: colors.tabIconDefault }, themedInputStyle(g)]}
            value={typed}
            onChangeText={setTyped}
            onSubmitEditing={checked ? handleNext : handleCheck}
            editable={!checked}
            autoFocus
            placeholder={d.caption}
            placeholderTextColor={colors.tabIconDefault}
            {...answerInputProps}
          />

          {checked && (
            <View style={styles.resultSection}>
              {checked.correct ? (
                <Text testID="tensedrill-correct" style={[styles.correctLine, { color: colors.success }]}>{`✓ ${current.answer}`}</Text>
              ) : (
                <>
                  <Text style={styles.diffLine}>
                    {charDiff(typed, current.answer, { case: true, accents: false }).map((part, i) => (
                      <Text key={i} style={part.missing ? diff.missing : part.wrong ? diff.wrong : { color: colors.text }}>
                        {part.ch}
                      </Text>
                    ))}
                  </Text>
                  <View style={styles.frontRow}>
                    <Text testID="tensedrill-answer" variant="word" style={[styles.correctAnswer, { color: colors.tint }]}>{current.answer}</Text>
                    <SpeakButton onPress={() => speak(current.answer, speechLang('de'))} style={styles.speakBtn} iconStyle={styles.speakIcon} />
                  </View>
                </>
              )}
            </View>
          )}
        </CardShell>
      </ScrollView>

      <DockedAction
        testID="tensedrill-dock"
        label={checked ? `${s.grammar.next} →` : `✓ ${s.card.check}`}
        onPress={checked ? handleNext : handleCheck}
        tone={checked ? 'next' : 'check'}
        bottom={dockLift}
        colors={colors}
        onHeight={setDockH}
      />

      <ScreenFeedback level={level} languagePair={`${contentLang}→de`} currentCard={`grammar:tense-drill:${current.id}`} bottomOffset={dockH + dockLift} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'flex-start' },
  centered: { justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  headerSpacer: { width: 24 },
  back: { fontSize: 22 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', paddingHorizontal: 8 },
  brutalTitle: { textTransform: 'uppercase', fontWeight: '500' },
  brutalBar: { marginBottom: 16 },
  brutalBtn: { alignSelf: 'stretch', marginTop: 10 },
  progressChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  progressChipText: { fontSize: 13, fontWeight: '700' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 16 },
  progressFill: { height: '100%', borderRadius: 3 },
  setupBody: { paddingBottom: 40, gap: 10 },
  setupLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipColumn: { gap: 8 },
  chip: { borderWidth: 2, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
  chipText: { fontSize: 16, fontWeight: '700' },
  chipHint: { fontSize: 12, marginTop: 2 },
  empty: { fontSize: 14, textAlign: 'center', marginTop: 12 },
  cardScroll: { flex: 1, width: '100%' },
  cardScrollContent: { flexGrow: 1, justifyContent: 'flex-start', paddingTop: 8 },
  promptCaption: { fontSize: 13, textAlign: 'center', marginBottom: 8 },
  promptBig: { fontSize: 32, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  promptInfinitive: { fontSize: 15, fontStyle: 'italic', textAlign: 'center', marginTop: -12, marginBottom: 12 },
  ownHint: { fontSize: 13, textAlign: 'center', marginBottom: 10 },
  input: { width: '100%', borderWidth: 2, borderRadius: 12, padding: 14, fontSize: 18, textAlign: 'center' },
  resultSection: { alignItems: 'center', marginTop: 16 },
  correctLine: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  diffLine: { fontSize: 20, fontWeight: '700', textAlign: 'center', letterSpacing: 1, marginBottom: 6 },
  frontRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 },
  correctAnswer: { flex: 1, flexShrink: 1, fontSize: 22, fontWeight: '600', textAlign: 'center' },
  speakBtn: { padding: 4, flexShrink: 0 },
  speakIcon: { fontSize: 22 },
  doneBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  doneEmoji: { fontSize: 52 },
  doneTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  btn: { marginTop: 10, alignSelf: 'stretch', paddingVertical: 14, borderRadius: 26, alignItems: 'center' },
  btnTextOnTint: { fontSize: 16, fontWeight: '700' },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 2 },
  ghostBtn: { marginTop: 4, padding: 8 },
  ghostBtnText: { fontSize: 14 },
});
