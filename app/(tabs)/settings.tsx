import { useState, useCallback } from 'react';
import { StyleSheet, Text, View, Pressable, Modal, Alert, Switch, Platform, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { LEVELS, type Level, getWordsForLevel } from '@/data/words';
import { setPendingAction } from '@/lib/pendingAction';
import { getDb } from '@/lib/database';
import { validateBackupPayload } from '@/lib/backup';
import {
  DEFAULT_WEEKLY_GOAL_MINUTES,
  MIN_WEEKLY_GOAL_MINUTES,
  MAX_WEEKLY_GOAL_MINUTES,
  WEEKLY_GOAL_STEP_MINUTES,
  DEFAULT_DAILY_NEW_LIMIT,
  MIN_DAILY_NEW_LIMIT,
  MAX_DAILY_NEW_LIMIT,
  DAILY_NEW_LIMIT_STEP,
} from '@/lib/usageStats';
import FeedbackButton from '@/components/FeedbackModal';
// FB82: version line in Settings, the same tag the feedback rows carry.
import { appBuildTag } from '@/lib/appBuild';
import { loadVoices, hasVoiceFor } from '@/lib/speech';
import { languages } from '@/lib/languages';

const appVersionLabel = appBuildTag();

export default function SettingsScreen() {
  const { theme, override, setOverride } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();
  const [masterVisible, setMasterVisible] = useState(false);
  const [wordsOnly, setWordsOnly] = useState(false);
  const [randomTopics, setRandomTopics] = useState(false);
  // null until the DB says which course this is: defaulting to Spanish made the
  // level picker show the Spanish word counts for a second or two after a cold
  // start, so an es→hu learner saw 881 A1 words instead of 480.
  const [target, setTarget] = useState<string | null>(null);
  const [level, setLevel] = useState<Level>('A0');
  const [direction, setDirection] = useState<[string, string]>(['es', 'hu']);
  // FB39: due count for the "Spelling Practice (N)" settings row, refreshed
  // every time Settings gains focus (e.g. after adding words on the Learn tab).
  const [spellingDue, setSpellingDue] = useState(0);
  // FB65: weekly study goal in minutes (UI shows whole hours).
  const [weeklyGoal, setWeeklyGoal] = useState(DEFAULT_WEEKLY_GOAL_MINUTES);
  // FB77: daily budget of brand-new words entering the queue.
  const [dailyNewLimit, setDailyNewLimit] = useState(DEFAULT_DAILY_NEW_LIMIT);
  // FB132: difficulty switches. Accents are the first one: off = the beginner
  // grader forgives a missing á/é/ñ, on = it counts as a mistake.
  const [strictAccents, setStrictAccents] = useState(false);
  // FB147, Kálmán 2026-08-18: "legyen egy szöveg ami gratulál, hogy elértem a
  // heti limitet ami a cél, valami hatalmas nagy. és a célnál írja is ki hogy
  // kész zölddel". The goal stepper never said whether the goal was met, so the
  // rolling 7-day total is read here too.
  const [weekMinutes, setWeekMinutes] = useState(0);
  // FB144: languages of this course the phone has no TTS voice for. Without the
  // hint the learner only hears a wrong-language reading (or now, silence) and
  // has no idea it is a missing system voice, not the app.
  const [missingVoices, setMissingVoices] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      const db = getDb();
      db.getWordsOnly().then(setWordsOnly);
      db.getRandomTopics().then(setRandomTopics);
      db.getStrictAccents().then(setStrictAccents);
      db.getWeeklyGoalMinutes().then(setWeeklyGoal);
      db.getUsageStats().then(u => setWeekMinutes(u.thisWeek));
      db.getDailyNewLimit().then(setDailyNewLimit);
      db.getOnboarding().then(async o => {
        if (!o) return;
        setTarget(o.target);
        setDirection([o.source, o.target]);
        await loadVoices();
        setMissingVoices([o.source, o.target].filter(code => !hasVoiceFor(code)));
      });
      db.getLevel().then(l => setLevel(l.level as Level));
      db.getSpellingDueCount().then(setSpellingDue);
    }, [])
  );

  const handleWordsOnlyToggle = async (v: boolean) => {
    setWordsOnly(v);
    await getDb().setWordsOnly(v);
    setPendingAction({ type: 'selectTopic' });
    router.push('/');
  };

  const handleRandomTopicsToggle = async (v: boolean) => {
    setRandomTopics(v);
    await getDb().setRandomTopics(v);
    setPendingAction({ type: 'selectTopic' });
    router.push('/');
  };

  // FB132: the Learn screen reads the flag when it builds a queue, so the same
  // reload action as the other learn settings makes the change take effect.
  const handleStrictAccentsToggle = async (v: boolean) => {
    setStrictAccents(v);
    await getDb().setStrictAccents(v);
    setPendingAction({ type: 'selectTopic' });
    router.push('/');
  };

  // FB144: the language's own name for the hint ("Magyar"), not its code.
  const voiceName = (code: string) => languages.find(l => l.code === code)?.name ?? code;

  // FB147: reached is "this rolling week's minutes are at or over the goal",
  // the same rule the Stats tab's goal card uses (lib/usageStats.ts).
  const goalReached = weeklyGoal > 0 && weekMinutes >= weeklyGoal;

  // FB65: ± one hour per tap, clamped to the 1..35 h/week range.
  const handleWeeklyGoalChange = async (deltaMinutes: number) => {
    const next = Math.min(
      MAX_WEEKLY_GOAL_MINUTES,
      Math.max(MIN_WEEKLY_GOAL_MINUTES, weeklyGoal + deltaMinutes)
    );
    if (next === weeklyGoal) return;
    setWeeklyGoal(next);
    await getDb().setWeeklyGoalMinutes(next);
  };

  // FB77: ± five new words per tap, clamped to the 5..100 a day range.
  const handleDailyNewLimitChange = async (delta: number) => {
    const next = Math.min(
      MAX_DAILY_NEW_LIMIT,
      Math.max(MIN_DAILY_NEW_LIMIT, dailyNewLimit + delta)
    );
    if (next === dailyNewLimit) return;
    setDailyNewLimit(next);
    await getDb().setDailyNewLimit(next);
    setPendingAction({ type: 'selectTopic' });
  };

  const themeOptions: { label: string; value: 'system' | 'light' | 'dark' }[] = [
    { label: '🔄 Auto', value: 'system' },
    { label: '☀️ Light', value: 'light' },
    { label: '🌙 Dark', value: 'dark' },
  ];

  // Direct level switch — no exam gate (Master = free movement).
  const handleLevelSwitch = (level: Level) => {
    setMasterVisible(false);
    setPendingAction({ type: 'setLevel', level });
    router.navigate('/');
  };

  // Start the chosen level's exam directly; passing it levels up as usual.
  const handleExamSelect = (level: Level) => {
    setMasterVisible(false);
    setPendingAction({ type: 'exam', examLevel: level });
    router.navigate('/');
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
          setPendingAction({ type: 'selectTopic' });
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

  const handleRestart = () => {
    setMasterVisible(false);
    Alert.alert(
      'Újrakezdés',
      'Biztos újra akarod kezdeni? Eltűnik az eddigi haladásod.',
      [
        { text: 'Nem', style: 'cancel' },
        {
          text: 'Igen',
          style: 'destructive',
          onPress: () => {
            setPendingAction({ type: 'restart' });
            router.navigate('/');
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* FB101: the page grew past one screen (the version line at its bottom was
          unreachable), so the settings list scrolls. The modal and the feedback
          FAB stay outside, pinned to the screen. */}
      <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{s.tabs.settings}</Text>

      <View style={styles.optionGroup}>
        {themeOptions.map(opt => (
          <Pressable
            key={opt.value}
            style={[
              styles.option,
              { backgroundColor: override === opt.value ? colors.tint : colors.card },
            ]}
            onPress={() => setOverride(opt.value)}
          >
            <Text style={[styles.optionText, { color: override === opt.value ? '#FFF' : colors.text }]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.masterBtn, { backgroundColor: colors.tint }]}
        onPress={() => setMasterVisible(true)}
      >
        <Text style={styles.masterBtnText}>🎓 {s.master.button}</Text>
      </Pressable>

      <Pressable
        style={[styles.masterBtn, { backgroundColor: '#1D4ED8', marginTop: 12 }]}
        onPress={() => router.replace('/onboarding')}
      >
        <Text style={styles.masterBtnText}>🌐 {s.settings.changeLanguage}</Text>
      </Pressable>

      <View style={[styles.wordsOnlyRow, { backgroundColor: colors.card }]}>
        <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.wordsOnly}</Text>
        <Switch value={wordsOnly} onValueChange={handleWordsOnlyToggle} trackColor={{ true: colors.tint }} />
      </View>

      <View style={[styles.wordsOnlyRow, { backgroundColor: colors.card }]}>
        <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.randomTopics}</Text>
        <Switch value={randomTopics} onValueChange={handleRandomTopicsToggle} trackColor={{ true: colors.tint }} />
      </View>

      {/* FB144: a course language with no installed voice, named so the fix
          (install it in the phone's text-to-speech settings) is obvious. */}
      {missingVoices.length > 0 && (
        <View style={[styles.wordsOnlyRow, { backgroundColor: colors.card }]}>
          <Text style={[styles.missingVoiceText, { color: '#EAB308' }]}>
            {s.settings.missingVoice(missingVoices.map(voiceName).join(', '))}
          </Text>
        </View>
      )}

      {/* FB147: the congratulation for a reached weekly goal, as big as the
          screen allows, right above the goal row it belongs to. */}
      {goalReached && (
        <View style={[styles.goalDoneCard, { backgroundColor: colors.card }]}>
          <Text style={styles.goalDoneEmoji}>🏆</Text>
          <Text style={styles.goalDoneTitle}>{s.settings.weeklyGoalDone}</Text>
          <Text style={[styles.goalDoneText, { color: colors.text }]}>
            {s.settings.weeklyGoalDoneText(String(Math.round(weekMinutes / 60)), String(Math.round(weeklyGoal / 60)))}
          </Text>
        </View>
      )}

      {/* FB65: weekly study goal in whole hours, shown on the Stats tab. */}
      <View style={[styles.wordsOnlyRow, { backgroundColor: colors.card }]}>
        <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.weeklyGoal}</Text>
        <View style={styles.goalStepper}>
          <Pressable
            style={[styles.goalBtn, { borderColor: colors.tint }]}
            onPress={() => handleWeeklyGoalChange(-WEEKLY_GOAL_STEP_MINUTES)}
          >
            <Text style={[styles.goalBtnText, { color: colors.tint }]}>−</Text>
          </Pressable>
          <Text style={[styles.goalValue, { color: goalReached ? '#22C55E' : colors.text }]}>
            {s.settings.weeklyGoalHours(String(Math.round(weeklyGoal / 60)))}
            {goalReached ? ` ${s.settings.weeklyGoalDoneTag}` : ''}
          </Text>
          <Pressable
            style={[styles.goalBtn, { borderColor: colors.tint }]}
            onPress={() => handleWeeklyGoalChange(WEEKLY_GOAL_STEP_MINUTES)}
          >
            <Text style={[styles.goalBtnText, { color: colors.tint }]}>+</Text>
          </Pressable>
        </View>
      </View>

      {/* FB77: how many brand-new words a day may enter the learning queue. */}
      <View style={[styles.wordsOnlyRow, { backgroundColor: colors.card }]}>
        <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.dailyNewLimit}</Text>
        <View style={styles.goalStepper}>
          <Pressable
            style={[styles.goalBtn, { borderColor: colors.tint }]}
            onPress={() => handleDailyNewLimitChange(-DAILY_NEW_LIMIT_STEP)}
          >
            <Text style={[styles.goalBtnText, { color: colors.tint }]}>−</Text>
          </Pressable>
          <Text style={[styles.goalValue, { color: colors.text }]}>
            {s.settings.dailyNewLimitWords(String(dailyNewLimit))}
          </Text>
          <Pressable
            style={[styles.goalBtn, { borderColor: colors.tint }]}
            onPress={() => handleDailyNewLimitChange(DAILY_NEW_LIMIT_STEP)}
          >
            <Text style={[styles.goalBtnText, { color: colors.tint }]}>+</Text>
          </Pressable>
        </View>
      </View>

      {/* FB132: difficulty switches, each one raises the bar on its own. Kept
          as a Settings section rather than a sixth tab (the tab bar is full,
          see FB100), but headed so it reads as its own place. */}
      <Text style={[styles.difficultyTitle, { color: colors.tabIconDefault }]}>{s.settings.difficulty}</Text>
      <View style={[styles.wordsOnlyRow, { backgroundColor: colors.card }]}>
        <View style={styles.difficultyLabelBox}>
          <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.strictAccents}</Text>
          <Text style={[styles.sectionHint, { color: colors.tabIconDefault }]}>{s.settings.strictAccentsHint}</Text>
        </View>
        <Switch value={strictAccents} onValueChange={handleStrictAccentsToggle} trackColor={{ true: colors.tint }} />
      </View>

      {/* FB39: entry point into the spelling-practice trainer screen. */}
      <Pressable
        style={[styles.wordsOnlyRow, { backgroundColor: colors.card }]}
        onPress={() => router.push('/spelling')}
      >
        <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.spellingPractice(spellingDue)}</Text>
        <Text style={[styles.wordsOnlyLabel, { color: colors.tint }]}>→</Text>
      </Pressable>

      {/* Q0: backup (export + share) and restore (pick file + confirm + import). */}
      <Pressable
        style={[styles.wordsOnlyRow, { backgroundColor: colors.card }]}
        onPress={handleBackup}
      >
        <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>💾 {s.backup.backup}</Text>
        <Text style={[styles.wordsOnlyLabel, { color: colors.tint }]}>→</Text>
      </Pressable>

      <Pressable
        style={[styles.wordsOnlyRow, { backgroundColor: colors.card }]}
        onPress={handleRestore}
      >
        <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>♻️ {s.backup.restore}</Text>
        <Text style={[styles.wordsOnlyLabel, { color: colors.tint }]}>→</Text>
      </Pressable>

      {/* FB82: app version, small and grey, so the user can tell which build runs. */}
      <Text style={[styles.versionText, { color: colors.tabIconDefault }]}>{appVersionLabel}</Text>
      </ScrollView>

      <Modal visible={masterVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{s.master.title}</Text>

            <Text style={[styles.sectionLabel, { color: colors.tabIconDefault }]}>{s.master.levels}</Text>
            <View style={styles.levelGrid}>
              {LEVELS.map(lvl => {
                const wordCount = target ? getWordsForLevel(lvl, target).length : null;
                return (
                  <Pressable
                    key={lvl}
                    style={[styles.levelOption, { backgroundColor: colors.tint }]}
                    onPress={() => handleLevelSwitch(lvl)}
                  >
                    <Text style={styles.levelOptionText}>{lvl}</Text>
                    <Text style={styles.levelWordCount}>{wordCount === null ? ' ' : s.master.wordCount(wordCount)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: colors.tabIconDefault }]}>{s.master.exams}</Text>
            <View style={styles.levelGrid}>
              {LEVELS.map(lvl => (
                <Pressable
                  key={lvl}
                  style={[styles.levelOption, styles.examOption]}
                  onPress={() => handleExamSelect(lvl)}
                >
                  <Text style={styles.levelOptionText}>🎓 {lvl}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.restartBtn} onPress={handleRestart}>
              <Text style={styles.restartText}>↺ {s.master.restart}</Text>
            </Pressable>
            <Pressable onPress={() => setMasterVisible(false)}>
              <Text style={[styles.cancelText, { color: colors.tabIconDefault }]}>{s.feedback.cancel}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <FeedbackButton level={level} languagePair={direction.join('→')} currentCard="settings-tab" />
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
    // room under the last row so the FAB never covers it
    paddingBottom: 96,
  },
  versionText: {
    marginTop: 12,
    fontSize: 12,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
  },
  optionGroup: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  option: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  masterBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  masterBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 20,
  },
  levelOption: {
    width: 90,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  levelOptionText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  levelWordCount: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  examOption: {
    backgroundColor: '#1D4ED8',
    paddingVertical: 10,
  },
  restartBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  restartText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
  },
  // FB132: section heading above the difficulty switches (sectionTitle above is
  // the screen title, this one is a small caps sub-heading).
  difficultyTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 24,
    marginLeft: 4,
  },
  sectionHint: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  // The label inside already carries the right margin (see wordsOnlyLabel).
  difficultyLabelBox: {
    flex: 1,
  },
  wordsOnlyRow: {
    flexDirection: 'row',
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
    // FB128: Spanish labels ("Objetivo semanal de estudio") are long enough to
    // push the switch/stepper out of the card, RN text does not shrink on its own.
    flex: 1,
    marginRight: 12,
  },
  // FB65: −/+ stepper for the weekly goal row.
  // FB147: the reached-goal congratulation, deliberately the biggest block on
  // the Settings screen.
  missingVoiceText: { fontSize: 13, lineHeight: 18, flex: 1 },
  goalDoneCard: { borderRadius: 16, padding: 20, marginBottom: 12, alignItems: 'center', gap: 6 },
  goalDoneEmoji: { fontSize: 56 },
  goalDoneTitle: { fontSize: 26, fontWeight: '800', color: '#22C55E', textAlign: 'center' },
  goalDoneText: { fontSize: 14, textAlign: 'center' },
  goalStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
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
    textAlign: 'center',
  },
});
