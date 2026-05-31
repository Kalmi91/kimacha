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

import es_a0 from './exams/es/a0.json';
import es_a1 from './exams/es/a1.json';
import es_a2 from './exams/es/a2.json';
import es_b1 from './exams/es/b1.json';
import es_b2 from './exams/es/b2.json';
import es_c1 from './exams/es/c1.json';
import es_c2 from './exams/es/c2.json';

import en_a0 from './exams/en/a0.json';
import en_a1 from './exams/en/a1.json';
import en_a2 from './exams/en/a2.json';
import en_b1 from './exams/en/b1.json';
import en_b2 from './exams/en/b2.json';

import hu_a0 from './exams/hu/a0.json';
import hu_a1 from './exams/hu/a1.json';
import hu_a2 from './exams/hu/a2.json';
import hu_b1 from './exams/hu/b1.json';
import hu_b2 from './exams/hu/b2.json';

// Placement-exam question sets keyed by TARGET language, then level. Each target
// language gets its own exam content. Languages not yet authored fall back to `es`.
const examsByLang: Record<string, Record<string, ExamQuestion[]>> = {
  es: {
    A0: es_a0 as ExamQuestion[],
    A1: es_a1 as ExamQuestion[],
    A2: es_a2 as ExamQuestion[],
    B1: es_b1 as ExamQuestion[],
    B2: es_b2 as ExamQuestion[],
    C1: es_c1 as ExamQuestion[],
    C2: es_c2 as ExamQuestion[],
  },
  en: {
    A0: en_a0 as ExamQuestion[],
    A1: en_a1 as ExamQuestion[],
    A2: en_a2 as ExamQuestion[],
    B1: en_b1 as ExamQuestion[],
    B2: en_b2 as ExamQuestion[],
  },
  hu: {
    A0: hu_a0 as ExamQuestion[],
    A1: hu_a1 as ExamQuestion[],
    A2: hu_a2 as ExamQuestion[],
    B1: hu_b1 as ExamQuestion[],
    B2: hu_b2 as ExamQuestion[],
  },
};

export function getExamQuestionsFor(targetLang: string, level: string): ExamQuestion[] {
  const langSet = examsByLang[targetLang] ?? examsByLang.es;
  const set = langSet[level] ?? examsByLang.es[level] ?? [];
  // Only multiple-choice "gap" questions: they are in the TARGET language and
  // source-agnostic. The legacy es↔hu "translate" items would force Hungarian on
  // non-Hungarian learners (e.g. en→es), so they are excluded from placement.
  return set.filter(q => q.type === 'gap');
}
