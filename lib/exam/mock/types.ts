// a próbavizsga adatmodellje. A régi (4afeb8c^)
// lib/exam/types.ts szerkezetét viszi tovább: papírok (saját órával), feladat-fajták, nincs
// azonnali visszajelzés, készségenkénti pont és az átmenési szabály. A feladatok nem kézzel írt
// JSON-ból, hanem a szint szavaiból épülnek (lib/exam/mock/build.ts), az irányt a `target` adja.
//
// Papír és készség külön fogalom: a papír az óra egysége (a spanyol irányban papír = készség, az
// angol A1 írásbelije hallást, olvasást és írást is tartalmaz, az angol A2 olvasás + írás egy
// közös papír), a készség a pontozás egysége (minden feladat egy készséghez tartozik).

import type { PcicLevel, PcicTarget } from '@/data/pcic';
import { foldedTokens } from './writing';

export type MockTarget = PcicTarget;
export type MockLevel = Extract<PcicLevel, 'A1' | 'A2'>;
export type MockSkill = 'reading' | 'writing' | 'listening' | 'speaking';

export interface MockChoice {
  options: string[];
  correct: number;
}

interface MockTaskBase {
  id: string;
  /** Melyik készség pontjába számít a feladat. */
  skill: MockSkill;
  instruction: string;
}

/** A felvételes feladatok hányszor játszhatók le (alap: kétszer; az angol A1 első része egyszer). */
interface MockPlays {
  plays?: number;
}

export interface MockMatchTask extends MockTaskBase, MockPlays {
  kind: 'match' | 'listen_match';
  /** listen_match: a felolvasott célnyelvi mondatok, a `prompts` sorrendjében. */
  audio?: string[];
  /** match: a prompt szövege a célnyelvi mondat; listen_match: üres, a felület "Recording N"-t ír. */
  prompts: { id: string; text: string }[];
  /** A kiinduló nyelvi jelentések (egy több, mint ahány prompt). */
  options: { id: string; text: string }[];
  answer: Record<string, string>;
}

export interface MockReadMcTask extends MockTaskBase {
  kind: 'read_mc';
  /** Egy kis célnyelvi szöveg + egy kérdés (a felület adja a kérdés szövegét), a válaszok kiinduló nyelviek. */
  passages: ({ text: string } & MockChoice)[];
}

export interface MockTrueFalseTask extends MockTaskBase {
  kind: 'true_false';
  text: string;
  statements: { s: string; answer: boolean }[];
}

export interface MockGapMcTask extends MockTaskBase {
  kind: 'gap_mc';
  /** Egy mondat egy `___` hellyel, 3 válasszal (célnyelvi szavak). */
  gaps: ({ text: string } & MockChoice)[];
}

/** Begépelős hézag: egy mondat egy `___` hellyel, a hiányzó szót kell beírni (nyílt hézagtöltés). */
export interface MockGapTypeTask extends MockTaskBase, MockPlays {
  kind: 'gap_type';
  /** Ha van, a mondatokat felolvassák (jegyzet-kiegészítés hallás után), a képernyőn a lyukas szöveg áll. */
  audio?: string[];
  /** `hint`: a hiányzó szó első betűje (a felület a beviteli mezőben mutatja), hogy a nyílt hézagnak kevesebb jó megoldása legyen. */
  gaps: { text: string; answer: string; hint?: string }[];
}

/** Diktálás: a felvételt szó szerint le kell írni (hallás ÉS írás is pontot kap). */
export interface MockDictationTask extends MockTaskBase, MockPlays {
  kind: 'dictation';
  audio: string[];
  /** A helyes szöveg (a felolvasott mondatok egymás után). */
  text: string;
}

export interface MockListenTask extends MockTaskBase, MockPlays {
  kind: 'listen_mc' | 'listen_dialogue';
  /** Mit mond a felvétel; TTS-sel szól a célnyelven. Soronként egy kérdés. */
  audio: string[];
  questions: MockChoice[];
}

export type MockFormCheck = 'fullname' | 'word' | 'address' | 'age' | 'phone' | 'email' | 'level';

/** Mit kell egy űrlap-mezőnek tartalmaznia (lib/exam/mock/writing.ts checkField); alapból szám-mezőnél életkor, szövegnél egy szó. */
export interface MockFormField {
  id: string;
  label: string;
  type: 'text' | 'number';
  check?: MockFormCheck;
}

export interface MockFormFillTask extends MockTaskBase {
  kind: 'form_fill';
  context: string;
  fields: MockFormField[];
}

export interface MockShortMessageTask extends MockTaskBase {
  kind: 'short_message';
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
  | MockGapTypeTask
  | MockDictationTask
  | MockListenTask
  | MockFormFillTask
  | MockShortMessageTask;

export interface MockPaper {
  /** Stabil azonosító (a mentés ezt jegyzi): spanyolul a készség neve, angolul `written` / `readingwriting` / `listening` / `speaking`. */
  id: string;
  /** A papír neve a célnyelven. */
  name: string;
  minutes: number;
  /** A papírban szereplő készségek összpontja (készségenként 25). */
  points: number;
  /** A szóbeli ebben a szeletben helyőrző nincs feladata, nem számít bele. */
  placeholder: boolean;
  tasks: MockTask[];
}

export interface MockGroup {
  skills: MockSkill[];
  needed: number;
  of: number;
}

/**
 * Az átmenési szabály alakja:
 * - groups: csoportonként küszöb (a spanyol hivatalos A1 / A2: olvasás + írás, hallás + szóbeli, mind 30 / 50);
 * - total: egy összpont-küszöb, részenkénti minimum nélkül, a készségek kompenzálnak (angol A1);
 * - average: a négy készség egyenlő súlyú átlaga egy százalék-küszöbhöz mérve; a küszöböt a vizsgáztató nem
 *   publikálja, ezért közelítő érték (angol A2, lib/exam/mock/blueprint.ts AVERAGE_PASS_PCT).
 */
export type MockRule =
  | { kind: 'groups'; groups: MockGroup[] }
  | { kind: 'total'; needed: number; of: number }
  | { kind: 'average'; passPct: number; approximate: true };

export interface MockExam {
  target: MockTarget;
  level: MockLevel;
  seed: number;
  /** Igaz, ha a hivatalos felépítést követi (spanyol); hamis, ha nemzetközi mintára épül (angol): a felület másképp jelöli. */
  official: boolean;
  papers: MockPaper[];
  /** A készségek neve a célnyelven (az eredmény-lap sávjaihoz). */
  skillNames: Record<MockSkill, string>;
  rule: MockRule;
}

/** Mit adott a tanuló egy feladatra: tétel-index vagy prompt/mező id a kulcs. */
export type MockTaskAnswer = Record<string, string | number | boolean | null>;
export type MockAnswers = Record<string, MockTaskAnswer>;

/** A felvételes feladat lejátszásainak alapértéke. */
export const DEFAULT_PLAYS = 2;

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
    case 'gap_type':
      return task.gaps.length;
    case 'listen_mc':
    case 'listen_dialogue':
      return task.questions.length;
    case 'dictation':
      return foldedTokens(task.text).length * 2; // minden szó egy hallás- és egy írás-jegy
    case 'form_fill':
      return task.fields.length;
    case 'short_message':
      return task.points.length + 1; // tartalmi pontok + a szószám elérése
  }
}
