// Marking a mock exam the way a real one is marked: per item, then per paper
// scaled to the paper's published point value, then per GROUP of papers against
// the group's pass mark. No lives, no instant feedback, no "you survived".

import type { ExamSkill, ExamTask, MockExam } from './types';
import { taskItemCount } from './types';

/** What the learner did on one task: keyed by item index (or prompt/field id). */
export type TaskAnswer = Record<string, string | boolean | number | null>;
export type ExamAnswers = Record<string, TaskAnswer>; // task id -> answers

export interface TaskResult {
  taskId: string;
  correct: number;
  total: number;
  /** Per item, for the review list: what was asked, given, expected. */
  items: { label: string; given: string; expected: string; ok: boolean; why?: string }[];
}

export interface SectionResult {
  skill: ExamSkill;
  name: string;
  correct: number;
  total: number;
  /** Raw score scaled to the paper's published points (DELE: 25 per paper). */
  points: number;
  maxPoints: number;
  tasks: TaskResult[];
}

export interface GroupResult {
  skills: ExamSkill[];
  points: number;
  needed: number;
  of: number;
  passed: boolean;
}

export interface ExamResult {
  sections: SectionResult[];
  groups: GroupResult[];
  passed: boolean;
  totalPoints: number;
  totalMax: number;
}

/** Case- and accent-insensitive fold, for keyword matching in writing tasks. */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function scoreTask(task: ExamTask, answer: TaskAnswer = {}): TaskResult {
  const items: TaskResult['items'] = [];

  switch (task.kind) {
    case 'match':
    case 'listen_match': {
      for (const prompt of task.prompts) {
        const expectedId = task.answer[prompt.id];
        const givenId = answer[prompt.id];
        const expected = task.options.find((o) => o.id === expectedId)?.text ?? String(expectedId);
        const given = task.options.find((o) => o.id === givenId)?.text ?? '';
        items.push({ label: prompt.text, given, expected, ok: givenId === expectedId });
      }
      break;
    }
    case 'text_mc':
    case 'listen_mc':
    case 'listen_dialogue': {
      task.questions.forEach((q, i) => {
        const given = answer[String(i)];
        const ok = given === q.correct;
        items.push({
          label: q.q,
          given: typeof given === 'number' ? q.options[given] ?? '' : '',
          expected: q.options[q.correct],
          ok,
          why: q.why,
        });
      });
      break;
    }
    case 'true_false': {
      task.statements.forEach((st, i) => {
        const given = answer[String(i)];
        const ok = given === st.answer;
        items.push({
          label: st.s,
          given: given === true ? '✓' : given === false ? '✗' : '',
          expected: st.answer ? '✓' : '✗',
          ok,
          why: st.why,
        });
      });
      break;
    }
    case 'gap_mc': {
      task.gaps.forEach((gap, i) => {
        const given = answer[String(i)];
        const ok = given === gap.correct;
        items.push({
          label: `${i + 1}.`,
          given: typeof given === 'number' ? gap.options[given] ?? '' : '',
          expected: gap.options[gap.correct],
          ok,
          why: gap.why,
        });
      });
      break;
    }
    case 'form_fill': {
      // A form is the learner's own data, so it cannot be marked for truth; it
      // is marked the way the real task is: every field filled, and filled with
      // the right KIND of thing (a number where a number belongs).
      for (const field of task.fields) {
        const raw = String(answer[field.id] ?? '').trim();
        const ok = raw.length > 0 && (field.type !== 'number' || /\d/.test(raw));
        items.push({ label: field.label, given: raw, expected: field.type === 'number' ? '123' : '…', ok });
      }
      break;
    }
    case 'short_message': {
      const text = String(answer.text ?? '');
      const folded = fold(text);
      for (const point of task.points) {
        const ok = point.keywords.some((kw) => folded.includes(fold(kw)));
        items.push({ label: point.label, given: ok ? '✓' : '✗', expected: point.keywords[0], ok });
      }
      const words = countWords(text);
      items.push({
        label: `≥ ${task.minWords}`,
        given: String(words),
        expected: String(task.minWords),
        ok: words >= task.minWords,
      });
      break;
    }
    case 'speaking_prompt': {
      // Self-assessed: the learner speaks, hears/reads the model answer, and
      // says how it went. 2 = fully, 1 = partly, 0 = not yet.
      const self = Number(answer.self ?? 0);
      items.push({
        label: task.prompt,
        given: String(self),
        expected: '2',
        ok: self >= 2,
      });
      break;
    }
    default:
      break;
  }

  // speaking_prompt carries a 0/1/2 self-rating, so its "correct" is fractional
  // on purpose: one prompt half-done is half a mark, not nothing.
  const correct =
    task.kind === 'speaking_prompt'
      ? Math.min(1, Number(answer.self ?? 0) / 2)
      : items.filter((i) => i.ok).length;

  return { taskId: task.id, correct, total: taskItemCount(task), items };
}

export function scoreExam(exam: MockExam, answers: ExamAnswers): ExamResult {
  const sections: SectionResult[] = exam.sections.map((section) => {
    const tasks = section.tasks.map((task) => scoreTask(task, answers[task.id]));
    const correct = tasks.reduce((sum, t) => sum + t.correct, 0);
    const total = tasks.reduce((sum, t) => sum + t.total, 0);
    // The simulation is shorter than the real paper, so the raw score is scaled
    // to the paper's published points before the pass rule sees it.
    const points = total > 0 ? Math.round((correct / total) * section.points) : 0;
    return { skill: section.skill, name: section.name, correct, total, points, maxPoints: section.points, tasks };
  });

  const bySkill = new Map(sections.map((s) => [s.skill, s]));
  const groups: GroupResult[] = exam.groups.map((group) => {
    const points = group.skills.reduce((sum, skill) => sum + (bySkill.get(skill)?.points ?? 0), 0);
    // A group whose papers are all missing (no content for that skill) cannot
    // fail the learner: it is dropped from the pass rule instead.
    const present = group.skills.some((skill) => (bySkill.get(skill)?.total ?? 0) > 0);
    return { skills: group.skills, points, needed: group.needed, of: group.of, passed: !present || points >= group.needed };
  });

  const totalPoints = sections.reduce((sum, s) => sum + s.points, 0);
  const totalMax = sections.reduce((sum, s) => sum + s.maxPoints, 0);

  return { sections, groups, passed: groups.every((g) => g.passed), totalPoints, totalMax };
}
