import { useRef } from 'react';

import type { KindRun } from '@/lib/grammar/lessonScore';

export function useGrammarRoundProgress({
  seed,
  ids,
  total,
  resume,
  onProgress,
}: {
  seed: number;
  ids: string[];
  total: number;
  resume?: Omit<KindRun, 'total'>;
  onProgress?: (progress: KindRun) => void;
}) {
  const resumeOk =
    !!resume &&
    resume.index >= 0 &&
    resume.index < ids.length &&
    resume.ids.length === ids.length &&
    resume.ids.every((id, i) => id === ids[i]);
  const mistakes = useRef(new Set(resumeOk ? resume.mistakes ?? [] : []));

  const saveProgress = (index: number, correct: number) => {
    onProgress?.({ seed, ids, index, correct, total, ...(mistakes.current.size ? { mistakes: [...mistakes.current] } : {}) });
  };

  const recordChoice = (id: string, correct: boolean, index: number, dismissedCorrect: number) => {
    if (!correct) mistakes.current.add(id);
    // Feedback can be left before Next. Ask that item again on re-entry, keeping its original mistake.
    // Only dismissed items enter the saved correct count, so a repeated right answer is not counted twice.
    if (mistakes.current.size) saveProgress(index, dismissedCorrect);
    return correct && !mistakes.current.has(id);
  };

  return {
    initialIndex: resumeOk ? resume.index : 0,
    initialCorrect: resumeOk ? resume.correct : 0,
    saveProgress,
    recordChoice,
  };
}
