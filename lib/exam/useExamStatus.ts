import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { getDb } from '@/lib/database';
import { useLearner } from '@/lib/learner';
import { sourceFor } from '@/lib/languagePair';
import { EXAM_LEVELS } from '@/lib/exam/types';
import { examStatusFor, levelHasLesson, type ExamLevelStatus } from '@/lib/exam/unlock';
import { GRAMMAR_PROGRESS_KEY } from '@/lib/grammar/syllabus';
import { GRAMMAR_RANDOM_KEY, evidenceFromRows, type TopicEvidence } from '@/lib/grammar/randomRound';

// The exam tab's state: the direction, the grammar evidence and the level exam's unlock state per level.
// The same sources as app/exam.tsx (the cards and the grammar rows); reloaded every time the tab gets focus,
// so after an exam the fresh state shows.
export function useExamStatus() {
  const { refresh } = useLearner();
  const [learnedLang, setLearnedLang] = useState('es');
  const [contentLang, setContentLang] = useState('en');
  const [evidence, setEvidence] = useState<Map<string, TopicEvidence>>(new Map());
  const [examStatus, setExamStatus] = useState<Map<string, ExamLevelStatus>>(new Map());
  // the target of the previous load: another direction must not show the old direction's exam status while loading.
  const examTarget = useRef<string | null>(null);

  const load = useCallback(async () => {
    const db = getDb();
    const { target, source } = await refresh(['direction']);
    setLearnedLang(target);
    if (examTarget.current !== null && examTarget.current !== target) setExamStatus(new Map());
    examTarget.current = target;
    setContentLang(sourceFor(target, source));
    const rows = await db.getGameProgress(GRAMMAR_PROGRESS_KEY);
    setEvidence(evidenceFromRows(await db.getGameProgress(GRAMMAR_RANDOM_KEY)));
    const cards = await db.getPcicCards();
    setExamStatus(new Map(EXAM_LEVELS.filter((l) => levelHasLesson(l, target)).map((l) => [l, examStatusFor(l, target, cards, rows)])));
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return { learnedLang, contentLang, evidence, examStatus };
}
