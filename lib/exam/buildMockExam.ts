// Assembles one mock exam: the published shape for the language/level
// (lib/exam/blueprint.ts), filled with authored tasks where they exist
// (data/exams/mock/<lang>/<level>.json) and generated ones where they do not
// (lib/exam/generated.ts), so every branch of the app has a complete paper.

import type { Level } from '@/data/words';
import { getBlueprint } from './blueprint';
import {
  generatedGapTask,
  generatedListeningTask,
  generatedReadingTask,
  generatedSpeakingTasks,
  generatedWritingTasks,
} from './generated';
import type { ExamSection, ExamSkill, ExamTask, MockExam } from './types';

interface AuthoredExamFile {
  lang: string;
  level: string;
  reading?: ExamTask[];
  listening?: ExamTask[];
  writing?: ExamTask[];
  speaking?: ExamTask[];
}

import esA1 from '@/data/exams/mock/es/a1.json';
import esA2 from '@/data/exams/mock/es/a2.json';
import deA1 from '@/data/exams/mock/de/a1.json';
import deA2 from '@/data/exams/mock/de/a2.json';
import enA1 from '@/data/exams/mock/en/a1.json';
import enA2 from '@/data/exams/mock/en/a2.json';

const AUTHORED: Record<string, Record<string, AuthoredExamFile>> = {
  es: { A1: esA1 as unknown as AuthoredExamFile, A2: esA2 as unknown as AuthoredExamFile },
  de: { A1: deA1 as unknown as AuthoredExamFile, A2: deA2 as unknown as AuthoredExamFile },
  en: { A1: enA1 as unknown as AuthoredExamFile, A2: enA2 as unknown as AuthoredExamFile },
};

/**
 * A0 has no exam of its own anywhere in the world; it is this app's on-ramp, so
 * it sits the A1 paper with the A1 material. Levels above the authored ones use
 * the generated paper built from that level's own corpus and question bank.
 */
function authoredFor(lang: string, level: string): AuthoredExamFile | null {
  const lvl = level === 'A0' ? 'A1' : level;
  return AUTHORED[lang]?.[lvl] ?? null;
}

export function buildMockExam(lang: string, nativeLang: string, level: string): MockExam {
  const blueprint = getBlueprint(lang, level);
  const authored = authoredFor(lang, level);
  const contentLevel = (level === 'A0' ? 'A0' : level) as Level;
  let generatedFallback = false;

  const tasksFor = (skill: ExamSkill): ExamTask[] => {
    const fromFile = authored?.[skill];
    if (fromFile && fromFile.length > 0) return fromFile;

    generatedFallback = true;
    if (skill === 'reading') {
      const out: ExamTask[] = [];
      const reading = generatedReadingTask(lang, contentLevel);
      if (reading) out.push(reading);
      const gap = generatedGapTask(lang, level);
      if (gap) out.push(gap);
      return out;
    }
    if (skill === 'listening') {
      const listening = generatedListeningTask(lang, nativeLang, contentLevel);
      return listening ? [listening] : [];
    }
    if (skill === 'writing') return generatedWritingTasks(lang);
    return generatedSpeakingTasks(lang);
  };

  const sections: ExamSection[] = blueprint.sections
    .map((section) => ({
      skill: section.skill,
      name: section.name,
      minutes: section.minutes,
      points: section.points,
      tasks: tasksFor(section.skill),
    }))
    .filter((section) => section.tasks.length > 0);

  return {
    level,
    lang,
    modelName: blueprint.modelName,
    modelNote: blueprint.modelNote,
    sections,
    groups: blueprint.groups,
    generatedFallback,
  };
}
