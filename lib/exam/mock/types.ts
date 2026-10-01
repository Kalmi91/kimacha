// PLAN-vizsga E. szakasz (15-16. lépés): a próbavizsga adatmodellje. A régi (4afeb8c^)
// lib/exam/types.ts szerkezetét viszi tovább: négy papír (olvasás, írás, hallás, szóbeli),
// papíronként saját óra és feladat-fajták, nincs azonnali visszajelzés, csoportonkénti
// átmenés. A különbség: a feladatok nem kézzel írt JSON-ból, hanem a szint szavaiból épülnek
// (lib/exam/mock/build.ts), az irányt a `target` adja.

import type { PcicLevel, PcicTarget } from '@/data/pcic';

export type MockTarget = PcicTarget;
export type MockLevel = Extract<PcicLevel, 'A1' | 'A2'>;
export type MockSkill = 'reading' | 'writing' | 'listening' | 'speaking';

export interface MockChoice {
  options: string[];
  correct: number;
}

export interface MockMatchTask {
  id: string;
  kind: 'match' | 'listen_match';
  instruction: string;
  /** listen_match: a felolvasott célnyelvi mondatok, a `prompts` sorrendjében. */
  audio?: string[];
  /** match: a prompt szövege a célnyelvi mondat; listen_match: üres, a felület "Recording N"-t ír. */
  prompts: { id: string; text: string }[];
  /** A kiinduló nyelvi jelentések (egy több, mint ahány prompt). */
  options: { id: string; text: string }[];
  answer: Record<string, string>;
}

export interface MockReadMcTask {
  id: string;
  kind: 'read_mc';
  instruction: string;
  /** Egy kis célnyelvi szöveg + egy kérdés (a felület adja a kérdés szövegét), a válaszok kiinduló nyelviek. */
  passages: ({ text: string } & MockChoice)[];
}

export interface MockTrueFalseTask {
  id: string;
  kind: 'true_false';
  instruction: string;
  text: string;
  statements: { s: string; answer: boolean }[];
}

export interface MockGapMcTask {
  id: string;
  kind: 'gap_mc';
  instruction: string;
  /** Egy mondat egy `___` hellyel, 3 válasszal (célnyelvi szavak). */
  gaps: ({ text: string } & MockChoice)[];
}

export interface MockListenTask {
  id: string;
  kind: 'listen_mc' | 'listen_dialogue';
  instruction: string;
  /** Mit mond a felvétel; TTS-sel szól a célnyelven. Soronként egy kérdés. */
  audio: string[];
  questions: MockChoice[];
}

/** Mit kell egy űrlap-mezőnek tartalmaznia (lib/exam/mock/writing.ts checkField); alapból szám-mezőnél életkor, szövegnél egy szó. */
export type MockFormCheck = 'fullname' | 'word' | 'address' | 'age' | 'phone' | 'email' | 'level';

export interface MockFormField {
  id: string;
  label: string;
  type: 'text' | 'number';
  check?: MockFormCheck;
}

export interface MockFormFillTask {
  id: string;
  kind: 'form_fill';
  instruction: string;
  context: string;
  fields: MockFormField[];
}

export interface MockShortMessageTask {
  id: string;
  kind: 'short_message';
  instruction: string;
  prompt: string;
  minWords: number;
  /** Egy tartalmi pont = egy jegy; kis/nagybetű és ékezet nélkül egyeztetett kulcsszavakkal. */
  points: { id: string; label: string; keywords: string[] }[];
}

export type MockTask =
  | MockMatchTask
  | MockReadMcTask
  | MockTrueFalseTask
  | MockGapMcTask
  | MockListenTask
  | MockFormFillTask
  | MockShortMessageTask;

export interface MockPaper {
  skill: MockSkill;
  /** A papír neve a célnyelven. */
  name: string;
  minutes: number;
  /** Ennyit ér a valódi vizsgán (mind a négy 25). */
  points: number;
  /** A szóbeli ebben a szeletben helyőrző (Kálmán E2 a): nincs feladata, nem számít bele. */
  placeholder: boolean;
  tasks: MockTask[];
}

export interface MockGroup {
  skills: MockSkill[];
  needed: number;
  of: number;
}

export interface MockExam {
  target: MockTarget;
  level: MockLevel;
  seed: number;
  papers: MockPaper[];
  groups: MockGroup[];
}

/** Mit adott a tanuló egy feladatra: tétel-index vagy prompt/mező id a kulcs. */
export type MockTaskAnswer = Record<string, string | number | boolean | null>;
export type MockAnswers = Record<string, MockTaskAnswer>;

/** Hány pontozott jegy van egy feladatban. */
export function mockTaskItemCount(task: MockTask): number {
  switch (task.kind) {
    case 'match':
    case 'listen_match':
      return task.prompts.length;
    case 'read_mc':
      return task.passages.length;
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
      return task.points.length + 1; // tartalmi pontok + a szószám elérése
  }
}
