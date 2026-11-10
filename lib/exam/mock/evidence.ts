// The mock exam's grammar evidence (slice 3 of the exam strip): a cloze gap or a transform item that carries a `topic` and
// that the learner answered counts as test evidence of that topic (lib/grammar/examEvidence.ts merges it). Pure module.

import { EXAM_ID_PREFIX, type ExamAnswer } from '@/lib/grammar/examEvidence';
import type { MockResult } from './score';
import type { MockAnswers, MockExam } from './types';

/** One answer per tagged and answered gap / item, right or wrong; `ok` is the scoring's own decision (MockTaskResult.items). */
export function mockExamAnswers(exam: MockExam, result: MockResult, answers: MockAnswers): ExamAnswer[] {
  const out: ExamAnswer[] = [];
  for (const paper of exam.papers) {
    for (const task of paper.tasks) {
      if (task.kind !== 'cloze' && task.kind !== 'transform') continue;
      const scored = result.papers.flatMap((p) => p.tasks).find((r) => r.taskId === task.id);
      const given = answers[task.id] ?? {};
      const rows: { topic?: string; open: boolean }[] =
        task.kind === 'cloze' ? task.gaps.map((g) => ({ topic: g.topic, open: !('options' in g) })) : task.items.map((it) => ({ topic: it.topic, open: true }));
      rows.forEach((row, i) => {
        const value = given[String(i)];
        const answered = row.open ? String(value ?? '').trim() !== '' : typeof value === 'number';
        const item = scored?.items[i];
        if (!row.topic || !answered || !item) return;
        out.push({
          topicId: row.topic,
          id: `${EXAM_ID_PREFIX}M${exam.seed}:${task.id}#${i + 1}`,
          kind: task.kind === 'cloze' ? 'cloze' : 'transform',
          ok: item.ok,
        });
      });
    }
  }
  return out;
}
