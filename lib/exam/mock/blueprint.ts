// PLAN-vizsga E. szakasz: az irányonkénti, szintenkénti vizsga-alak (papírok, percek, átmenési
// szabály, tételszámok).
//
// es irány (angolul beszélő tanul spanyolt): a hivatalos A1 / A2 felépítés a régi (4afeb8c^)
// lib/exam/blueprint.ts-ből (2026-09-08 ellenőrzött kiírások): négy papír készségenként, mind 25
// pont, két csoport (olvasás + írás, hallás + szóbeli), csoportonként 30 / 50 kell.
//
// en irány (spanyolul beszélő tanul angolt): a Kimacha vizsga-kutatása (2026-10-01, a vizsgáztatók
// saját dokumentumaiból) nemzetközi mintái:
//  - A1: az írásbeli egy 1 óra 15 perces papír (hallás + olvasás + írás), a szóbeli külön (~3,5 perc);
//    négy készség x 25 = 100 pont, átmenet 50 / 100, részenkénti minimum nincs: a készségek kompenzálnak;
//    a hallás első része egyszer, a többi kétszer hallható.
//  - A2: Olvasás + Írás egy közös 60 perces papír, Hallás ~30 perc (minden szöveg kétszer), szóbeli
//    8-10 perc páros (a kutatás szerint egyéni forma a reális). Négy készség egyenlő súllyal, az átlag
//    számít; a küszöböt a vizsgáztató nem publikálja, ezért közelítő érték (AVERAGE_PASS_PCT).
//
// A telefonos feladatsor rövidebb a valódinál, ezért egy készség nyers találata a 25 pontjára
// skálázódik (lib/exam/mock/score.ts). A felület sehol nem ír ki védjegyes nevet.

import type { MockLevel, MockRule, MockSkill, MockTarget } from './types';

/**
 * DÖNTÉS KELL (2026-10-01): az angol A2 átmenési küszöbe százalékban. A vizsgáztató nem publikál
 * pass-mark-ot (a kutatás: nyers-pont küszöb a 120-as skálaponthoz ⚠ nem ellenőrzött), ezért ez egy
 * közelítő alapérték, a felületen "approximate" jelzéssel. Egy helyen állítható.
 */
export const AVERAGE_PASS_PCT = 70;

/** Az angol A1 összpont-küszöbe 100-ból (a kutatás szerint a hivatalos: 50). */
export const TOTAL_PASS_POINTS = 50;

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
  /** Begépelős (nyílt) hézagok az olvasásban. */
  readGapType: number;
  listenMc: number;
  listenMatch: number;
  listenDialogue: number;
  /** Hallás utáni jegyzet-kiegészítés (begépelős hézag felvétellel). */
  listenFill: number;
  /** Diktált mondatok száma (0 = nincs diktálás). */
  dictationSentences: number;
}

export interface MockPaperSpec {
  id: string;
  name: string;
  minutes: number;
  skills: MockSkill[];
  placeholder?: boolean;
}

/** Melyik feladat-kiosztás tartozik a vizsgához (lib/exam/mock/build.ts). */
export type MockPlan = 'es-official' | 'en-a1' | 'en-a2';

export interface MockBlueprint {
  plan: MockPlan;
  /** Hivatalos felépítés (spanyol) vagy nemzetközi minta (angol): a felület másképp jelöli. */
  official: boolean;
  papers: MockPaperSpec[];
  /** A készségek neve a célnyelven. */
  skillNames: Record<MockSkill, string>;
  rule: MockRule;
  counts: MockCounts;
}

const NO_EXTRA = { readGapType: 0, listenFill: 0, dictationSentences: 0 } as const;

const ES_COUNTS: Record<MockLevel, MockCounts> = {
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
    ...NO_EXTRA,
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
    ...NO_EXTRA,
  },
};

// Angol A1: 5 rövid közlés (egyszer), diktálás (2 mondat), 4 hallás utáni hézag; olvasás: 5 feleletválasztós hézag,
// 3 szöveg, 5 begépelős hézag; írás: két szerzői üzenet (lib/exam/mock/author.ts).
const EN_A1_COUNTS: MockCounts = {
  maxWords: 8,
  readPassages: 3,
  readMatch: 0,
  readTrueFalse: 0,
  readTextSentences: 0,
  readTrue: 0,
  readGaps: 5,
  readGapType: 5,
  listenMc: 5,
  listenMatch: 0,
  listenDialogue: 0,
  listenFill: 4,
  dictationSentences: 2,
};

// Angol A2: olvasás 6 szöveg, párosítás, igaz/hamis, 6 feleletválasztós és 6 begépelős hézag; hallás 5 rövid
// közlés, 5 hallás utáni hézag, párbeszéd, párosítás; írás: két szerzői üzenet.
const EN_A2_COUNTS: MockCounts = {
  maxWords: 12,
  readPassages: 6,
  readMatch: 6,
  readTrueFalse: 5,
  readTextSentences: 4,
  readTrue: 3,
  readGaps: 6,
  readGapType: 6,
  listenMc: 5,
  listenMatch: 5,
  listenDialogue: 5,
  listenFill: 5,
  dictationSentences: 0,
};

// es irány: a papír-nevek spanyolul.
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
const ES_MINUTES: Record<MockLevel, Record<MockSkill, number>> = {
  A1: { reading: 45, writing: 25, listening: 25, speaking: 10 },
  A2: { reading: 60, writing: 45, listening: 40, speaking: 12 },
};

const ES_GROUPS = [
  { skills: ['reading', 'writing'] as MockSkill[], needed: 30, of: 50 },
  { skills: ['listening', 'speaking'] as MockSkill[], needed: 30, of: 50 },
];

export const MOCK_LEVELS: Record<MockTarget, readonly MockLevel[]> = {
  es: ['A1', 'A2'],
  en: ['A1', 'A2'],
};

export function mockAvailable(target: MockTarget, level: string): level is MockLevel {
  return (MOCK_LEVELS[target] as readonly string[]).includes(level);
}

const ES_ORDER: MockSkill[] = ['reading', 'writing', 'listening', 'speaking'];

export function getMockBlueprint(target: MockTarget, level: MockLevel): MockBlueprint {
  if (target === 'es') {
    return {
      plan: 'es-official',
      official: true,
      papers: ES_ORDER.map((skill) => ({
        id: skill,
        name: ES_NAMES[skill],
        minutes: ES_MINUTES[level][skill],
        skills: [skill],
        placeholder: skill === 'speaking',
      })),
      skillNames: ES_NAMES,
      rule: { kind: 'groups', groups: ES_GROUPS },
      counts: ES_COUNTS[level],
    };
  }
  if (level === 'A1') {
    return {
      plan: 'en-a1',
      official: false,
      papers: [
        { id: 'written', name: 'Written test', minutes: 75, skills: ['listening', 'reading', 'writing'] },
        { id: 'speaking', name: 'Speaking', minutes: 3.5, skills: ['speaking'], placeholder: true },
      ],
      skillNames: EN_NAMES,
      rule: { kind: 'total', needed: TOTAL_PASS_POINTS, of: 100 },
      counts: EN_A1_COUNTS,
    };
  }
  return {
    plan: 'en-a2',
    official: false,
    papers: [
      { id: 'readingwriting', name: 'Reading and Writing', minutes: 60, skills: ['reading', 'writing'] },
      { id: 'listening', name: 'Listening', minutes: 30, skills: ['listening'] },
      { id: 'speaking', name: 'Speaking', minutes: 9, skills: ['speaking'], placeholder: true },
    ],
    skillNames: EN_NAMES,
    rule: { kind: 'average', passPct: AVERAGE_PASS_PCT, approximate: true },
    counts: EN_A2_COUNTS,
  };
}
