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
// B1, B2 and C1 (both directions) are authored papers (data/exams/mock/*.json, lib/exam/mock/authored.ts) with the
// paper order, minutes and task counts of PLAN-vizsga-b1c1.md. The es direction keeps the 30 / 50 groups; the en
// direction averages scale scores (anchors from the research of 2026-10-22: pass 140 / 160 / 180, the speaking has its
// own anchors).
//
// The speaking paper (every level, both directions) comes from the file data/exams/mock/<target>-<level>-speaking.json
// (PLAN-vizsga-szobeli.md). While that file has no form the paper stays a placeholder (reserve): no task, not counted.
// ⚠ The Spanish A1 / A2 oral structure (3 tareas, the minutes below) is from a search summary: the official guide was not
// available on 2026-10-22.
//
// The phone task set is shorter than the real one, so the raw hits of a skill are
// scaled to its 25 points (lib/exam/mock/score.ts). The UI never prints a trademarked name.

import { authoredFormCount } from './authored';
import type { AuthoredPaperFile, MockLevel, MockRule, MockSkill, MockSkillNames, MockTarget } from './types';

/** The levels whose tasks are generated from the level's words. */
type WordLevel = Extract<MockLevel, 'A1' | 'A2'>;
/** The levels whose tasks are authored (data/exams/mock). */
type AuthoredLevel = Exclude<MockLevel, WordLevel>;
/** The four skills that have their own paper in the Spanish direction (`use` is a skill inside a paper). */
type PaperSkill = Exclude<MockSkill, 'use'>;

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
  /** The speaking paper: its tasks come from the speaking file; with no task the built paper is a placeholder (reserve). */
  placeholder?: boolean;
}

/** Which task allocation belongs to the exam (lib/exam/mock/build.ts); 'authored': the tasks come from the files (lib/exam/mock/authored.ts). */
type MockPlan = 'es-official' | 'en-a1' | 'en-a2' | 'authored';

interface MockBlueprint {
  plan: MockPlan;
  /** Official structure (Spanish) or international sample (English): the UI labels it differently. */
  official: boolean;
  papers: MockPaperSpec[];
  /** The names of the skills in the target language. */
  skillNames: MockSkillNames;
  rule: MockRule;
  counts: MockCounts;
}

const NO_EXTRA = { readGapType: 0, listenFill: 0, dictationSentences: 0 } as const;

const ES_COUNTS: Record<WordLevel, MockCounts> = {
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
const ES_NAMES: MockSkillNames = {
  reading: 'Comprensión de lectura',
  writing: 'Expresión e interacción escritas',
  listening: 'Comprensión auditiva',
  speaking: 'Expresión e interacción orales',
};

// The C1 papers carry the use of the language / the mediation in their names.
const ES_C1_NAMES: MockSkillNames = {
  reading: 'Comprensión de lectura y uso de la lengua',
  writing: 'Expresión, mediación e interacción escritas',
  listening: 'Comprensión auditiva y uso de la lengua',
  speaking: 'Expresión, mediación e interacción orales',
};

const EN_NAMES: MockSkillNames = {
  reading: 'Reading',
  writing: 'Writing',
  listening: 'Listening',
  speaking: 'Speaking',
};

// B2 and C1 score the Use of English apart from the reading.
const EN_USE_NAMES: MockSkillNames = { ...EN_NAMES, use: 'Use of English' };

// The minutes of the old blueprint.ts: es A1 45 / 25 / 25 / 10, es A2 60 / 45 / 40 / 12 (⚠ the speaking minutes 10 / 12: the
// DELE A1 / A2 oral structure is from a search summary, the guide was not available on 2026-10-22).
const ES_MINUTES: Record<WordLevel, Record<PaperSkill, number>> = {
  A1: { reading: 45, writing: 25, listening: 25, speaking: 10 },
  A2: { reading: 60, writing: 45, listening: 40, speaking: 12 },
};

// es B1-C1: the paper order is reading, listening, writing, speaking.
const ES_AUTHORED_MINUTES: Record<AuthoredLevel, Record<PaperSkill, number>> = {
  B1: { reading: 70, listening: 40, writing: 60, speaking: 15 },
  B2: { reading: 70, listening: 40, writing: 80, speaking: 20 },
  C1: { reading: 90, listening: 50, writing: 80, speaking: 20 },
};
const ES_AUTHORED_ORDER: PaperSkill[] = ['reading', 'listening', 'writing', 'speaking'];

// en B1-C1: raw score -> scale score anchors per component (research 2026-10-22, point 5: the examiner's practice conversion
// of 2023-11; the four columns are the minimum, the next step, the pass and the level above). The speaking has an entry too: it
// counts only once the speaking file has a task (the placeholder paper is left out).
const EN_SCALE: Record<AuthoredLevel, Extract<MockRule, { kind: 'scale' }>> = {
  B1: {
    kind: 'scale',
    needed: 140,
    approximate: true,
    skills: {
      reading: { officialMax: 32, anchors: [[5, 102], [13, 120], [23, 140], [29, 160]] },
      writing: { officialMax: 40, anchors: [[10, 102], [16, 120], [24, 140], [34, 160]] },
      listening: { officialMax: 25, anchors: [[5, 102], [11, 120], [18, 140], [23, 160]] },
      speaking: { officialMax: 30, anchors: [[7, 102], [12, 120], [18, 140], [27, 160]] },
    },
  },
  B2: {
    kind: 'scale',
    needed: 160,
    approximate: true,
    skills: {
      reading: { officialMax: 42, anchors: [[10, 122], [16, 140], [24, 160], [37, 180]] },
      use: { officialMax: 28, anchors: [[7, 122], [11, 140], [18, 160], [24, 180]] },
      writing: { officialMax: 40, anchors: [[10, 122], [16, 140], [24, 160], [34, 180]] },
      listening: { officialMax: 30, anchors: [[8, 122], [12, 140], [18, 160], [27, 180]] },
      speaking: { officialMax: 60, anchors: [[14, 122], [24, 140], [36, 160], [54, 180]] },
    },
  },
  C1: {
    kind: 'scale',
    needed: 180,
    approximate: true,
    skills: {
      reading: { officialMax: 50, anchors: [[17, 142], [23, 160], [32, 180], [43, 200]] },
      use: { officialMax: 28, anchors: [[8, 142], [11, 160], [16, 180], [23, 200]] },
      writing: { officialMax: 40, anchors: [[10, 142], [16, 160], [24, 180], [34, 200]] },
      listening: { officialMax: 30, anchors: [[11, 142], [13, 160], [18, 180], [26, 200]] },
      speaking: { officialMax: 75, anchors: [[17, 142], [30, 160], [45, 180], [66, 200]] },
    },
  },
};

const EN_AUTHORED_PAPERS: Record<AuthoredLevel, MockPaperSpec[]> = {
  B1: [
    { id: 'reading', name: 'Reading', minutes: 45, skills: ['reading'] },
    { id: 'writing', name: 'Writing', minutes: 45, skills: ['writing'] },
    { id: 'listening', name: 'Listening', minutes: 30, skills: ['listening'] },
    { id: 'speaking', name: 'Speaking', minutes: 12, skills: ['speaking'], placeholder: true },
  ],
  B2: [
    { id: 'readinguse', name: 'Reading and Use of English', minutes: 75, skills: ['reading', 'use'] },
    { id: 'writing', name: 'Writing', minutes: 80, skills: ['writing'] },
    { id: 'listening', name: 'Listening', minutes: 40, skills: ['listening'] },
    { id: 'speaking', name: 'Speaking', minutes: 14, skills: ['speaking'], placeholder: true },
  ],
  C1: [
    { id: 'readinguse', name: 'Reading and Use of English', minutes: 90, skills: ['reading', 'use'] },
    { id: 'writing', name: 'Writing', minutes: 90, skills: ['writing'] },
    { id: 'listening', name: 'Listening', minutes: 40, skills: ['listening'] },
    { id: 'speaking', name: 'Speaking', minutes: 15, skills: ['speaking'], placeholder: true },
  ],
};

// The authored papers are not generated: the generator's counts do not apply.
const AUTHORED_COUNTS: MockCounts = {
  maxWords: 0,
  readPassages: 0,
  readMatch: 0,
  readTrueFalse: 0,
  readTextSentences: 0,
  readTrue: 0,
  readGaps: 0,
  listenMc: 0,
  listenMatch: 0,
  listenDialogue: 0,
  ...NO_EXTRA,
};

const ES_GROUPS = [
  { skills: ['reading', 'writing'] as MockSkill[], needed: 30, of: 50 },
  { skills: ['listening', 'speaking'] as MockSkill[], needed: 30, of: 50 },
];

export const MOCK_LEVELS: Record<MockTarget, readonly MockLevel[]> = {
  es: ['A1', 'A2', 'B1', 'B2', 'C1'],
  en: ['A1', 'A2', 'B1', 'B2', 'C1'],
};

/** A1 / A2 are always available; B1 and up only when every non-placeholder paper has at least one authored form (the speaking is not required: with an empty file it stays a placeholder). */
export function mockAvailable(target: MockTarget, level: string, authored?: AuthoredPaperFile[]): level is MockLevel {
  if (!(MOCK_LEVELS[target] as readonly string[]).includes(level)) return false;
  if (level === 'A1' || level === 'A2') return true;
  const papers = getMockBlueprint(target, level as MockLevel).papers.filter((p) => !p.placeholder);
  return authoredFormCount(target, level as MockLevel, papers.map((p) => p.id), authored) > 0;
}

/** B1 and up are written at the official length (authored texts); A1 / A2 are a shorter set built from the level's words. */
export function mockIsFullLength(level: MockLevel): boolean {
  return level !== 'A1' && level !== 'A2';
}

const ES_ORDER: PaperSkill[] = ['reading', 'writing', 'listening', 'speaking'];

export function getMockBlueprint(target: MockTarget, level: MockLevel): MockBlueprint {
  if (level !== 'A1' && level !== 'A2') {
    if (target === 'es') {
      const names = level === 'C1' ? ES_C1_NAMES : ES_NAMES;
      return {
        plan: 'authored',
        official: true,
        papers: ES_AUTHORED_ORDER.map((skill) => ({
          id: skill,
          name: names[skill],
          minutes: ES_AUTHORED_MINUTES[level][skill],
          skills: [skill],
          placeholder: skill === 'speaking',
        })),
        skillNames: names,
        rule: { kind: 'groups', groups: ES_GROUPS },
        counts: AUTHORED_COUNTS,
      };
    }
    return {
      plan: 'authored',
      official: false,
      papers: EN_AUTHORED_PAPERS[level],
      skillNames: level === 'B1' ? EN_NAMES : EN_USE_NAMES,
      rule: EN_SCALE[level],
      counts: AUTHORED_COUNTS,
    };
  }
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
