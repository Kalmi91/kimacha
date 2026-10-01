// PLAN-vizsga E. szakasz: az irányonkénti, szintenkénti vizsga-alak (papír-nevek, percek,
// pontok, átmenési szabály, tételszámok). A számok forrása a régi (4afeb8c^)
// lib/exam/blueprint.ts, ami a hivatalos kiírásokat követte (2026-09-08): minden papír 25
// pont, két csoport (olvasás + írás, hallás + szóbeli), csoportonként 30 / 50 kell.
// Kálmán E3 a (2026-10-01): valódi vizsgaidők, a hivatalos percek.
//
// A telefonos feladatsor rövidebb a valódinál, ezért a papír nyers találata a papír 25
// pontjára skálázódik (lib/exam/mock/score.ts). A felület nem ír ki védjegyes nevet.

import type { MockGroup, MockLevel, MockSkill, MockTarget } from './types';

export interface MockCounts {
  /** A mondat célnyelvi szószáma legfeljebb ennyi (a szint nyelvtanán belül marad). */
  maxWords: number;
  readPassages: number;
  readMatch: number;
  readTrueFalse: number;
  /** Az igaz/hamis szöveg mondatszáma, és ebből az igaz állítások száma. */
  readTextSentences: number;
  readTrue: number;
  readGaps: number;
  listenMc: number;
  listenMatch: number;
  listenDialogue: number;
}

export interface MockSectionSpec {
  skill: MockSkill;
  name: string;
  minutes: number;
  points: number;
}

export interface MockBlueprint {
  sections: MockSectionSpec[];
  groups: MockGroup[];
  counts: MockCounts;
}

const GROUPS: MockGroup[] = [
  { skills: ['reading', 'writing'], needed: 30, of: 50 },
  { skills: ['listening', 'speaking'], needed: 30, of: 50 },
];

const COUNTS: Record<MockLevel, MockCounts> = {
  A1: {
    maxWords: 8,
    readPassages: 3,
    readMatch: 5,
    readTrueFalse: 4,
    readTextSentences: 3,
    readTrue: 2,
    readGaps: 5,
    listenMc: 5,
    listenMatch: 4,
    listenDialogue: 3,
  },
  A2: {
    maxWords: 12,
    readPassages: 4,
    readMatch: 6,
    readTrueFalse: 5,
    readTextSentences: 4,
    readTrue: 3,
    readGaps: 6,
    listenMc: 6,
    listenMatch: 5,
    listenDialogue: 4,
  },
};

// es irány (angolul beszélő tanul spanyolt): a hivatalos A1 / A2 felépítés, a papír-nevek spanyolul.
const ES_NAMES: Record<MockSkill, string> = {
  reading: 'Comprensión de lectura',
  writing: 'Expresión e interacción escritas',
  listening: 'Comprensión auditiva',
  speaking: 'Expresión e interacción orales',
};

const EN_NAMES: Record<MockSkill, string> = {
  reading: 'Reading',
  writing: 'Writing',
  listening: 'Listening',
  speaking: 'Speaking',
};

// A régi blueprint.ts percei: es A1 45 / 25 / 25 / 10, es A2 60 / 45 / 40 / 12.
const MINUTES: Record<string, Record<MockSkill, number>> = {
  'es:A1': { reading: 45, writing: 25, listening: 25, speaking: 10 },
  'es:A2': { reading: 60, writing: 45, listening: 40, speaking: 12 },
};

// Az es→en (spanyolul beszélő tanul angolt) irányban csak az A2 alakja ismert a régi
// blueprint.ts-ből; az A1-nek nincs ellenőrzött hivatalos felépítése, ezért nincs (DÖNTÉS KELL).
export const MOCK_LEVELS: Record<MockTarget, readonly MockLevel[]> = {
  es: ['A1', 'A2'],
  en: [],
};

export function mockAvailable(target: MockTarget, level: string): level is MockLevel {
  return (MOCK_LEVELS[target] as readonly string[]).includes(level);
}

const ORDER: MockSkill[] = ['reading', 'writing', 'listening', 'speaking'];

export function getMockBlueprint(target: MockTarget, level: MockLevel): MockBlueprint {
  const minutes = MINUTES[`${target}:${level}`];
  if (!minutes) throw new Error(`no mock exam blueprint for ${target} ${level}`);
  const names = target === 'es' ? ES_NAMES : EN_NAMES;
  return {
    sections: ORDER.map((skill) => ({ skill, name: names[skill], minutes: minutes[skill], points: 25 })),
    groups: GROUPS,
    counts: COUNTS[level],
  };
}
