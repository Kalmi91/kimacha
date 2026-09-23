import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { speak, speakSequence, stopSpeaking } from '@/lib/speech';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { getDb } from '@/lib/database';
import { t } from '@/lib/i18n';
import { charDiff } from '@/lib/charDiff';
import { speechLang } from '@/lib/languages';
import { localDateString } from '@/lib/usageStats';
import { pcicItemsForLevel, findPcicItem, type PcicLevel } from '@/data/pcic';
import { gradePcicAnswer, suggestedGrade, type PcicGrade } from '@/lib/pcicMatch';
import { ARTICLE_OPTIONS, articleOf, articlePickerApplies, composeAnswer, type ArticlePick } from '@/lib/articlePicker';
import { sm2Review, sm2PreviewDays, pickSm2Session, sm2MarkKnown, LEARNING_STEPS, DEFAULT_NEW_LIMIT, type Sm2Card, type Sm2Grade } from '@/lib/sm2';
import { countDoneToday, requeueAfterGrade, requeueAfterUndo } from '@/lib/pcicSession';
import { cardsForLevel } from '@/lib/pcicLevels';
import { posOf } from '@/lib/pcicPos';
import FeedbackButton from '@/components/FeedbackModal';
import BadgeRow from '@/components/learn/BadgeRow';
import CardShell from '@/components/learn/CardShell';
import DockedAction, { DOCK_RESERVE } from '@/components/learn/DockedAction';
import { useDockLift } from '@/components/learn/useDockLift';
import { answerInputProps } from '@/lib/inputProps';
import LevelPickerSheet from '@/components/LevelPickerSheet';

// PLAN-pcic 5. lépés: a PCIC fül. Angol -> spanyol gépelés, Anki-gombokkal
// (again/hard/good/easy), az önálló SM-2 ütemezőn (lib/sm2.ts, 4. lépés).
// Nem a FSRS `cards`/`sessionQueue` ütemezőt használja, azt nem érinti.

// A régi (PR #27 előtti) gombsor sorrendje: Nem tudtam, Tudtam.
const GRADES: Sm2Grade[] = ['again', 'good'];

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
  const [level, setLevel] = useState<PcicLevel>('B1');
  // s1 (anki-ui-terv.html): a szint-választó lap; a benne mutatott N/total
  // haladáshoz MIND a négy szint kártyája kell, nem csak az aktívé.
  const [levelSheetOpen, setLevelSheetOpen] = useState(false);
  const [allLevelCards, setAllLevelCards] = useState<Sm2Card[]>([]);
  // s2 (anki-ui-terv.html): a Beállítások ékezet-szigor kapcsolója a PCIC
  // gépelésén is dönt (gradePcicAnswer strictAccents paramja).
  const [strictAccents, setStrictAccents] = useState(false);
  const [allCards, setAllCards] = useState<Map<string, Sm2Card>>(new Map());
  const [queue, setQueue] = useState<Sm2Card[]>([]);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [articlePick, setArticlePick] = useState<ArticlePick>('');
  const [grade, setGrade] = useState<PcicGrade | null>(null);
  const [sessionAnswered, setSessionAnswered] = useState(0);
  const [sessionNew, setSessionNew] = useState(0);
  const [sessionAgain, setSessionAgain] = useState(0);
  const [lastGraded, setLastGraded] = useState<UndoEntry | null>(null);
  // FB314: a "+10 új szó" gombbal bővített napi keret; load() (fókusz-váltás,
  // új nap) nullázza, a menet közbeni értékelések nem érintik.
  const [extraNew, setExtraNew] = useState(0);
  // 5b: a dokkolt Check/Next sáv mért magassága, a görgető alsó paddingjéhez
  // és a 💬 bottomOffsetjéhez (DockedAction.tsx, a Learn DOCK_RESERVE-je az alapérték).
  const [dockH, setDockH] = useState(DOCK_RESERVE);
  // FB350: a dokkolt sáv a billentyűzet fölé emelkedjen, mint a Learn fülön.
  const { dockLift } = useDockLift();

  // PLAN-play 10. lépés: `overrideLevel` a szint-választó lapról jövő azonnali
  // váltásnak, hogy ne kelljen a setLevel-re várni egy render-kört (a db-be
  // már ott az új szint, load() csak újraolvassa vele).
  const load = useCallback(async (overrideLevel?: PcicLevel) => {
    const db = getDb();
    const day = localDateString();
    const lvl = overrideLevel ?? (await db.getPcicLevel());
    const newOrder = pcicItemsForLevel(lvl).map((i) => i.id);
    const rawCards = await db.getPcicCards();
    const cards = cardsForLevel(rawCards, lvl);
    const strict = await db.getStrictAccents();
    setLevel(lvl);
    setAllLevelCards(rawCards);
    setStrictAccents(strict);
    setToday(day);
    setAllCards(new Map(cards.map((c) => [c.itemId, c])));
    setQueue(pickSm2Session(cards, newOrder, day));
    setTypedAnswer('');
    setGrade(null);
    setSessionAnswered(0);
    setSessionNew(0);
    setSessionAgain(0);
    setLastGraded(null);
    setExtraNew(0);
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

  // s1: a szint-választó lapon koppintva azonnal a választott szint pakliját
  // adja (a lap előbb bezár, hogy a váltás ne tűnjön befagyottnak).
  const handleSelectLevel = async (lvl: PcicLevel) => {
    setLevelSheetOpen(false);
    if (lvl === level) return;
    await getDb().setPcicLevel(lvl);
    setLoading(true);
    await load(lvl);
  };

  const newOrder = useMemo(() => pcicItemsForLevel(level).map((i) => i.id), [level]);
  const current = queue[0];
  const currentItem = current ? findPcicItem(current.itemId) : undefined;

  // FB319: az angol prompt felolvasása, amikor egy ÚJ lap kerül képernyőre.
  // Csak a `current?.itemId` váltására fusson (a `grade` a closure-ből olvasva
  // dönti el, hogy még nincs felfedve), felfedéskor (a `grade` state
  // változásakor) ne ismételje.
  useEffect(() => {
    if (!loading && currentItem && !grade) {
      speak(currentItem.en, speechLang('en'));
    }
    // PLAN-play 11. lépés: kártyaváltáskor a folyamatban lévő felolvasás
    // (pl. Check utáni szó+példamondat lánc) álljon le, LECKE-SEMA 3.3 minta.
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.itemId, loading]);

  const dueRemaining = queue.filter((c) => c.state !== 'new').length;
  const newRemaining = queue.filter((c) => c.state === 'new').length;
  const doneToday = countDoneToday([...allCards.values()], today);

  // SZ2 (SZAVAK.md): a DB-írás + számlálók itt, a queue-léptetés (advance) a
  // hívó handleGrade-ben, külön.
  const commitGrade = async (g: Sm2Grade): Promise<Sm2Card | null> => {
    if (!current) return null;
    const wasNew = current.state === 'new';
    const before = { ...current };
    const next = sm2Review(current, g, today);
    await getDb().upsertPcicCard(next);

    setAllCards((prev) => new Map(prev).set(next.itemId, next));
    setLastGraded({ before, after: next, typed: typedAnswer, grade, wasNew, g, counted: true });
    setSessionAnswered((n) => n + 1);
    if (wasNew) setSessionNew((n) => n + 1);
    if (g === 'again') setSessionAgain((n) => n + 1);
    return next;
  };

  const advance = (next: Sm2Card) => {
    setQueue((prev) => requeueAfterGrade(prev, next, today));
    setTypedAnswer('');
    setArticlePick('');
    setGrade(null);
  };

  // PLAN-play 11. lépés: Check után a szó felolvasása UTÁN, láncolva, magától
  // szól a példamondat is, ha van a tételhez (data/pcic/<szint>-sentences.json).
  const speakRevealed = (best: string) => {
    const example = currentItem?.exampleEs;
    if (example) {
      speakSequence([
        { text: best, locale: speechLang('es') },
        { text: example, locale: speechLang('es') },
      ]);
    } else {
      speak(best, speechLang('es'));
    }
  };

  const handleCheck = async () => {
    if (!current || !currentItem) return;
    const answer = composeAnswer(articlePick, typedAnswer);
    if (answer.trim().length === 0) {
      // Kálmán 2026-09-21: üres beküldés is felfedi a helyes alakot és
      // felolvassa, de nem értékel automatikusan; a koppintás dönt, mint
      // bármelyik felfedésnél.
      const g = gradePcicAnswer('', currentItem.es, strictAccents);
      const revealed: PcicGrade = { ...g, match: 'wrong', accentOnly: undefined };
      setGrade(revealed);
      if (revealed.match !== 'exact') setArticlePick(articleOf(revealed.best));
      speakRevealed(g.best);
      return;
    }
    // FB321: felfedéskor mindig szóljon a helyes spanyol alak.
    const g = gradePcicAnswer(answer, currentItem.es, strictAccents);
    setTypedAnswer(answer);
    setGrade(g);
    if (g.match !== 'exact') setArticlePick(articleOf(g.best));
    speakRevealed(g.best);
  };

  const handleGrade = async (g: Sm2Grade) => {
    const next = await commitGrade(g);
    if (next) advance(next);
  };

  const handleUndo = async () => {
    if (!lastGraded) return;
    await getDb().upsertPcicCard(lastGraded.before);
    setAllCards((prev) => new Map(prev).set(lastGraded.before.itemId, lastGraded.before));
    setQueue((prev) => requeueAfterUndo(prev, lastGraded.before, lastGraded.after, today));
    // A padló 0, mert a session-reset (load) közben is lehet nyomni.
    if (lastGraded.counted) {
      setSessionAnswered((n) => Math.max(0, n - 1));
      if (lastGraded.wasNew) setSessionNew((n) => Math.max(0, n - 1));
      if (lastGraded.g === 'again') setSessionAgain((n) => Math.max(0, n - 1));
    }
    setTypedAnswer(lastGraded.typed);
    setArticlePick('');
    setGrade(lastGraded.grade);
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
    setArticlePick('');
    setGrade(null);
  };

  const handleReset = () => {
    const doReset = async () => {
      // Csak az AKTÍV szint kártyáit üríti (a haladás szintenként külön él).
      await getDb().resetPcicCards(level.toLowerCase());
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

  // FB314: nincs több esedékes/új lap, de a témakörben van még be nem
  // vezetett tétel; ez a napi keretet bővíti +10-zel és újraépíti a sort.
  const handleMoreNew = () => {
    const next = extraNew + 10;
    setExtraNew(next);
    setQueue(pickSm2Session([...allCards.values()], newOrder, today, DEFAULT_NEW_LIMIT + next));
  };

  // s1 (anki-ui-terv.html): a fejléc ELSŐ chipje a kiválasztott szint,
  // koppintásra a szint-választó lap nyílik; a meglévő négy chip változatlan.
  // 5b: a régi egysoros szöveg-fejléc (`s.pcic.header`) helyett BadgeRow chip-sor;
  // a négy szám ugyanaz, csak külön i18n kulcsokból (badgeTotal/Due/New/Done).
  const headerRow = (
    <View style={styles.headerRow}>
      <View style={styles.headerBadges}>
        <Pressable style={[styles.levelChip, { backgroundColor: colors.tint }]} onPress={() => setLevelSheetOpen(true)}>
          <Text style={styles.levelChipText}>{level} ▾</Text>
        </Pressable>
        <BadgeRow
          colors={colors}
          items={[
            { label: s.pcic.badgeTotal(newOrder.length) },
            { label: s.pcic.badgeDue(dueRemaining), tone: 'blue' },
            { label: s.pcic.badgeNew(newRemaining), tone: 'green' },
            { label: s.pcic.badgeDone(doneToday), tone: 'pink' },
          ]}
        />
      </View>
      <View style={styles.headerIcons}>
        {lastGraded && (
          <Pressable onPress={handleUndo} hitSlop={12} style={styles.resetBtn} accessibilityLabel={s.pcic.undo}>
            <Text style={styles.resetIcon}>↶</Text>
          </Pressable>
        )}
        <Pressable onPress={handleReset} hitSlop={12} style={styles.resetBtn}>
          <Text style={styles.resetIcon}>🗑️</Text>
        </Pressable>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!current || !currentItem) {
    // FB317: hány PCIC-tétel van már bevezetve (nem 'new' állapotú) a teljes
    // listából, a done-képernyő saját haladás-csíkjához.
    const introducedCount = [...allCards.values()].filter((c) => c.state !== 'new').length;
    const introducedPct = newOrder.length > 0 ? (introducedCount / newOrder.length) * 100 : 0;
    return (
      <View style={[styles.container, styles.doneContainer, { backgroundColor: colors.background }]}>
        {headerRow}
        <LevelPickerSheet
          visible={levelSheetOpen}
          active={level}
          cards={allLevelCards}
          colors={colors}
          title={s.pcic.chooseLevel}
          onSelect={handleSelectLevel}
          onClose={() => setLevelSheetOpen(false)}
        />
        <View style={styles.doneHeader}>
          <Text style={styles.doneEmoji}>🎉</Text>
          <Text style={[styles.title, { color: colors.text }]}>{s.pcic.doneTitle}</Text>
        </View>
        <View style={styles.tilesRow}>
          <View style={[styles.tile, { backgroundColor: '#38BDF8' }]}>
            <Text style={styles.tileNumber}>{sessionAnswered}</Text>
            <Text style={styles.tileLabel}>{s.pcic.tileAnswered}</Text>
          </View>
          <View style={[styles.tile, { backgroundColor: '#22C55E' }]}>
            <Text style={styles.tileNumber}>{sessionNew}</Text>
            <Text style={styles.tileLabel}>{s.pcic.tileNew}</Text>
          </View>
          <View style={[styles.tile, { backgroundColor: '#F472B6' }]}>
            <Text style={styles.tileNumber}>{sessionAgain}</Text>
            <Text style={styles.tileLabel}>{s.pcic.tileAgain}</Text>
          </View>
        </View>
        <View style={styles.introducedBlock}>
          <Text style={[styles.introducedLabel, { color: colors.tabIconDefault }]}>
            {s.pcic.introduced(introducedCount, newOrder.length)}
          </Text>
          <View style={[styles.introducedTrack, { backgroundColor: colors.card }]}>
            <View style={[styles.introducedFill, { backgroundColor: '#38BDF8', width: `${introducedPct}%` }]} />
          </View>
        </View>
        {newOrder.some((id) => !allCards.has(id) || allCards.get(id)!.state === 'new') && (
          <Pressable style={[styles.checkBtn, { backgroundColor: '#38BDF8' }]} onPress={handleMoreNew}>
            <Text style={styles.checkBtnText}>{s.pcic.moreNew(10)}</Text>
          </Pressable>
        )}
        <FeedbackButton level={level} languagePair="es-en" currentCard="pcic" />
      </View>
    );
  }

  // FB320/FB352: a fejléc alatti haladás-csík a `doneToday` perzisztált napi
  // számból épül (nem a mountonként nullázódó `sessionAnswered`-ből), hogy
  // tab-váltás vagy app-újraindítás után is a valós napi haladást mutassa,
  // ne ugorjon vissza üresre.
  const sessionTotal = doneToday + queue.length;
  const sessionPct = sessionTotal > 0 ? (doneToday / sessionTotal) * 100 : 0;

  // A régi gombsor intervallum-előnézete grade-enként (lib/sm2.ts
  // sm2PreviewDays), i18n-nel formázva (FB350/5. commit: ne csak magyarul).
  const previewDays = sm2PreviewDays(current, today);
  const previews = Object.fromEntries(
    GRADES.map((g) => [g, previewDays[g] === 0 ? s.pcic.intervalToday : s.pcic.intervalDays(previewDays[g])])
  ) as Record<Sm2Grade, string>;

  // 5b: a lap tetejére kerülő lap/lépés-jelvény (CardShell chip propja),
  // a korábbi sectionRow-beli stepBadge szövegek helyén.
  const chipLabel =
    current.state === 'new'
      ? s.pcic.newBadge
      : current.state === 'learning'
        ? s.pcic.learningStep(current.step + 1, LEARNING_STEPS)
        : undefined;

  // 5c: szófaj-chip a szó alatt, a spanyol alakból (lib/pcicPos.ts, döntés 6b).
  const pos = posOf(currentItem);

  // T1 (anki-ui-terv.html): a dokkolt Check sáv felfedés után "Next"-re vált,
  // ugyanazzal a hellyel/mérettel, a javasolt értékeléssel a feliratban.
  const nextGrade = grade ? suggestedGrade(grade) : null;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {headerRow}
      <LevelPickerSheet
        visible={levelSheetOpen}
        active={level}
        cards={allLevelCards}
        colors={colors}
        title={s.pcic.chooseLevel}
        onSelect={handleSelectLevel}
        onClose={() => setLevelSheetOpen(false)}
      />

      <View style={[styles.progressTrack, { backgroundColor: colors.card }]}>
        <View style={[styles.progressFill, { backgroundColor: colors.tint, width: `${sessionPct}%` }]} />
      </View>

      <ScrollView
        style={styles.cardScroll}
        contentContainerStyle={[styles.cardScrollContent, { paddingBottom: 16 + dockH + dockLift }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <CardShell
          compact
          colors={colors}
          chip={chipLabel}
          chipTone={current.state === 'new' ? 'new' : 'neutral'}
          onPress={() => Keyboard.dismiss()}
        >
          {/* 5b: a szó melletti 🔊 újra elmondja az angolt (Kálmán kiegészítése,
              anki-ui-terv.html), ugyanazzal a hívással, mint a lap-nyitáskori FB319 felolvasás. */}
          <View style={styles.wordRow}>
            <Text style={[styles.frontText, { color: colors.text }]}>{currentItem.en}</Text>
            <Pressable onPress={() => speak(currentItem.en, speechLang('en'))} style={styles.speakBtn}>
              <Text style={styles.speakIcon}>🔊</Text>
            </Pressable>
          </View>
          {/* 5c: a chip (szófaj) + a szekció ugyanabban a sorban látszik
              gépeléskor és felfedés után is, hogy háromszor ismétlődő angol
              promptnál is megkülönböztethető legyen a tétel. */}
          <View style={styles.sectionRow}>
            {pos && (
              <View style={[styles.posChip, { backgroundColor: colors.background }]}>
                <Text style={[styles.posChipText, { color: colors.tabIconDefault }]}>
                  {pos.gender ? `${s.pos[pos.pos]} · ${pos.gender}` : s.pos[pos.pos]}
                </Text>
              </View>
            )}
            <Text style={[styles.sectionText, { color: colors.tabIconDefault }]}>{currentItem.section}</Text>
          </View>

          {/* SZ7 (SZAVAK.md): FB188 névelő-gombsor a Learn fülről, ⊘ az alapállás. */}
          {articlePickerApplies('es', currentItem.kind !== 'sentence', currentItem.es) && (
            <View style={styles.articleRow}>
              {([...ARTICLE_OPTIONS, ''] as ArticlePick[]).map((opt) => {
                const active = articlePick === opt;
                return (
                  <Pressable
                    key={opt || 'none'}
                    disabled={!!grade}
                    onPress={() => setArticlePick(active ? '' : opt)}
                    style={[
                      styles.articleChip,
                      { backgroundColor: active ? colors.tint : colors.background, opacity: grade ? 0.6 : 1 },
                    ]}
                    accessibilityLabel={opt || 'sin artículo'}
                  >
                    <Text style={[styles.articleChipText, { color: active ? colors.background : colors.text }]}>
                      {opt || '⊘'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.tabIconDefault }]}
            value={typedAnswer}
            onChangeText={setTypedAnswer}
            onSubmitEditing={grade ? () => nextGrade && handleGrade(nextGrade) : handleCheck}
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
                          : { color: nextGrade === 'good' ? '#22C55E' : colors.text }
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
              {/* s2 (anki-ui-terv.html): ékezet-szigor KI + csak-ékezet eltérés
                  -> a diff sárga jelölése mellett kimondva is 100%-nak számít. */}
              {grade.accentOnly && (
                <Text style={[styles.accentNote, { color: colors.tabIconDefault }]}>{s.pcic.accentForgiven}</Text>
              )}
              {/* PLAN-play 11. lépés: példamondat a megoldás alatt, csak Check
                  után és csak ha van egyezés a korpuszban (currentItem.exampleEs). */}
              {currentItem?.exampleEs && (
                <>
                  <View style={[styles.frontRow, styles.exampleRow]}>
                    <Text style={[styles.exampleEs, { color: colors.text }]}>{currentItem.exampleEs}</Text>
                    <Pressable onPress={() => speak(currentItem.exampleEs!, speechLang('es'))} style={styles.speakBtn}>
                      <Text style={styles.speakIcon}>🔊</Text>
                    </Pressable>
                  </View>
                  <Text style={[styles.exampleEn, { color: colors.tabIconDefault }]}>{currentItem.exampleEn}</Text>
                </>
              )}
            </View>
          )}

          {/* Kálmán 2026-09-21: a régi (PR #27 előtti) Tudtam/Nem tudtam
              gombsor vissza, intervallum-előnézettel; a koppintás dönt és
              értékel, üres beküldés után is. */}
          {grade && (
            <View style={styles.gradesRow}>
              {GRADES.map((g) => {
                const isPre = nextGrade === g;
                return (
                  <Pressable
                    key={g}
                    style={({ pressed }) => [
                      styles.gradeBtn,
                      {
                        backgroundColor: pressed ? (g === 'good' ? '#22C55E' : '#EF4444') : g === 'good' ? '#38BDF8' : '#1D4ED8',
                        borderColor: pressed ? (g === 'good' ? '#22C55E' : '#EF4444') : isPre ? colors.text : 'transparent',
                        borderWidth: isPre ? 3 : 1,
                      },
                    ]}
                    onPress={() => handleGrade(g)}
                  >
                    <Text style={styles.gradeLabel}>{s.pcic[g]}</Text>
                    <Text style={styles.gradePreview}>{previews[g]}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Pressable onPress={handleDontLearn} hitSlop={8}>
            <Text style={[styles.dontLearn, { color: colors.tabIconDefault }]}>{s.pcic.dontLearn}</Text>
          </Pressable>
        </CardShell>
      </ScrollView>

      {/* T1 (anki-ui-terv.html): Check után UGYANAZ a dokkolt sáv (hely+méret
          változatlan) "Next"-re vált, felirata kimondja a javasolt értékelést;
          a két gomb a kártyában felülbírálásra marad. */}
      <DockedAction
        label={grade && nextGrade ? s.pcic.next(s.pcic[nextGrade]) : `✓ ${s.card.check}`}
        onPress={grade && nextGrade ? () => handleGrade(nextGrade) : handleCheck}
        tone={grade ? 'next' : 'check'}
        color={grade ? '#22C55E' : undefined}
        bottom={dockLift}
        colors={colors}
        onHeight={setDockH}
      />

      <FeedbackButton level={level} languagePair="es-en" currentCard={`pcic:${current.itemId}`} bottomOffset={dockH + dockLift} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'flex-start',
  },
  // FB320: a loading-ág is a közös containert használja, de a pörgettyűnek
  // középen kell maradnia, nem a tetejére ugrania.
  centered: {
    justifyContent: 'center',
  },
  // FB320: vékony haladás-csík a fejléc alatt, a tanuló nézeten.
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  // s1 (anki-ui-terv.html): a szint-chip + a meglévő négy BadgeRow chip egy soron.
  headerBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  levelChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  levelChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
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
  // FB317: színes done-képernyő, a components/DoneScreen.tsx vizuális
  // nyelvén (doneEmoji, statsGrid), de saját stílusokkal.
  doneContainer: {
    gap: 16,
  },
  doneHeader: {
    alignItems: 'center',
  },
  doneEmoji: {
    fontSize: 52,
    textAlign: 'center',
    marginBottom: 8,
  },
  tilesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tile: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tileNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tileLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 2,
  },
  introducedBlock: {
    alignSelf: 'stretch',
  },
  introducedLabel: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  introducedTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  introducedFill: {
    height: '100%',
    borderRadius: 5,
  },
  // 5b: a kártya-doboz a CardShell-be költözött, a görgető pedig a dokkolt
  // sáv magasságát tartja alul (cardScroll/cardScrollContent).
  cardScroll: {
    flex: 1,
    width: '100%',
  },
  cardScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  // 5b: a szó-sor (szó + 🔊), a CardShell tetején.
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  frontRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  // 5b: a Learn frontText méretét vette át (32/bold), hogy a két fül kártyája
  // azonos súlyú szót mutasson.
  frontText: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 16,
  },
  sectionText: {
    fontSize: 12,
    textAlign: 'center',
  },
  // 5c: szófaj-chip (noun/verb/phrase) a szekció-szöveg mellett.
  posChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  posChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  speakBtn: {
    padding: 4,
    flexShrink: 0,
  },
  speakIcon: {
    fontSize: 22,
  },
  articleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  articleChip: {
    minWidth: 48,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  articleChipText: {
    fontSize: 16,
    fontWeight: '600',
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
    flex: 1,
    flexShrink: 1,
    fontSize: 22,
    fontWeight: '600',
  },
  // s2 (anki-ui-terv.html): "Missing accent, counted as correct" sor.
  accentNote: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  // PLAN-play 11. lépés: példamondat a megoldás alatt, Check után.
  exampleRow: {
    marginTop: 12,
  },
  exampleEs: {
    flex: 1,
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  exampleEn: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
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
    color: '#FFFFFF',
  },
  gradePreview: {
    fontSize: 11,
    marginTop: 2,
    color: '#FFFFFF',
  },
});
