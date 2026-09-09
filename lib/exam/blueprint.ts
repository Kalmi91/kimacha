// The per-language, per-level exam shape: paper names, clocks, points and the
// pass rule. Sources for every number are in lib/exam/types.ts's header.
//
// The app's simulation is SHORTER than the real paper (a phone session is not a
// three-hour exam room), so a paper's raw score is scaled to the real paper's
// point value before the pass rule runs (lib/exam/score.ts). The structure, the
// clock and the pass rule are the real ones; only the item count is reduced,
// and the result screen says so.

import type { ExamSkill } from './types';

export interface BlueprintSection {
  skill: ExamSkill;
  name: string; // the paper's name in the target language
  minutes: number;
  points: number;
}

export interface ExamBlueprint {
  modelName: string;
  modelNote: string; // what it is modelled on, shown on the intro screen
  sections: BlueprintSection[];
  groups: { skills: ExamSkill[]; needed: number; of: number }[];
}

const DELE_A1: ExamBlueprint = {
  modelName: 'DELE A1',
  modelNote: 'Instituto Cervantes, DELE A1',
  sections: [
    { skill: 'reading', name: 'Comprensión de lectura', minutes: 45, points: 25 },
    { skill: 'writing', name: 'Expresión e interacción escritas', minutes: 25, points: 25 },
    { skill: 'listening', name: 'Comprensión auditiva', minutes: 25, points: 25 },
    { skill: 'speaking', name: 'Expresión e interacción orales', minutes: 10, points: 25 },
  ],
  groups: [
    { skills: ['reading', 'writing'], needed: 30, of: 50 },
    { skills: ['listening', 'speaking'], needed: 30, of: 50 },
  ],
};

const DELE_A2: ExamBlueprint = {
  modelName: 'DELE A2',
  modelNote: 'Instituto Cervantes, DELE A2',
  sections: [
    { skill: 'reading', name: 'Comprensión de lectura', minutes: 60, points: 25 },
    { skill: 'writing', name: 'Expresión e interacción escritas', minutes: 45, points: 25 },
    { skill: 'listening', name: 'Comprensión auditiva', minutes: 40, points: 25 },
    { skill: 'speaking', name: 'Expresión e interacción orales', minutes: 12, points: 25 },
  ],
  groups: [
    { skills: ['reading', 'writing'], needed: 30, of: 50 },
    { skills: ['listening', 'speaking'], needed: 30, of: 50 },
  ],
};

// Goethe A1 has no per-part minimum: 60 of 100 overall. Modelled as one group.
const GOETHE_A1: ExamBlueprint = {
  modelName: 'Start Deutsch 1',
  modelNote: 'Goethe-Institut, Goethe-Zertifikat A1',
  sections: [
    { skill: 'listening', name: 'Hören', minutes: 20, points: 25 },
    { skill: 'reading', name: 'Lesen', minutes: 25, points: 25 },
    { skill: 'writing', name: 'Schreiben', minutes: 20, points: 25 },
    { skill: 'speaking', name: 'Sprechen', minutes: 15, points: 25 },
  ],
  groups: [{ skills: ['listening', 'reading', 'writing', 'speaking'], needed: 60, of: 100 }],
};

// Goethe A2: the three written parts together need 45/75, Sprechen 15/25.
const GOETHE_A2: ExamBlueprint = {
  modelName: 'Goethe-Zertifikat A2',
  modelNote: 'Goethe-Institut, Goethe-Zertifikat A2',
  sections: [
    { skill: 'reading', name: 'Lesen', minutes: 30, points: 25 },
    { skill: 'listening', name: 'Hören', minutes: 30, points: 25 },
    { skill: 'writing', name: 'Schreiben', minutes: 30, points: 25 },
    { skill: 'speaking', name: 'Sprechen', minutes: 15, points: 25 },
  ],
  groups: [
    { skills: ['reading', 'listening', 'writing'], needed: 45, of: 75 },
    { skills: ['speaking'], needed: 15, of: 25 },
  ],
};

// Cambridge A2 Key's own scale-score pass mark is not reproduced (it is not a
// simple percentage); the app uses 60% per group and the intro says so.
const KEY_A2: ExamBlueprint = {
  modelName: 'A2 Key',
  modelNote: 'Cambridge English, A2 Key (KET)',
  sections: [
    { skill: 'reading', name: 'Reading', minutes: 40, points: 25 },
    { skill: 'writing', name: 'Writing', minutes: 20, points: 25 },
    { skill: 'listening', name: 'Listening', minutes: 30, points: 25 },
    { skill: 'speaking', name: 'Speaking', minutes: 10, points: 25 },
  ],
  groups: [
    { skills: ['reading', 'writing'], needed: 30, of: 50 },
    { skills: ['listening', 'speaking'], needed: 30, of: 50 },
  ],
};

function genericBlueprint(level: string, names: Record<ExamSkill, string>, modelName: string): ExamBlueprint {
  const longer = level === 'A0' || level === 'A1' ? 0 : 10;
  return {
    modelName,
    modelNote: modelName,
    sections: [
      { skill: 'reading', name: names.reading, minutes: 40 + longer, points: 25 },
      { skill: 'writing', name: names.writing, minutes: 25 + longer, points: 25 },
      { skill: 'listening', name: names.listening, minutes: 25 + longer, points: 25 },
      { skill: 'speaking', name: names.speaking, minutes: 12, points: 25 },
    ],
    groups: [
      { skills: ['reading', 'writing'], needed: 30, of: 50 },
      { skills: ['listening', 'speaking'], needed: 30, of: 50 },
    ],
  };
}

const GENERIC_NAMES: Record<string, Record<ExamSkill, string>> = {
  es: { reading: 'Comprensión de lectura', listening: 'Comprensión auditiva', writing: 'Expresión escrita', speaking: 'Expresión oral' },
  en: { reading: 'Reading', listening: 'Listening', writing: 'Writing', speaking: 'Speaking' },
  de: { reading: 'Lesen', listening: 'Hören', writing: 'Schreiben', speaking: 'Sprechen' },
  hu: { reading: 'Olvasott szöveg értése', listening: 'Hallott szöveg értése', writing: 'Íráskészség', speaking: 'Beszédkészség' },
};

/**
 * The exam shape for one target language and level. A0 uses the A1 shape with
 * the same clock (it is the on-ramp to A1, not a certified level anywhere), and
 * every level above the ones with a verified published structure falls back to
 * the generic CEFR shape so no learner is shown an invented "official" name.
 */
// Issue #3: a nyelv + szint párokat tábla tartja, nem egymásba ágyazott `if`-ek.
// Egy új nyelv hivatalos vizsgaformája így egy új bejegyzés, és amíg nincs
// ellenőrzött publikált struktúrája, egyszerűen nincs benne a táblában, tehát
// magától az általános CEFR-alakra esik vissza.
const PUBLISHED_BLUEPRINTS: Record<string, Record<string, ExamBlueprint>> = {
  es: { A1: DELE_A1, A2: DELE_A2 },
  de: { A1: GOETHE_A1, A2: GOETHE_A2 },
  en: { A2: KEY_A2 },
};

export function getBlueprint(lang: string, level: string): ExamBlueprint {
  const lvl = level === 'A0' ? 'A1' : level;
  const published = PUBLISHED_BLUEPRINTS[lang]?.[lvl];
  if (published) return published;

  // No verified published structure for this language/level pair: the generic
  // CEFR shape, named after the level only, so nothing claims to be an official
  // exam it is not.
  const names = GENERIC_NAMES[lang] ?? GENERIC_NAMES.en;
  return genericBlueprint(lvl, names, lvl);
}
