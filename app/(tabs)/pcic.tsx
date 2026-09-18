import { useCallback, useState } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { speak } from '@/lib/speech';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { getDb } from '@/lib/database';
import { t } from '@/lib/i18n';
import { charDiff } from '@/lib/charDiff';
import { speechLang } from '@/lib/languages';
import { localDateString } from '@/lib/usageStats';
import { PCIC_ITEMS, findPcicItem } from '@/data/pcic';
import { gradePcicAnswer, type PcicGrade } from '@/lib/pcicMatch';
import { sm2Review, sm2Preview, pickSm2Session, sm2MarkKnown, type Sm2Card, type Sm2Grade } from '@/lib/sm2';
import { requeueAfterGrade, requeueAfterUndo } from '@/lib/pcicSession';
import FeedbackButton from '@/components/FeedbackModal';
import { answerInputProps } from '@/lib/inputProps';

// PLAN-pcic 5. lépés: a PCIC fül. Angol -> spanyol gépelés, Anki-gombokkal
// (again/hard/good/easy), az önálló SM-2 ütemezőn (lib/sm2.ts, 4. lépés).
// Nem a FSRS `cards`/`sessionQueue` ütemezőt használja, azt nem érinti.

const NEW_ORDER = PCIC_ITEMS.map((i) => i.id);
const GRADES: Sm2Grade[] = ['again', 'good'];

// FB minta (pcicMatch.ts): exact -> Good, near -> Hard, wrong -> Again van
// előre kijelölve, Easy sosem.
// SZ1, Kálmán döntése 2026-09-18: near is Tudtam, ő nyomja le Nem tudtam-ra.
const PRESELECT: Record<PcicGrade['match'], Sm2Grade> = { exact: 'good', near: 'good', wrong: 'again' };

// SZ2 (SZAVAK.md): egy visszavonható értékelés pillanatképe. `counted` = a
// számlálókat is léptette-e (SZ3 „Ezt nem tanulom" gombja majd false-t ír ide).
interface UndoEntry {
  before: Sm2Card;
  after: Sm2Card;
  typed: string;
  grade: PcicGrade | null;
  wasNew: boolean;
  g: Sm2Grade;
  counted: boolean;
}

export default function PcicScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState('');
  const [allCards, setAllCards] = useState<Map<string, Sm2Card>>(new Map());
  const [queue, setQueue] = useState<Sm2Card[]>([]);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [grade, setGrade] = useState<PcicGrade | null>(null);
  const [sessionAnswered, setSessionAnswered] = useState(0);
  const [sessionNew, setSessionNew] = useState(0);
  const [sessionAgain, setSessionAgain] = useState(0);
  const [lastGraded, setLastGraded] = useState<UndoEntry | null>(null);
  // SZ5 (SZAVAK.md): üres beküldés a szót azonnal Nem tudtam-ként értékeli;
  // ilyenkor a kártya a képernyőn marad felfedve, és a gradesRow helyett egy
  // "Tovább" gomb lépteti a sort (advance() csak akkor fut).
  const [autoGraded, setAutoGraded] = useState(false);

  const load = useCallback(async () => {
    const db = getDb();
    const day = localDateString();
    const cards = await db.getPcicCards();
    setToday(day);
    setAllCards(new Map(cards.map((c) => [c.itemId, c])));
    setQueue(pickSm2Session(cards, NEW_ORDER, day));
    setTypedAnswer('');
    setGrade(null);
    setSessionAnswered(0);
    setSessionNew(0);
    setSessionAgain(0);
    setLastGraded(null);
    setLoading(false);
    // setTypedAnswer is listed because the React Compiler infers it as a
    // dependency of this async callback (FB minta, lásd app/spelling.tsx); it
    // is stable, so nothing changes at runtime, but an empty array here counts
    // as broken memoization.
  }, [setTypedAnswer]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const current = queue[0];
  const currentItem = current ? findPcicItem(current.itemId) : undefined;

  const dueRemaining = queue.filter((c) => c.state !== 'new').length;
  const newRemaining = queue.filter((c) => c.state === 'new').length;
  const doneToday = [...allCards.values()].filter((c) => c.lastReview === today).length;

  // SZ5: a DB-írás + számlálók külön függvényben, hogy a queue-léptetés
  // (advance) nélkül is meghívható legyen (üres beküldésnél a kártya a
  // képernyőn marad, csak a "Tovább" gomb léptet). A `revealed` a lastGraded
  // felfedésének értéke; alapból a képernyőn látszó `grade`, de az
  // auto-értékelésnél a handleCheck a frissen számolt objektumot adja át,
  // mert a `grade` state a setGrade hívás után még nem frissült a closure-ben.
  const commitGrade = async (g: Sm2Grade, revealed: PcicGrade | null = grade): Promise<Sm2Card | null> => {
    if (!current) return null;
    const wasNew = current.state === 'new';
    const before = { ...current };
    const next = sm2Review(current, g, today);
    await getDb().upsertPcicCard(next);

    setAllCards((prev) => new Map(prev).set(next.itemId, next));
    setLastGraded({ before, after: next, typed: typedAnswer, grade: revealed, wasNew, g, counted: true });
    setSessionAnswered((n) => n + 1);
    if (wasNew) setSessionNew((n) => n + 1);
    if (g === 'again') setSessionAgain((n) => n + 1);
    return next;
  };

  const advance = (next: Sm2Card) => {
    setQueue((prev) => requeueAfterGrade(prev, next, today));
    setTypedAnswer('');
    setGrade(null);
    setAutoGraded(false);
  };

  const handleCheck = async () => {
    if (!current || !currentItem) return;
    if (typedAnswer.trim().length === 0) {
      // SZ5 (SZAVAK.md): üres beküldés = Nem tudtam automatikusan; felfedi a
      // helyes alakot és felolvassa. Mondatot most nem olvas fel (SZ6 PARKOL,
      // nincs mondat-adat a PCIC-tételekhez).
      const g = gradePcicAnswer('', currentItem.es);
      const revealed: PcicGrade = { ...g, match: 'wrong' };
      setGrade(revealed);
      speak(g.best, speechLang('es'));
      const next = await commitGrade('again', revealed);
      if (next) setAutoGraded(true);
      return;
    }
    setGrade(gradePcicAnswer(typedAnswer, currentItem.es));
  };

  const handleGrade = async (g: Sm2Grade) => {
    const next = await commitGrade(g);
    if (next) advance(next);
  };

  const handleUndo = async () => {
    if (!lastGraded) return;
    await getDb().upsertPcicCard(lastGraded.before);
    setAllCards((prev) => new Map(prev).set(lastGraded.before.itemId, lastGraded.before));
    // SZ5: auto-graded üres beküldésnél a kártya még nem lépett a sor
    // végére (nincs advance() hívás), tehát a sorhoz sem kell nyúlni.
    if (!autoGraded) {
      setQueue((prev) => requeueAfterUndo(prev, lastGraded.before, lastGraded.after, today));
    }
    // A padló 0, mert a session-reset (load) közben is lehet nyomni.
    if (lastGraded.counted) {
      setSessionAnswered((n) => Math.max(0, n - 1));
      if (lastGraded.wasNew) setSessionNew((n) => Math.max(0, n - 1));
      if (lastGraded.g === 'again') setSessionAgain((n) => Math.max(0, n - 1));
    }
    setTypedAnswer(lastGraded.typed);
    setGrade(lastGraded.grade);
    setAutoGraded(false);
    setLastGraded(null);
  };

  const handleDontLearn = async () => {
    if (!current) return;
    const before = { ...current };
    const next = sm2MarkKnown(current, today);
    await getDb().upsertPcicCard(next);
    setAllCards((prev) => new Map(prev).set(next.itemId, next));
    setLastGraded({ before, after: next, typed: typedAnswer, grade, wasNew: false, g: 'good', counted: false });
    setQueue((prev) => requeueAfterGrade(prev, next, today));
    setTypedAnswer('');
    setGrade(null);
  };

  const handleReset = () => {
    const doReset = async () => {
      await getDb().resetPcicCards();
      setLoading(true);
      await load();
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`${s.pcic.resetConfirmTitle}\n${s.pcic.resetConfirmMessage}`)) doReset();
    } else {
      Alert.alert(s.pcic.resetConfirmTitle, s.pcic.resetConfirmMessage, [
        { text: s.feedback.cancel, style: 'cancel' },
        { text: s.pcic.resetConfirmYes, style: 'destructive', onPress: doReset },
      ]);
    }
  };

  const headerRow = (
    <View style={styles.headerRow}>
      <Text style={[styles.headerText, { color: colors.tabIconDefault }]}>
        {s.pcic.header(dueRemaining, newRemaining, doneToday)}
      </Text>
      {lastGraded && (
        <Pressable onPress={handleUndo} hitSlop={12} style={styles.resetBtn} accessibilityLabel={s.pcic.undo}>
          <Text style={styles.resetIcon}>↶</Text>
        </Pressable>
      )}
      <Pressable onPress={handleReset} hitSlop={12} style={styles.resetBtn}>
        <Text style={styles.resetIcon}>🗑️</Text>
      </Pressable>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!current || !currentItem) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {headerRow}
        <Text style={[styles.title, { color: colors.text }]}>{s.pcic.doneTitle}</Text>
        {sessionAnswered > 0 && (
          <Text style={[styles.emptySub, { color: colors.tabIconDefault }]}>
            {s.pcic.summary(sessionAnswered, sessionNew, sessionAgain)}
          </Text>
        )}
        <FeedbackButton level="B1" languagePair="es-en" currentCard="pcic" />
      </View>
    );
  }

  const previews = sm2Preview(current, today);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {headerRow}

      <Pressable style={[styles.card, { backgroundColor: colors.card }]} onPress={() => Keyboard.dismiss()}>
        <Text style={[styles.frontText, { color: colors.text }]}>{currentItem.en}</Text>
        <Text style={[styles.sectionText, { color: colors.tabIconDefault }]}>{currentItem.section}</Text>

        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.tabIconDefault }]}
          value={typedAnswer}
          onChangeText={setTypedAnswer}
          onSubmitEditing={grade ? undefined : handleCheck}
          editable={!grade}
          autoFocus
          {...answerInputProps}
        />

        {grade && (
          <View style={styles.resultSection}>
            <Text style={styles.diffLine}>
              {charDiff(typedAnswer, grade.best, { case: true, accents: false }).map((d, i) => (
                <Text
                  key={i}
                  style={
                    d.missing
                      ? styles.diffMissing
                      : d.wrong
                        ? styles.diffWrong
                        : { color: grade.match === 'exact' ? '#22C55E' : colors.text }
                  }
                >
                  {d.ch}
                </Text>
              ))}
            </Text>
            <View style={styles.frontRow}>
              <Text style={[styles.correctAnswer, { color: colors.tint }]}>{grade.best}</Text>
              <Pressable onPress={() => speak(grade.best, speechLang('es'))} style={styles.speakBtn}>
                <Text style={styles.speakIcon}>🔊</Text>
              </Pressable>
            </View>
          </View>
        )}
      </Pressable>

      <Pressable onPress={handleDontLearn} hitSlop={8}>
        <Text style={[styles.dontLearn, { color: colors.tabIconDefault }]}>{s.pcic.dontLearn}</Text>
      </Pressable>

      {!grade ? (
        <Pressable style={[styles.checkBtn, { backgroundColor: colors.tint }]} onPress={handleCheck}>
          <Text style={styles.checkBtnText}>{s.card.check}</Text>
        </Pressable>
      ) : autoGraded ? (
        <Pressable
          style={[styles.checkBtn, { backgroundColor: colors.tint }]}
          onPress={() => lastGraded && advance(lastGraded.after)}
        >
          <Text style={styles.checkBtnText}>{s.pcic.next}</Text>
        </Pressable>
      ) : (
        <View style={styles.gradesRow}>
          {GRADES.map((g) => {
            const isPre = PRESELECT[grade.match] === g;
            return (
              <Pressable
                key={g}
                style={({ pressed }) => [
                  styles.gradeBtn,
                  {
                    backgroundColor: pressed ? (g === 'good' ? '#22C55E' : '#EF4444') : colors.card,
                    borderColor: pressed ? (g === 'good' ? '#22C55E' : '#EF4444') : isPre ? colors.tint : 'transparent',
                    borderWidth: isPre ? 3 : 1,
                  },
                ]}
                onPress={() => handleGrade(g)}
              >
                {({ pressed }) => (
                  <>
                    <Text style={[styles.gradeLabel, { color: pressed ? '#FFFFFF' : colors.text }]}>{s.pcic[g]}</Text>
                    <Text style={[styles.gradePreview, { color: pressed ? '#FFFFFF' : colors.tabIconDefault }]}>
                      {previews[g]}
                    </Text>
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      <FeedbackButton level="B1" languagePair="es-en" currentCard="pcic" />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerText: {
    fontSize: 13,
    flex: 1,
  },
  resetBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetIcon: {
    fontSize: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    textAlign: 'center',
  },
  card: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    minHeight: 220,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  frontRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  frontText: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  sectionText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  speakBtn: {
    padding: 4,
  },
  speakIcon: {
    fontSize: 22,
  },
  input: {
    width: '100%',
    borderWidth: 2,
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    textAlign: 'center',
  },
  resultSection: {
    alignItems: 'center',
    marginTop: 16,
  },
  diffLine: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 6,
  },
  diffWrong: {
    backgroundColor: '#EF4444',
    color: '#FFFFFF',
  },
  diffMissing: {
    backgroundColor: '#EAB308',
    color: '#FFFFFF',
    textDecorationLine: 'underline',
  },
  correctAnswer: {
    fontSize: 22,
    fontWeight: '600',
  },
  dontLearn: {
    fontSize: 13,
    textAlign: 'right',
    marginBottom: 8,
  },
  checkBtn: {
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 44,
    marginTop: 24,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  gradesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
  },
  gradeBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  gradePreview: {
    fontSize: 11,
    marginTop: 2,
  },
});
