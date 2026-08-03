import { useState, useCallback } from 'react';
import { StyleSheet, Text, View, Pressable, Modal, Alert, Switch, Platform } from 'react-native';
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
import Constants from 'expo-constants';

// FB82: version line in Settings. expoConfig carries app.json's version and the
// Android versionCode, so no separate constant can drift out of sync.
const appVersionLabel = `v${Constants.expoConfig?.version ?? '?'}` +
  (Constants.expoConfig?.android?.versionCode != null
    ? ` (${Constants.expoConfig.android.versionCode})`
    : '');

export default function SettingsScreen() {
  const { theme, override, setOverride } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();
  const [masterVisible, setMasterVisible] = useState(false);
  const [wordsOnly, setWordsOnly] = useState(false);
  const [randomTopics, setRandomTopics] = useState(false);
  const [target, setTarget] = useState('es');
  const [level, setLevel] = useState<Level>('A0');
  const [direction, setDirection] = useState<[string, string]>(['es', 'hu']);
  // FB39: due count for the "Spelling Practice (N)" settings row, refreshed
  // every time Settings gains focus (e.g. after adding words on the Learn tab).
  const [spellingDue, setSpellingDue] = useState(0);
  // FB65: weekly study goal in minutes (UI shows whole hours).
  const [weeklyGoal, setWeeklyGoal] = useState(DEFAULT_WEEKLY_GOAL_MINUTES);
  // FB77: daily budget of brand-new words entering the queue.
  const [dailyNewLimit, setDailyNewLimit] = useState(DEFAULT_DAILY_NEW_LIMIT);

  useFocusEffect(
    useCallback(() => {
      const db = getDb();
      db.getWordsOnly().then(setWordsOnly);
      db.getRandomTopics().then(setRandomTopics);
      db.getWeeklyGoalMinutes().then(setWeeklyGoal);
      db.getDailyNewLimit().then(setDailyNewLimit);
      db.getOnboarding().then(o => { if (o) { setTarget(o.target); setDirection([o.source, o.target]); } });
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
          <Text style={[styles.goalValue, { color: colors.text }]}>
            {s.settings.weeklyGoalHours(String(Math.round(weeklyGoal / 60)))}
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

      <Modal visible={masterVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{s.master.title}</Text>

            <Text style={[styles.sectionLabel, { color: colors.tabIconDefault }]}>{s.master.levels}</Text>
            <View style={styles.levelGrid}>
              {LEVELS.map(lvl => {
                const wordCount = getWordsForLevel(lvl, target).length;
                return (
                  <Pressable
                    key={lvl}
                    style={[styles.levelOption, { backgroundColor: colors.tint }]}
                    onPress={() => handleLevelSwitch(lvl)}
                  >
                    <Text style={styles.levelOptionText}>{lvl}</Text>
                    <Text style={styles.levelWordCount}>{s.master.wordCount(wordCount)}</Text>
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
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 40,
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
  },
  // FB65: −/+ stepper for the weekly goal row.
  goalStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
