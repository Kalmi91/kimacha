import { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { t, setLanguage, notifyLanguageChange } from '@/lib/i18n';
import { type Level } from '@/data/words';
import { getDb } from '@/lib/database';
import { pcicItemsForLevel, PCIC_LEVELS, type PcicTarget, type PcicLevel } from '@/data/pcic';
import { useLearner, type LearnerActions } from '@/lib/learner';
import { GRAMMAR_PROGRESS_KEY } from '@/lib/grammar/syllabus';
import { validateBackupPayload } from '@/lib/backup';
import { validateMistakesPayload } from '@/lib/mistakes/format';
import { seedExamState } from '@/lib/exam/devSeed';
import {
  DEFAULT_WEEKLY_GOAL_MINUTES,
  MIN_WEEKLY_GOAL_MINUTES,
  MAX_WEEKLY_GOAL_MINUTES,
  DEFAULT_DAILY_NEW_LIMIT,
  MIN_DAILY_NEW_LIMIT,
  MAX_DAILY_NEW_LIMIT,
  localDateString,
} from '@/lib/usageStats';
import {
  MIN_AGAIN_DELAY_SEC,
  MAX_AGAIN_DELAY_SEC,
} from '@/lib/pcicSession';
import { loadVoices, hasVoiceFor } from '@/lib/speech';
import { clearLearnResume } from '@/lib/learnResume';
import { useScreenLoad } from '@/lib/useScreenLoad';

// The resettable decks (the levels that have
// progress) and whether there is any grammar progress. The active direction's words count.
async function loadResettable(refresh: LearnerActions['refresh']): Promise<{ levels: PcicLevel[]; grammar: boolean }> {
  const db = getDb();
  await refresh(['direction']);
  const [cards, grammarRows] = await Promise.all([db.getPcicCards(), db.getGameProgress(GRAMMAR_PROGRESS_KEY)]);
  const ids = new Set(cards.map((c) => c.itemId));
  return {
    levels: PCIC_LEVELS.filter((lvl) => pcicItemsForLevel(lvl).some((i) => ids.has(i.id))),
    grammar: grammarRows.length > 0,
  };
}

// The Settings tab's state, its focus-time load and the handlers behind its rows (backup, restore,
// mistakes import, progress reset, direction switch, the steppers and switches). The screen
// (app/(tabs)/settings.tsx) renders it.
export function useSettingsScreen() {
  const s = t();
  const router = useRouter();
  const [level, setLevel] = useState<Level>('A0');
  // The learner's settings live in the store (lib/learner.tsx); this screen reads and writes them through it.
  const learner = useLearner();
  const { refresh, strictAccents, articlePicker, againDelaySec } = learner;
  const direction: [string, string] = [learner.source ?? 'en', learner.target];
  // The row of the learning-direction switch and its
  // small sheet.
  const [directionSheetOpen, setDirectionSheetOpen] = useState(false);
  // weekly study goal in minutes (UI shows whole hours).
  const [weeklyGoal, setWeeklyGoal] = useState(DEFAULT_WEEKLY_GOAL_MINUTES);
  // daily budget of brand-new words entering the queue.
  const [dailyNewLimit, setDailyNewLimit] = useState(DEFAULT_DAILY_NEW_LIMIT);
  // The return time of the PCIC "again" card (againDelaySec), the difficulty switches (strictAccents: off = the
  // beginner grader forgives a missing á/é/ñ, on = it counts as a mistake) and the article button row on the typing
  // Spanish noun card (articlePicker, on by default because the developer asked for it; the switch is the way back
  // if it turns out not to work well in practice) come from the store above.
  // User feedback: "there should be a text that congratulates me for reaching the
  // weekly limit, which is the goal, something huge. and at the goal it should also write
  // 'done' in green". The goal stepper never said whether the goal was met, so the
  // rolling 7-day total is read here too.
  const [weekMinutes, setWeekMinutes] = useState(0);
  // languages of this course the phone has no TTS voice for. Without the
  // hint the learner only hears a wrong-language reading (or now, silence) and
  // has no idea it is a missing system voice, not the app.
  const [missingVoices, setMissingVoices] = useState<string[]>([]);
  // The reset rows: one deck row for every level that has
  // progress, and one grammar row if there is grammar progress.
  const [resetLevels, setResetLevels] = useState<PcicLevel[]>([]);
  const [hasGrammarProgress, setHasGrammarProgress] = useState(false);
  // The reset rows in a collapsible section, closed by default.
  const [resetOpen, setResetOpen] = useState(false);
  // State of the __DEV__-only exam control (see below).
  const [examSeeded, setExamSeeded] = useState(false);

  // Every chain sets its own state as it lands; the screen has no spinner, the rows fill in.
  const load = useCallback(() => {
    const db = getDb();
    return Promise.all([
      refresh(['strictAccents']),
      db.getWeeklyGoalMinutes().then(setWeeklyGoal),
      db.getUsageStats().then(u => setWeekMinutes(u.thisWeek)),
      db.getDailyNewLimit().then(setDailyNewLimit),
      refresh(['againDelaySec']),
      refresh(['direction']).then(async o => {
        if (!o.onboarded) return;
        await loadVoices();
        setMissingVoices([o.source!, o.target].filter(code => !hasVoiceFor(code)));
      }),
      db.getLevel().then(l => setLevel(l.level as Level)),
      refresh(['articlePicker']),
      loadResettable(refresh).then(({ levels, grammar }) => {
        setResetLevels(levels);
        setHasGrammarProgress(grammar);
      }),
    ]);
  }, [refresh]);
  useScreenLoad(load);

  // the Learn screen reads the flag when it builds a queue.
  const handleStrictAccentsToggle = async (v: boolean) => {
    await learner.setStrictAccents(v);
  };

  // The same loading point as for the other learning settings.
  const handleArticlePickerToggle = async (v: boolean) => {
    await learner.setArticlePicker(v);
  };

  // Direction switch:
  // no confirmation question, because it can be switched back and the progress is not lost (the
  // two directions live with separate id spaces/pairs and a separate pair-level level,
  // lib/database.ts getPcicLevel/hasPcicLevel). If the new direction does not yet have an
  // explicitly chosen level, the main tab (app/(tabs)/index.tsx load())
  // opens the level picker sheet by itself, no separate handling is needed here.
  const handleSelectDirection = async (source: string, target: string) => {
    setDirectionSheetOpen(false);
    if (source === direction[0] && target === direction[1]) return;
    await learner.setOnboarding(source, target as PcicTarget);
    setLanguage(source);
    // A full remount of the tree (including the tab labels) is needed only here, on a
    // FINALIZED switch; the onboarding trial switch does not call it.
    notifyLanguageChange();
    router.replace('/(tabs)');
  };

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
    await learner.setAgainDelaySec(next);
  };

  // RN-web Alert is a no-op, so web falls back to the browser dialogs.
  const notify = (title: string, message?: string) => {
    if (Platform.OS === 'web') window.alert(message ? `${title}\n${message}` : title);
    else Alert.alert(title, message);
  };

  // Export the whole learning state to a JSON file. Native hands it to the
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

  // Pick a backup JSON, validate it, then (after an explicit confirm,
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

  // Progress reset moved here from the Learn header,
  // per deck (per level) and separately for grammar; all with confirmation. The Learn and the
  // Course tab reload on focus, the rows here refresh immediately.
  const confirmReset = (title: string, message: string, doReset: () => Promise<void>) => {
    const run = async () => {
      await doReset();
      const r = await loadResettable(refresh);
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
      // The saved Learn-round snapshot is no longer valid after the progress was reset.
      await clearLearnResume(getDb());
    });
  const handleResetGrammar = () =>
    confirmReset(s.settings.resetGrammarTitle, s.settings.resetGrammarMessage, () => getDb().resetGameProgress(GRAMMAR_PROGRESS_KEY));

  // Row visible only in __DEV__; it sets the exam
  // state (A1-B2: 85% of the level's cards graduated + the written lessons done) so that the exam can be clicked through.
  const handleSeedExamA1 = async () => {
    const db = getDb();
    const { target } = await refresh(['direction']);
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

  return {
    level,
    direction,
    directionSheetOpen,
    setDirectionSheetOpen,
    weeklyGoal,
    dailyNewLimit,
    againDelaySec,
    strictAccents,
    articlePicker,
    goalReached,
    missingVoices,
    resetLevels,
    hasGrammarProgress,
    resetOpen,
    setResetOpen,
    examSeeded,
    handleStrictAccentsToggle,
    handleArticlePickerToggle,
    handleSelectDirection,
    handleWeeklyGoalChange,
    handleDailyNewLimitChange,
    handleAgainDelayChange,
    handleBackup,
    handleRestore,
    handleResetDeck,
    handleResetGrammar,
    handleSeedExamA1,
    handleLoadMistakes,
  };
}
