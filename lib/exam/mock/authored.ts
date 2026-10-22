// The practice exam's authored B1-C1 papers: the files in data/exams/mock (registry: data/exams/mock/index.ts, schema:
// AuthoredPaperFile in lib/exam/mock/types.ts) become Mock tasks. One form is picked by the seed and it is the same
// form in every paper of the exam, so the form count is the minimum over the papers. Pure module: the files can be injected (tests).

import { MOCK_AUTHORED } from '@/data/exams/mock';
import type { AuthoredPaperFile, MockLevel, MockTarget, MockTask } from './types';

const PREFIX = /^(TAREA|PART) \d+\.\s*/;

const fileOf = (files: AuthoredPaperFile[], target: MockTarget, level: MockLevel, paper: string) =>
  files.find((f) => f.target === target && f.level === level && f.paper === paper);

/** How many forms the exam can be built from: the fewest forms among the given papers, 0 if one of them has no file. */
export function authoredFormCount(target: MockTarget, level: MockLevel, paperIds: string[], files: AuthoredPaperFile[] = MOCK_AUTHORED): number {
  if (paperIds.length === 0) return 0;
  return Math.min(...paperIds.map((id) => fileOf(files, target, level, id)?.forms.length ?? 0));
}

/** The tasks of one paper from the seed's form (`forms[seed % formCount]`): id `<paper>-<n>`, the instruction led by `TAREA n.` / `PART n.`. */
export function authoredTasks(
  target: MockTarget,
  level: MockLevel,
  paper: string,
  seed: number,
  formCount: number,
  files: AuthoredPaperFile[] = MOCK_AUTHORED,
): MockTask[] {
  const forms = fileOf(files, target, level, paper)?.forms ?? [];
  if (formCount <= 0 || forms.length === 0) return [];
  const form = forms[((seed % formCount) + formCount) % formCount];
  return form.tasks.map((task, i) => {
    const n = i + 1;
    const instruction = `${target === 'es' ? 'TAREA' : 'PART'} ${n}. ${task.instruction.replace(PREFIX, '')}`;
    return { ...task, id: `${paper}-${n}`, instruction } as MockTask;
  });
}
