// Mock-exam data model.
//
// Kálmán, 2026-09-08: "Azt akarom hogy a nyelvvizsga részek a valóságos A1 A2...
// nyelvizsgákhoz hasonlítsanak nyugodtan dolgozd át."
//
// The old exam was an arcade quiz: ten shuffled items, five lives, instant
// right/wrong feedback, and level-up if you survived. A real A1/A2 exam is
// nothing like that. It has named papers (pruebas / Prüfungsteile), each with
// its own clock and its own task types, no feedback while you work, a score per
// paper, and a pass rule over GROUPS of papers. This module is that shape.
//
// Verified structures behind the blueprints (2026-09-08):
// - DELE A1/A2, Instituto Cervantes: https://examenes.cervantes.es/es/dele/examenes/a1
//   and .../a2 (papers + durations + 25 points each), pass = min. 30/50 in BOTH
//   groups, Grupo 1 = Comprensión de lectura + Expresión escrita, Grupo 2 =
//   Comprensión auditiva + Expresión oral.
// - Goethe-Zertifikat A1 (Start Deutsch 1): Lesen 25', Hören 20', Schreiben 20',
//   Sprechen 15', pass 60/100 overall, no per-part minimum
//   (https://www.goethe.de/ins/de/en/prf/prf/gzsd1.html).
// - Goethe-Zertifikat A2: Lesen/Hören/Schreiben 30' each, Sprechen ~15';
//   pass = 45/75 on the written parts AND 15/25 on Sprechen
//   (https://www.goethe.de/pro/relaunch/prf/es/Durchfuehrungsbestimmungen_A2.pdf).
// - Cambridge A2 Key: Reading & Writing 60', Listening ~30', Speaking 8-10'
//   (https://www.cambridgeenglish.org/exams-and-tests/qualifications/key/format/).
//   Cambridge's own scale-score pass mark is NOT reproduced here; the app uses
//   its own 60% rule and says so.

export type ExamSkill = 'reading' | 'listening' | 'writing' | 'speaking';

export type ExamTaskKind =
  | 'match' // read short texts, match them to people/needs
  | 'text_mc' // one text, multiple-choice questions
  | 'true_false' // one text, true/false statements
  | 'gap_mc' // short text with gaps, 3 options each
  | 'listen_mc' // short recordings, one question each
  | 'listen_dialogue' // one dialogue, several questions
  | 'listen_match' // short announcements matched to places/situations
  | 'form_fill' // fill in a form (writing task 1)
  | 'short_message' // write a short message hitting given content points
  | 'speaking_prompt'; // speak aloud, compare with a model, self-assess

export interface ExamMatchTask {
  id: string;
  kind: 'match' | 'listen_match';
  instruction: string; // in the TARGET language, as in the real exam papers
  audio?: string[]; // listen_match: what the recording says, one line per prompt
  prompts: { id: string; text: string }[];
  options: { id: string; text: string }[];
  answer: Record<string, string>; // prompt id -> option id
}

export interface ExamTextMcTask {
  id: string;
  kind: 'text_mc';
  instruction: string;
  title?: string;
  text: string;
  questions: { q: string; options: string[]; correct: number; why?: string }[];
}

export interface ExamTrueFalseTask {
  id: string;
  kind: 'true_false';
  instruction: string;
  title?: string;
  text: string;
  statements: { s: string; answer: boolean; why?: string }[];
}

export interface ExamGapMcTask {
  id: string;
  kind: 'gap_mc';
  instruction: string;
  /** Gap markers are `___`; one entry in `gaps` per marker, in order. */
  text: string;
  gaps: { options: string[]; correct: number; why?: string }[];
}

export interface ExamListenTask {
  id: string;
  kind: 'listen_mc' | 'listen_dialogue';
  instruction: string;
  /** What the recording says; spoken with TTS in the target language. */
  audio: string[];
  /** listen_mc: one question per audio line. listen_dialogue: questions on the whole. */
  questions: { q: string; options: string[]; correct: number; why?: string }[];
}

export interface ExamFormFillTask {
  id: string;
  kind: 'form_fill';
  instruction: string;
  context: string;
  fields: { id: string; label: string; type: 'text' | 'number'; hint?: string }[];
}

export interface ExamShortMessageTask {
  id: string;
  kind: 'short_message';
  instruction: string;
  prompt: string;
  minWords: number;
  /** Each content point is one mark; matched case- and accent-insensitively. */
  points: { id: string; label: string; keywords: string[] }[];
}

export interface ExamSpeakingTask {
  id: string;
  kind: 'speaking_prompt';
  instruction: string;
  prompt: string;
  bullets?: string[];
  model: string;
}

export type ExamTask =
  | ExamMatchTask
  | ExamTextMcTask
  | ExamTrueFalseTask
  | ExamGapMcTask
  | ExamListenTask
  | ExamFormFillTask
  | ExamShortMessageTask
  | ExamSpeakingTask;

export interface ExamSection {
  skill: ExamSkill;
  /** The paper's own name in the target language, e.g. "Comprensión de lectura". */
  name: string;
  minutes: number;
  /** Points this paper is worth in the real exam (DELE: 25 each). */
  points: number;
  tasks: ExamTask[];
}

export interface MockExam {
  level: string;
  lang: string;
  /** What the simulation is modelled on, shown to the learner. */
  modelName: string;
  modelNote: string;
  sections: ExamSection[];
  /** Papers grouped for the pass rule, with the points needed in each group. */
  groups: { skills: ExamSkill[]; needed: number; of: number }[];
  /** True when at least one paper had to fall back to generated items. */
  generatedFallback: boolean;
}

/** How many scored marks a task carries. */
export function taskItemCount(task: ExamTask): number {
  switch (task.kind) {
    case 'match':
    case 'listen_match':
      return task.prompts.length;
    case 'text_mc':
      return task.questions.length;
    case 'true_false':
      return task.statements.length;
    case 'gap_mc':
      return task.gaps.length;
    case 'listen_mc':
    case 'listen_dialogue':
      return task.questions.length;
    case 'form_fill':
      return task.fields.length;
    case 'short_message':
      return task.points.length + 1; // content points + reaching the word count
    case 'speaking_prompt':
      return 1; // self-assessed, see lib/exam/score.ts
    default:
      return 0;
  }
}
