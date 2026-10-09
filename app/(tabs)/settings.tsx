import { useState, useCallback, type ReactNode } from 'react';
import { StyleSheet, View, Pressable, Alert, Platform, ScrollView, Modal } from 'react-native';
import { Text } from '@/components/KText';
import { useRouter, useFocusEffect } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import Colors from '@/constants/Colors';
import { legibleOn } from '@/constants/Skins';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { useSkin } from '@/lib/useSkin';
import { t, setLanguage, notifyLanguageChange } from '@/lib/i18n';
import { type Level } from '@/data/words';
import { getDb } from '@/lib/database';
import { setPcicTarget, pcicItemsForLevel, PCIC_LEVELS, type PcicTarget, type PcicLevel } from '@/data/pcic';
import { GRAMMAR_PROGRESS_KEY } from '@/lib/grammar/syllabus';
import { validateBackupPayload } from '@/lib/backup';
import { validateMistakesPayload } from '@/lib/mistakes/format';
import { seedExamState } from '@/lib/exam/devSeed';
import {
  DEFAULT_WEEKLY_GOAL_MINUTES,
  MIN_WEEKLY_GOAL_MINUTES,
  MAX_WEEKLY_GOAL_MINUTES,
  WEEKLY_GOAL_STEP_MINUTES,
  DEFAULT_DAILY_NEW_LIMIT,
  MIN_DAILY_NEW_LIMIT,
  MAX_DAILY_NEW_LIMIT,
  DAILY_NEW_LIMIT_STEP,
  localDateString,
} from '@/lib/usageStats';
import {
  DEFAULT_AGAIN_DELAY_SEC,
  MIN_AGAIN_DELAY_SEC,
  MAX_AGAIN_DELAY_SEC,
  AGAIN_DELAY_STEP_SEC,
} from '@/lib/pcicSession';
import FeedbackButton from '@/components/FeedbackModal';
import { BrutalBox, BrutalSwitch } from '@/components/grammar/Brutal';
import { SkinBackdrop } from '@/components/skins/Slots';
import ThemeSwatch from '@/components/skins/ThemeSwatch';
// version line in Settings, the same tag the feedback rows carry.
import { appBuildTag } from '@/lib/appBuild';
import { loadVoices, hasVoiceFor } from '@/lib/speech';
import { languages } from '@/lib/languages';
import { clearLearnResume } from '@/lib/learnResume';

const appVersionLabel = appBuildTag();

// a nullázható paklik (a szintek, amiken van
// haladás) és az, hogy van-e nyelvtan-haladás. Az aktív irány szavai számítanak.
async function loadResettable(): Promise<{ levels: PcicLevel[]; grammar: boolean }> {
  const db = getDb();
  const onboarding = await db.getOnboarding();
  if (onboarding) setPcicTarget(onboarding.target as PcicTarget);
  const [cards, grammarRows] = await Promise.all([db.getPcicCards(), db.getGameProgress(GRAMMAR_PROGRESS_KEY)]);
  const ids = new Set(cards.map((c) => c.itemId));
  return {
    levels: PCIC_LEVELS.filter((lvl) => pcicItemsForLevel(lvl).some((i) => ids.has(i.id))),
    grammar: grammarRows.length > 0,
  };
}

// a beállítás-sor: brutalista palettán BrutalBox, classic palettán a mai kártya-sor.
function Row({ onPress, children }: { onPress?: () => void; children: ReactNode }) {
  const g = useGrammarColors();
  if (g.brutal) {
    return (
      <BrutalBox testID="settings-row" onPress={onPress} style={styles.brutalRowOuter} boxStyle={styles.brutalRow}>
        {children}
      </BrutalBox>
    );
  }
  const style = [styles.wordsOnlyRow, { backgroundColor: g.paper }];
  return onPress ? (
    <Pressable style={style} onPress={onPress}>
      {children}
    </Pressable>
  ) : (
    <View style={style}>{children}</View>
  );
}

// A −/+ léptető gomb (brutalista palettán doboz).
function StepBtn({ label, onPress }: { label: string; onPress: () => void }) {
  const g = useGrammarColors();
  if (g.brutal) {
    return (
      <BrutalBox offset={2} onPress={onPress} style={styles.brutalStepOuter} boxStyle={styles.brutalStep}>
        <Text style={[styles.goalBtnText, { color: g.ink }]}>{label}</Text>
      </BrutalBox>
    );
  }
  return (
    <Pressable style={[styles.goalBtn, { borderColor: g.a }]} onPress={onPress}>
      <Text style={[styles.goalBtnText, { color: g.a }]}>{label}</Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { theme } = useTheme();
  // az aktív téma a Témák-sorban (név + minta).
  const { id: skinId, skin: activeSkin, mode } = useSkin();
  // 7F/G2: a léptető sorokban a címke ennél keskenyebbre nem szorulhat, előbb a léptető törik a címke alá
  // (egyedi test-betűs / nagyított / betűközös témán 112, a mai Neo-brutál és Klasszikus kinézetén 64: ott ez nem tör).
  const wideText = !!activeSkin.fonts.body || activeSkin.fontScale > 1 || activeSkin.spacingScope === 'all';
  const stepLabel = { minWidth: wideText ? 112 : 64 };
  const colors = Colors[theme];
  const arrowColor = legibleOn(colors.tint, colors.card, 3);
  const g = useGrammarColors();
  const s = t();
  const router = useRouter();
  const [level, setLevel] = useState<Level>('A0');
  const [direction, setDirection] = useState<[string, string]>(['en', 'es']);
  // a tanulási irány váltó sora és a
  // hozzá tartozó kis lap.
  const [directionSheetOpen, setDirectionSheetOpen] = useState(false);
  // weekly study goal in minutes (UI shows whole hours).
  const [weeklyGoal, setWeeklyGoal] = useState(DEFAULT_WEEKLY_GOAL_MINUTES);
  // daily budget of brand-new words entering the queue.
  const [dailyNewLimit, setDailyNewLimit] = useState(DEFAULT_DAILY_NEW_LIMIT);
  // a PCIC "again" kártya visszatérési ideje.
  const [againDelaySec, setAgainDelaySec] = useState(DEFAULT_AGAIN_DELAY_SEC);
  // difficulty switches. Accents are the first one: off = the beginner
  // grader forgives a missing á/é/ñ, on = it counts as a mistake.
  const [strictAccents, setStrictAccents] = useState(false);
  // névelő-gombsor a gépelős spanyol főnév-kártyán. Alapból be, mert
  // a fejlesztő kérte; a kapcsoló a visszaút, ha kipróbálva mégsem válik be.
  const [articlePicker, setArticlePicker] = useState(true);
  // User feedback: "legyen egy szöveg ami gratulál, hogy elértem a
  // heti limitet ami a cél, valami hatalmas nagy. és a célnál írja is ki hogy
  // kész zölddel". The goal stepper never said whether the goal was met, so the
  // rolling 7-day total is read here too.
  const [weekMinutes, setWeekMinutes] = useState(0);
  // languages of this course the phone has no TTS voice for. Without the
  // hint the learner only hears a wrong-language reading (or now, silence) and
  // has no idea it is a missing system voice, not the app.
  const [missingVoices, setMissingVoices] = useState<string[]>([]);
  // a nullázó sorok: egy pakli-sor minden szintre, amin van
  // haladás, és egy nyelvtan-sor, ha van nyelvtan-haladás.
  const [resetLevels, setResetLevels] = useState<PcicLevel[]>([]);
  const [hasGrammarProgress, setHasGrammarProgress] = useState(false);
  // a nullázó sorok egy lenyíló szekcióban, alapból zárva.
  const [resetOpen, setResetOpen] = useState(false);
  // a __DEV__-only vizsga-vezérlő állapota (lásd lent).
  const [examSeeded, setExamSeeded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const db = getDb();
      db.getStrictAccents().then(setStrictAccents);
      db.getWeeklyGoalMinutes().then(setWeeklyGoal);
      db.getUsageStats().then(u => setWeekMinutes(u.thisWeek));
      db.getDailyNewLimit().then(setDailyNewLimit);
      db.getAgainDelaySec().then(setAgainDelaySec);
      db.getOnboarding().then(async o => {
        if (!o) return;
        setDirection([o.source, o.target]);
        await loadVoices();
        setMissingVoices([o.source, o.target].filter(code => !hasVoiceFor(code)));
      });
      db.getLevel().then(l => setLevel(l.level as Level));
      db.getArticlePicker().then(setArticlePicker);
      loadResettable().then(({ levels, grammar }) => {
        setResetLevels(levels);
        setHasGrammarProgress(grammar);
      });
    }, [])
  );

  // the Learn screen reads the flag when it builds a queue.
  const handleStrictAccentsToggle = async (v: boolean) => {
    setStrictAccents(v);
    await getDb().setStrictAccents(v);
  };

  // ugyanaz a betöltési pont, mint a többi tanulási beállításnál.
  const handleArticlePickerToggle = async (v: boolean) => {
    setArticlePicker(v);
    await getDb().setArticlePicker(v);
  };

  // Irányváltás:
  // nincs megerősítő kérdés, mert visszaváltható és a haladás nem vész el (a
  // két irány külön id-térrel/pair-rel és külön pár-szintű szinttel él,
  // lib/database.ts getPcicLevel/hasPcicLevel). Ha az új irányban még nincs
  // kifejezetten választott szint, a főfül (app/(tabs)/index.tsx load())
  // magától felnyitja a szint-választó lapot, itt nem kell külön kezelni.
  const handleSelectDirection = async (source: 'en' | 'es', target: PcicTarget) => {
    setDirectionSheetOpen(false);
    if (source === direction[0] && target === direction[1]) return;
    const db = getDb();
    await db.setOnboarding(source, target);
    setLanguage(source);
    // Csak itt, egy VÉGLEGESÍTETT váltásnál kell a teljes fa remountja (a
    // tab-fülek felirata is), az onboarding próba-váltása ezt nem hívja.
    notifyLanguageChange();
    setPcicTarget(target);
    setDirection([source, target]);
    router.replace('/(tabs)');
  };

  // the language's own name for the hint ("Magyar"), not its code.
  const voiceName = (code: string) => languages.find(l => l.code === code)?.name ?? code;

  // reached is "this rolling week's minutes are at or over the goal",
  // the same rule the Stats tab's goal card uses (lib/usageStats.ts).
  const goalReached = weeklyGoal > 0 && weekMinutes >= weeklyGoal;

  // ± one hour per tap, clamped to the 1..35 h/week range.
  const handleWeeklyGoalChange = async (deltaMinutes: number) => {
    const next = Math.min(
      MAX_WEEKLY_GOAL_MINUTES,
      Math.max(MIN_WEEKLY_GOAL_MINUTES, weeklyGoal + deltaMinutes)
    );
    if (next === weeklyGoal) return;
    setWeeklyGoal(next);
    await getDb().setWeeklyGoalMinutes(next);
  };

  // ± five new words per tap, clamped to the 5..100 a day range.
  const handleDailyNewLimitChange = async (delta: number) => {
    const next = Math.min(
      MAX_DAILY_NEW_LIMIT,
      Math.max(MIN_DAILY_NEW_LIMIT, dailyNewLimit + delta)
    );
    if (next === dailyNewLimit) return;
    setDailyNewLimit(next);
    await getDb().setDailyNewLimit(next);
  };

  // ± 15 s per tap, clamped to the 15..300 s range.
  const handleAgainDelayChange = async (delta: number) => {
    const next = Math.min(
      MAX_AGAIN_DELAY_SEC,
      Math.max(MIN_AGAIN_DELAY_SEC, againDelaySec + delta)
    );
    if (next === againDelaySec) return;
    setAgainDelaySec(next);
    await getDb().setAgainDelaySec(next);
  };

  // RN-web Alert is a no-op, so web falls back to the browser dialogs.
  const notify = (title: string, message?: string) => {
    if (Platform.OS === 'web') window.alert(message ? `${title}\n${message}` : title);
    else Alert.alert(title, message);
  };

  // Q0: export the whole learning state to a JSON file. Native hands it to the
  // Android/iOS share sheet (user saves it to Drive, email, anywhere); web
  // downloads it as a file.
  const handleBackup = async () => {
    try {
      const payload = await getDb().exportAll();
      const json = JSON.stringify(payload);
      const name = `kimacha-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
      const file = new File(Paths.cache, name);
      file.create();
      file.write(json);
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: s.backup.backup });
    } catch {
      notify(s.backup.errorTitle, s.backup.exportError);
    }
  };

  // Q0: pick a backup JSON, validate it, then (after an explicit confirm,
  // this overwrites all progress) import it in one transaction and reload.
  const handleRestore = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      const json = Platform.OS === 'web' && asset.file
        ? await asset.file.text()
        : await new File(asset.uri).text();
      const payload = validateBackupPayload(JSON.parse(json));
      const doImport = async () => {
        try {
          await getDb().importAll(payload);
          notify(s.backup.doneTitle);
          router.navigate('/');
        } catch {
          notify(s.backup.errorTitle, s.backup.importError);
        }
      };
      if (Platform.OS === 'web') {
        if (window.confirm(`${s.backup.confirmTitle}\n${s.backup.confirmMessage}`)) await doImport();
      } else {
        Alert.alert(s.backup.confirmTitle, s.backup.confirmMessage, [
          { text: s.feedback.cancel, style: 'cancel' },
          { text: s.backup.confirmYes, style: 'destructive', onPress: doImport },
        ]);
      }
    } catch {
      notify(s.backup.errorTitle, s.backup.importError);
    }
  };

  // a Learn fejlécéből ide költözött haladás-nullázás,
  // paklinként (szintenként) és a nyelvtanra külön; mind megerősítéssel. A Learn és a
  // Kurzus fül fókuszra újratölt, a sorok itt azonnal frissülnek.
  const confirmReset = (title: string, message: string, doReset: () => Promise<void>) => {
    const run = async () => {
      await doReset();
      const r = await loadResettable();
      setResetLevels(r.levels);
      setHasGrammarProgress(r.grammar);
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n${message}`)) run();
    } else {
      Alert.alert(title, message, [
        { text: s.feedback.cancel, style: 'cancel' },
        { text: s.pcic.resetConfirmYes, style: 'destructive', onPress: run },
      ]);
    }
  };
  const handleResetDeck = (lvl: PcicLevel) =>
    confirmReset(s.pcic.resetConfirmTitle, s.pcic.resetConfirmLevel(lvl), async () => {
      await getDb().resetPcicCards(lvl.toLowerCase());
      // a mentett Learn-kör pillanatképe a nullázott haladásra már nem érvényes.
      await clearLearnResume(getDb());
    });
  const handleResetGrammar = () =>
    confirmReset(s.settings.resetGrammarTitle, s.settings.resetGrammarMessage, () => getDb().resetGameProgress(GRAMMAR_PROGRESS_KEY));

  // 2. és csak __DEV__-ben látszó sor; beállítja a vizsga
  // állapotát (A1-B2: a szint kártyáinak 85%-a graduált + a megírt leckék készek), hogy a vizsga végigkattintható legyen.
  const handleSeedExamA1 = async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const target = (onboarding?.target as PcicTarget | undefined) ?? 'es';
    setPcicTarget(target);
    await seedExamState(db, target, localDateString());
    setExamSeeded(true);
  };

  // pick a kimacha-hibaim JSON (the /hibaim skill's
  // output), validate it with the app's own rules (lib/mistakes/format.ts),
  // save it (loading the same batchId again replaces its content, card
  // progress survives) and open the report.
  const handleLoadMistakes = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      const json = Platform.OS === 'web' && asset.file
        ? await asset.file.text()
        : await new File(asset.uri).text();
      const result = validateMistakesPayload(JSON.parse(json));
      if (!result.ok) {
        notify(s.backup.errorTitle, result.error);
        return;
      }
      const { batch } = result;
      await getDb().saveMistakeBatch(batch.batchId, JSON.stringify(batch), new Date().toISOString());
      const drillCount = batch.patterns.reduce((n, p) => n + p.drills.length, 0);
      notify(s.mistakes.loaded(batch.sentences.length, batch.words.length, drillCount));
      router.navigate('/mistakes');
    } catch {
      notify(s.backup.errorTitle, s.backup.importError);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SkinBackdrop />
      {/* the page grew past one screen (the version line at its bottom was
          unreachable), so the settings list scrolls. The modal and the feedback
          FAB stay outside, pinned to the screen. */}
      <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.sectionTitle, { color: colors.text }, g.brutal && styles.brutalTitle]}>{s.tabs.settings}</Text>

      <Text style={[styles.sectionHint, { color: colors.textMuted, marginBottom: 8 }]}>{s.settings.themes.title}</Text>
      <Row onPress={() => router.push('/themes')}>
        <View testID="settings-theme-row" style={styles.themeRow}>
          <ThemeSwatch skin={activeSkin} mode={mode} small />
          <Text style={[styles.optionText, { color: g.ink }]}>{s.skins.names[skinId]}</Text>
          <Text style={[styles.themeChevron, { color: g.ink }]}>›</Text>
        </View>
      </Row>

      {/* a course language with no installed voice, named so the fix
          (install it in the phone's text-to-speech settings) is obvious. */}
      {missingVoices.length > 0 && (
        <Row>
          <Text style={[styles.missingVoiceText, { color: legibleOn('#EAB308', colors.card) }]}>
            {s.settings.missingVoice(missingVoices.map(voiceName).join(', '))}
          </Text>
        </Row>
      )}

      {/* the "weekly goal reached" card is gone (felesleges);
          the reached state stays as the green tag on the goal row below. */}
      {/* weekly study goal in whole hours, shown on the Stats tab. */}
      <Row>
        <Text style={[styles.wordsOnlyLabel, { color: colors.text }, stepLabel]}>{s.settings.weeklyGoal}</Text>
        <View style={styles.goalStepper}>
          <StepBtn label="−" onPress={() => handleWeeklyGoalChange(-WEEKLY_GOAL_STEP_MINUTES)} />
          <Text style={[styles.goalValue, { color: goalReached ? '#22C55E' : colors.text }]}>
            {s.settings.weeklyGoalHours(String(Math.round(weeklyGoal / 60)))}
            {goalReached ? ` ${s.settings.weeklyGoalDoneTag}` : ''}
          </Text>
          <StepBtn label="+" onPress={() => handleWeeklyGoalChange(WEEKLY_GOAL_STEP_MINUTES)} />
        </View>
      </Row>

      {/* how many brand-new words a day may enter the learning queue. */}
      <Row>
        <Text style={[styles.wordsOnlyLabel, { color: colors.text }, stepLabel]}>{s.settings.dailyNewLimit}</Text>
        <View style={styles.goalStepper}>
          <StepBtn label="−" onPress={() => handleDailyNewLimitChange(-DAILY_NEW_LIMIT_STEP)} />
          <Text style={[styles.goalValue, { color: colors.text }]}>
            {s.settings.dailyNewLimitWords(String(dailyNewLimit))}
          </Text>
          <StepBtn label="+" onPress={() => handleDailyNewLimitChange(DAILY_NEW_LIMIT_STEP)} />
        </View>
      </Row>

      {/* a PCIC "again" kártya visszatérési
          ideje; ugyanezt olvassa a nyelvtani táblázat-pakli cooldownja is. */}
      <Row>
        <Text style={[styles.wordsOnlyLabel, { color: colors.text }, stepLabel]}>{s.settings.missedWordDelay}</Text>
        <View style={styles.goalStepper}>
          <StepBtn label="−" onPress={() => handleAgainDelayChange(-AGAIN_DELAY_STEP_SEC)} />
          <Text style={[styles.goalValue, { color: colors.text }]}>
            {s.settings.missedWordDelaySeconds(String(againDelaySec))}
          </Text>
          <StepBtn label="+" onPress={() => handleAgainDelayChange(AGAIN_DELAY_STEP_SEC)} />
        </View>
      </Row>

      {/* accent strictness, standalone toggle (the
          dial that used to wrap it, P/R kézben-lévő-szó ablak, is gone). */}
      <Row>
        <View style={styles.difficultyLabelBox}>
          <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.strictAccents}</Text>
          <Text style={[styles.sectionHint, { color: colors.tabIconDefault }]}>{s.settings.strictAccentsHint}</Text>
        </View>
        <BrutalSwitch testID="settings-strict-accents" value={strictAccents} onValueChange={handleStrictAccentsToggle} />
      </Row>

      {/* névelő-gombsor a gépelős spanyol főnév-kártyákon.
          Csak spanyol
          célnyelvnél él (index.tsx-ben is target==='es'-nél jár a gombsor). */}
      {direction[1] === 'es' && (
        <Row>
          <View style={styles.difficultyLabelBox}>
            <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.articlePicker}</Text>
            <Text style={[styles.sectionHint, { color: colors.tabIconDefault }]}>{s.settings.articlePickerHint}</Text>
          </View>
          <BrutalSwitch testID="settings-article-picker" value={articlePicker} onValueChange={handleArticlePickerToggle} />
        </Row>
      )}

      {/* tanulási irány váltó sora. */}
      <Row onPress={() => setDirectionSheetOpen(true)}>
        <View style={styles.difficultyLabelBox}>
          <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.learningDirection}</Text>
          <Text style={[styles.sectionHint, { color: colors.tabIconDefault }]}>
            {direction[0] === 'en' ? s.settings.directionEnEs : s.settings.directionEsEn}
          </Text>
        </View>
        <Text style={[styles.rowArrow, { color: arrowColor }]}>→</Text>
      </Row>

      {/* Q0: backup (export + share) and restore (pick file + confirm + import). */}
      <Row onPress={handleBackup}>
        <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>💾 {s.backup.backup}</Text>
        <Text style={[styles.rowArrow, { color: arrowColor }]}>→</Text>
      </Row>

      <Row onPress={handleRestore}>
        <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>♻️ {s.backup.restore}</Text>
        <Text style={[styles.rowArrow, { color: arrowColor }]}>→</Text>
      </Row>

      {/* import a "Hibáim" kötegből (Drive JSON). */}
      <Row onPress={handleLoadMistakes}>
        <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.mistakes.load}</Text>
        <Text style={[styles.rowArrow, { color: arrowColor }]}>→</Text>
      </Row>

      {/* haladás-nullázás megerősítéssel, paklinként és a nyelvtanra. */}
      {(resetLevels.length > 0 || hasGrammarProgress) && (
        <Row onPress={() => setResetOpen((o) => !o)}>
          <Text testID="settings-reset-section" style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.resetSection}</Text>
          <Text style={[styles.rowArrow, { color: arrowColor }]}>{resetOpen ? '▾' : '▸'}</Text>
        </Row>
      )}
      {resetOpen && (
        <>
          {resetLevels.map((lvl) => (
            <Row key={lvl} onPress={() => handleResetDeck(lvl)}>
              <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.pcic.resetRow(lvl)}</Text>
              <Text style={[styles.rowArrow, { color: arrowColor }]}>→</Text>
            </Row>
          ))}
          {hasGrammarProgress && (
            <Row onPress={handleResetGrammar}>
              <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.resetGrammar}</Text>
              <Text style={[styles.rowArrow, { color: arrowColor }]}>→</Text>
            </Row>
          )}
        </>
      )}

      {/* word-data attribution screen entry point. */}
      <Row onPress={() => router.push('/credits')}>
        <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.credits}</Text>
        <Text style={[styles.rowArrow, { color: arrowColor }]}>→</Text>
      </Row>

      {/* app version, small and grey, so the user can tell which build runs. */}
      <Text style={[styles.versionText, { color: colors.tabIconDefault }]}>{appVersionLabel}</Text>

      {/* fejlesztői vezérlő, release-buildben (`__DEV__ === false`) nem renderelődik. */}
      {__DEV__ && (
        <Row onPress={handleSeedExamA1}>
          <Text testID="dev-seed-exam" style={[styles.wordsOnlyLabel, { color: colors.text }]}>
            {examSeeded ? s.settings.devSeedExamA1Done : s.settings.devSeedExamA1}
          </Text>
          <Text style={[styles.rowArrow, { color: colors.tint }]}>→</Text>
        </Row>
      )}
      </ScrollView>

      <FeedbackButton level={level} languagePair={direction.join('→')} currentCard="settings-tab" />

      {/* kis lap a két iránnyal, az
          aktuális pipával, a LevelPickerSheet mintájára (components/LevelPickerSheet.tsx). */}
      <Modal visible={directionSheetOpen} transparent animationType="slide" onRequestClose={() => setDirectionSheetOpen(false)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setDirectionSheetOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.card }, g.brutal && [styles.brutalSheet, { borderColor: g.ink }]]} onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: colors.text }, g.brutal && styles.brutalTitle]}>{s.settings.chooseDirection}</Text>
            {(
              [
                ['en', 'es'],
                ['es', 'en'],
              ] as const
            ).map(([src, tgt]) => {
              const active = direction[0] === src && direction[1] === tgt;
              if (g.brutal) {
                return (
                  <BrutalBox
                    key={src}
                    fill={active ? 'a' : 'paper'}
                    style={styles.brutalSheetOptionOuter}
                    boxStyle={styles.brutalSheetOption}
                    onPress={() => handleSelectDirection(src, tgt)}
                  >
                    <Text style={[styles.sheetOptionText, styles.brutalOptionText, { color: active ? g.onFill : g.ink }]}>
                      {src === 'en' ? s.settings.directionEnEs : s.settings.directionEsEn}
                    </Text>
                    {active && <Text style={[styles.sheetOptionText, { color: g.onFill }]}>✓</Text>}
                  </BrutalBox>
                );
              }
              return (
                <Pressable
                  key={src}
                  style={[styles.sheetOption, { backgroundColor: active ? colors.tint : colors.background }]}
                  onPress={() => handleSelectDirection(src, tgt)}
                >
                  <Text style={[styles.sheetOptionText, { color: active ? colors.onTint : colors.text }]}>
                    {src === 'en' ? s.settings.directionEnEs : s.settings.directionEsEn}
                  </Text>
                  {active && <Text style={[styles.sheetOptionText, { color: colors.onTint }]}>✓</Text>}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    padding: 24,
    paddingTop: 40,
    // room under the last row so the FAB never covers it (96 → 120,
    // a hosszabb lista utolsó sora is a 💬 fölé görgethető)
    paddingBottom: 120,
  },
  versionText: {
    marginTop: 12,
    fontSize: 12,
    textAlign: 'center',
  },
  // az irányváltó kis lapja, a
  // components/LevelPickerSheet.tsx overlay/sheet stílusának mintájára.
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 10,
  },
  sheetOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // brutalista formák.
  brutalTitle: { textTransform: 'uppercase', fontWeight: '500' },
  brutalRowOuter: { marginTop: 12 },
  // 7F/G2: flexWrap + rowGap: ha a széles betűjű téma a léptetőt túl szélesre hizza, az a címke alá törik.
  brutalRow: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14 },
  brutalStepOuter: { width: 38 },
  brutalStep: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  brutalOptionText: { fontWeight: '500', textTransform: 'uppercase' },
  brutalSheet: { borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTopWidth: 2.5 },
  brutalSheetOptionOuter: { marginBottom: 10 },
  brutalSheetOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // a Témák-sor tartalma (minta + név + nyíl).
  themeRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  themeChevron: { marginLeft: 'auto', fontSize: 22, fontWeight: '700' },
  sectionHint: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    // 7F/G2: a kapcsolótól / nyíltól a hint se érjen hozzá (a címke saját marginRight-ja a hintre nem vonatkozik).
    marginRight: 12,
  },
  // The label inside already carries the right margin (see wordsOnlyLabel).
  difficultyLabelBox: {
    flex: 1,
  },
  wordsOnlyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginTop: 12,
  },
  wordsOnlyLabel: {
    fontSize: 16,
    fontWeight: '600',
    // Spanish labels ("Objetivo semanal de estudio") are long enough to
    // push the switch/stepper out of the card, RN text does not shrink on its own.
    flex: 1,
    marginRight: 12,
  },
  // a "→" a sor jobb szélén ül, a szöveg kapja a maradék szélességet.
  rowArrow: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 0,
  },
  // −/+ stepper for the weekly goal row.
  missingVoiceText: { fontSize: 13, lineHeight: 18, flex: 1 },
  goalStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
    maxWidth: '100%',
    marginLeft: 'auto',
  },
  goalBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalBtnText: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  goalValue: {
    fontSize: 15,
    fontWeight: '600',
    minWidth: 96,
    flexShrink: 1,
    textAlign: 'center',
  },
});
