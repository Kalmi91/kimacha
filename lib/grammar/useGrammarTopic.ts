import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { getDb } from '@/lib/database';
import type { Level } from '@/data/words';
import { grammarKindCounts, type GrammarKind, type GrammarTopicData } from '@/lib/games/content';
import { GRAMMAR_PROGRESS_KEY, lessonFor, scoredKinds } from '@/lib/grammar/syllabus';
import { betterBest, kindBestKey, kindProgressFromRows, kindRunKey, lessonScore } from '@/lib/grammar/lessonScore';
import { speakSequence, stopSpeaking } from '@/lib/speech';
import { splitByMarkers } from '@/lib/mixedSpeech';
import { speechLang } from '@/lib/languages';
import type { RoundStats } from '@/components/grammar/GrammarDrill';
import { useDockSlot } from '@/components/learn/DockSlot';
import { useLoadOnMount } from '@/lib/useLoadOnMount';
import { useSessionProgress } from '@/lib/useSessionProgress';
import { clearDrillResume, drillToResume, loadDrillResume, saveDrillResume } from '@/lib/drillResume';
import { localDateString } from '@/lib/usageStats';

export type Phase = 'lesson' | 'drill' | 'done' | 'test';
export type ProgressRow = { itemId: string; state: string; data: unknown };

// Buttons appear in this order, only for the kinds
// the lesson has items for.
export const KIND_ORDER: GrammarKind[] = ['choice', 'article', 'match', 'form', 'why', 'transform', 'spot', 'order', 'dictation'];

export function useGrammarTopic() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { topic: topicId } = useLocalSearchParams<{ topic: string }>();

  const [learnedLang, setLearnedLang] = useState('es');
  const [contentLang, setContentLang] = useState('en');
  const [level, setLevel] = useState<Level>('A1');
  const { persistRow } = useSessionProgress();
  const [lesson, setLesson] = useState<GrammarTopicData | null>(null);
  const [phase, setPhase] = useState<Phase>('lesson');
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);
  // which kind the learner started (by its button); this goes into
  // GrammarDrill's `kinds` prop and into the progress-row key.
  const [drillKind, setDrillKind] = useState<GrammarKind>('choice');
  // id of the visible drill item, for the feedback context.
  const [drillItemId, setDrillItemId] = useState<string | undefined>(undefined);
  // Card-level resume: true once the saved practice has been read back (nothing is saved before that).
  const [drillResumeReady, setDrillResumeReady] = useState(false);
  // the Check / Next bar of the drill's type-in items docks above the keyboard (components/learn/DockSlot.tsx).
  const dock = useDockSlot(colors);
  // the lesson-body ScrollView remounts on a phase change; lib/grammar/scrollMemory.ts
  // keeps the position per topicId so it can be restored.
  const scrollRef = useRef<ScrollView>(null);
  // the V2 lesson's single (play → stop) button for reading lesson.speak
  // aloud; it stops on button press, on a phase change and on unmount.
  const [speaking, setSpeaking] = useState(false);
  // how many times each transform item has been practiced (itemId -> n);
  // this decides the order of the next round of 10 (least practiced first).
  const [transformSeen, setTransformSeen] = useState<Record<string, number>>({});
  // the lesson's progress rows (game_progress), from which each kind gets
  // its best finished round (best) and its abandoned round (run);
  // the lesson % is the average over ALL kinds (lib/grammar/lessonScore.ts), a kind not yet done counts as 0.
  const [progressRows, setProgressRows] = useState<ProgressRow[]>([]);
  // data for the round-end screen (memory only): the drill's stats, the
  // cumulative % from BEFORE the round, and the streak days.
  const [roundStats, setRoundStats] = useState<RoundStats | null>(null);
  const [prevPct, setPrevPct] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);

  const load = useCallback(async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const target = onboarding?.target ?? 'es';
    setLearnedLang(target);
    // Kimacha Play: UI always English, regardless of the
    // stored source language.
    // es→en: a Spanish-native learner gets the Spanish explanation.
    setContentLang(target === 'en' ? 'es' : 'en');
    const levelData = await db.getLevel();
    setLevel((levelData.level as Level) ?? 'A1');
    setStreak((await db.getStreak())?.current_count ?? 0);
    const loadedLesson = lessonFor(target, String(topicId)) ?? null;
    setLesson(loadedLesson);
    if (loadedLesson) {
      // before the round starts, load how many times each transform item
      // has been practiced, so the least practiced can come first.
      const progressRows = await db.getGameProgress(GRAMMAR_PROGRESS_KEY);
      const seenRow = progressRows.find((r) => r.itemId === `${String(topicId)}:transform:seen`);
      setTransformSeen((seenRow?.data as Record<string, number>) ?? {});
      // the kinds' best/run/old rows come from the same query.
      setProgressRows(progressRows);
      // if the app was closed during this practice, reopen in it (the round continues from the saved run).
      const counts = grammarKindCounts(loadedLesson);
      const resumeKind = drillToResume(await loadDrillResume(db), String(topicId), localDateString(), KIND_ORDER.filter((k) => counts[k] > 0));
      if (resumeKind) {
        setDrillKind(resumeKind);
        setPhase('drill');
      }
    } else {
      setTransformSeen({});
      setProgressRows([]);
    }
    setDrillResumeReady(true);
  }, [topicId]);

  useLoadOnMount(load);

  // while in the drill, save the practice; on leaving the lesson (lesson phase, done, unmount) clear it.
  useEffect(() => {
    if (!drillResumeReady) return;
    const db = getDb();
    if (phase === 'drill') void saveDrillResume(db, { topicId: String(topicId), kind: drillKind, day: localDateString() });
    else void clearDrillResume(db);
  }, [drillResumeReady, phase, drillKind, topicId]);
  useEffect(
    () => () => {
      const db = getDb();
      void loadDrillResume(db).then((r) => (r?.topicId === String(topicId) ? clearDrillResume(db) : undefined));
    },
    [topicId]
  );

  // stop reading aloud on a phase change and on unmount too,
  // not only when the button is pressed. Because of the hook rules it must
  // come BEFORE the early return for a null `lesson`.
  useEffect(() => {
    if (phase !== 'lesson') return;
    return () => {
      stopSpeaking();
      setSpeaking(false);
    };
  }, [phase]);

  // the V2 lesson's `speak` field is cut into sections by the «...» markers
  // (no corpus guessing), and the button toggles play<->stop.
  const toggleLessonSpeech = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const text = lesson!.speak[contentLang as 'en' | 'es'] ?? lesson!.speak.en;
    const segments = splitByMarkers(text, { learnedLang, nativeLang: contentLang }).map((seg) => ({
      text: seg.text,
      locale: speechLang(seg.lang),
    }));
    setSpeaking(true);
    speakSequence(segments, () => setSpeaking(false));
  };

  // writing the lesson's progress rows: local state + durable (game_progress).
  const saveRow = (itemId: string, state: string, data: unknown) => {
    setProgressRows((prev) => [...prev.filter((r) => r.itemId !== itemId), { itemId, state, data }]);
    persistRow(GRAMMAR_PROGRESS_KEY, itemId, state, data);
  };
  // The lesson %: the average over ALL existing kinds, a kind not yet started counts as 0 (null: nothing done yet).
  // Provisional kinds do not pull the lesson % down (scoredKinds).
  const lessonScoreOf = (rows: ProgressRow[]) =>
    lessonScore(scoredKinds(lesson!).map((k) => kindProgressFromRows(rows, String(topicId), k)));

  const finish = async (correct: number, total: number, roundItemIds?: string[]) => {
    setPrevPct(lessonScoreOf(progressRows));
    setScore({ correct, total });
    setPhase('done');
    // the row key is per kind (`${topic}:${kind}`), and it is only
    // written if this kind scored >=80% this time (see
    // doneGrammarTopicProgress: a kind only counts as done that way).
    const pct = total ? Math.round((correct / total) * 100) : 0;
    if (pct >= 80) {
      persistRow(GRAMMAR_PROGRESS_KEY, `${String(topicId)}:${drillKind}`, 'done', { correct, total });
    }
    // finished round: the better result overwrites the old one (a weaker one does not lower it),
    // and the abandoned round is deleted. A kind's % is its best round's result.
    const prevBest = kindProgressFromRows(progressRows, String(topicId), drillKind).best;
    saveRow(kindBestKey(String(topicId), drillKind), 'best', betterBest(prevBest, { correct, total }));
    saveRow(kindRunKey(String(topicId), drillKind), 'run', null);
    // the round's items become "practiced", right and wrong answers
    // both count; one write at the end of the round, not per item.
    if (drillKind === 'transform' && roundItemIds && roundItemIds.length) {
      const updated = { ...transformSeen };
      for (const id of roundItemIds) updated[id] = (updated[id] ?? 0) + 1;
      setTransformSeen(updated);
      persistRow(GRAMMAR_PROGRESS_KEY, `${String(topicId)}:transform:seen`, 'seen', updated);
    }
  };

  return {
    colors,
    topicId,
    learnedLang,
    contentLang,
    level,
    lesson,
    phase,
    setPhase,
    score,
    setScore,
    drillKind,
    setDrillKind,
    drillItemId,
    setDrillItemId,
    dock,
    scrollRef,
    speaking,
    transformSeen,
    progressRows,
    roundStats,
    setRoundStats,
    prevPct,
    streak,
    toggleLessonSpeech,
    saveRow,
    lessonScoreOf,
    finish,
  };
}
