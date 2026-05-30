export type ExamType = 'gap' | 'translate';

export interface GapQuestion {
  id: number;
  level: string;
  type: 'gap';
  sentence: string;
  options: string[];
  correctIndex: number;
}

export interface TranslateQuestion {
  id: number;
  level: string;
  type: 'translate';
  direction: 'es_hu' | 'hu_es';
  source: string;
  target: string;
}

export type ExamQuestion = GapQuestion | TranslateQuestion;

import a0 from './exams/a0.json';
import a1 from './exams/a1.json';
import a2 from './exams/a2.json';
import b1 from './exams/b1.json';
import b2 from './exams/b2.json';
import c1 from './exams/c1.json';
import c2 from './exams/c2.json';

export const examQuestions: ExamQuestion[] = [...a0, ...a1, ...a2, ...b1, ...b2, ...c1, ...c2] as ExamQuestion[];

export function getExamQuestionsForLevel(level: string): ExamQuestion[] {
  return examQuestions.filter(q => q.level === level);
}

// Exam size scales with level: A=25, B=30, C=35. Pass = 80% of that.
export function examSize(level: string): number {
  if (level === 'B1' || level === 'B2') return 30;
  if (level === 'C1' || level === 'C2') return 35;
  return 25; // A0, A1, A2
}

export function passThreshold(level: string): number {
  return Math.ceil(examSize(level) * 0.8);
}
