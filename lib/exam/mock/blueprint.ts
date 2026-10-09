// The exam shape per direction and per level (papers, minutes, pass
// rule, item counts).
//
// es direction (English speaker learning Spanish): the official A1 / A2 structure from the old (4afeb8c^)
// lib/exam/blueprint.ts (specifications verified on 2026-09-08): four papers, one per skill, all 25
// points, two groups (reading + writing, listening + speaking), 30 / 50 required per group.
//
// en direction (Spanish speaker learning English): international samples from Kimacha's exam research (2026-10-01,
// from the examiner's own documents):
//  - A1: the written exam is one 1 hour 15 minute paper (listening + reading + writing), speaking is separate (~3.5 minutes);
//    four skills x 25 = 100 points, pass 50 / 100, no per-skill minimum: the skills compensate each other;
//    the first part of listening can be heard once, the rest twice.
//  - A2: Reading + Writing is one shared 60 minute paper, Listening ~30 minutes (every text twice), speaking
//    8-10 minutes in pairs (according to the research an individual format is the realistic one). Four skills with equal
//    weight, the average counts; the examiner does not publish the threshold, so it is an approximate value (AVERAGE_PASS_PCT).
//
// The phone task set is shorter than the real one, so the raw hits of a skill are
// scaled to its 25 points (lib/exam/mock/score.ts). The UI never prints a trademarked name.

import type { MockLevel, MockRule, MockSkill, MockTarget } from './types';

/**
 * Open question (2026-10-01): the English A2 pass threshold in percent. The examiner does not publish a
 * pass mark (the research: a raw-score threshold for the 120 scale score ⚠ not verified), so this is an
 * approximate default, labelled "approximate" in the UI. Adjustable in one place.
 */
export const AVERAGE_PASS_PCT = 70;

/** The English A1 total-score threshold out of 100 (according to the research, the official one: 50). */
export const TOTAL_PASS_POINTS = 50;

interface MockCounts {
  /** The target-language word count of a sentence is at most this (it stays within the level's grammar). */
  maxWords: number;
  readPassages: number;
  readMatch: number;
  readTrueFalse: number;
  /** The sentence count of a true/false text, and of that the number of true statements. */
  readTextSentences: number;
  readTrue: number;
  readGaps: number;
  /** Typed (open) gaps in reading. */
  readGapType: number;
  listenMc: number;
  listenMatch: number;
  listenDialogue: number;
  /** Note completion after listening (a typed gap with a recording). */
  listenFill: number;
  /** Number of dictated sentences (0 = no dictation). */
  dictationSentences: number;
}

interface MockPaperSpec {
  id: string;
  name: string;
  minutes: number;
  skills: MockSkill[];
  placeholder?: boolean;
}

/** Which task allocation belongs to the exam (lib/exam/mock/build.ts). */
type MockPlan = 'es-official' | 'en-a1' | 'en-a2';

interface MockBlueprint {
  plan: MockPlan;
  /** Official structure (Spanish) or international sample (English): the UI labels it differently. */
  official: boolean;
  papers: MockPaperSpec[];
  /** The names of the skills in the target language. */
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

// English A1: 5 short announcements (once), dictation (2 sentences), 4 gaps after listening; reading: 5 multiple-choice gaps,
// 3 texts, 5 typed gaps; writing: two authored messages (lib/exam/mock/author.ts).
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

// English A2: reading 6 texts, matching, true/false, 6 multiple-choice and 6 typed gaps; listening 5 short
// announcements, 5 gaps after listening, a dialogue, matching; writing: two authored messages.
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

// es direction: the paper names are in Spanish.
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

// The minutes of the old blueprint.ts: es A1 45 / 25 / 25 / 10, es A2 60 / 45 / 40 / 12.
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
