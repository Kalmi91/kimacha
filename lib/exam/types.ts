// PLAN-vizsga A. szakasz (2-3. lépés): a szintvizsga adatmodellje. A régi
// (4afeb8c^) lib/examBuilder.ts tétel-fajtáiból csak az marad, ami a szintvizsgához
// kell; minden tétel a tanult szavakból vagy a kész szint-leckékből jön, és
// viszi magával, honnan (itemId / topicId), hogy a későbbi lépések (hibás tétel
// vissza az SM-2-be, eredmény készségenként + lecke-link) ne a tételből találgassák.

import type { PcicLevel } from '@/data/pcic';

/** A szintek, amiknek van vizsgájuk. Az első szelet (2-3. lépés) csak A1; a 4. lépés bővíti. */
export const EXAM_LEVELS: readonly PcicLevel[] = ['A1'];

/** Az eredmény-lap készségei (A4); a tétel `skill`-je dönti el, melyikbe számít. */
export type ExamSkill = 'words' | 'grammar' | 'reading';

export type ExamItem =
  // Szó beírása: a prompt a kiinduló nyelven, a válasz a célnyelven (irányfüggő).
  | { kind: 'word_type'; skill: 'words'; itemId: string; prompt: string; hint?: string; answer: string }
  // Párosítás: bal = célnyelvi szó, jobb = kiinduló nyelvi jelentés.
  | { kind: 'match'; skill: 'words'; itemIds: string[]; pairs: { left: string; right: string }[] }
  // Mondat-összerakás: a prompt a kiinduló nyelvű mondat, a csempék a célnyelviek.
  | { kind: 'sent_order'; skill: 'words'; itemId: string; prompt: string; answerTokens: string[]; distractors: string[] }
  // Mondat-beírás: a prompt a kiinduló nyelvű mondat, a válasz a célnyelvi.
  | { kind: 'sent_type'; skill: 'words'; itemId: string; prompt: string; answer: string }
  // Nyelvtan: lyukas mondat 3 válasszal, egy kész szint-lecke tételeiből.
  | { kind: 'gap_mc'; skill: 'grammar'; topicId: string; sentence: string; options: string[]; correctIndex: number }
  // Olvasás: két tanult mondatból álló célnyelvi szöveg, a kiinduló nyelvű jelentését kell kiválasztani.
  | { kind: 'reading_mc'; skill: 'reading'; itemIds: string[]; text: string; options: string[]; correctIndex: number };

/** Egy megválaszolt tétel: a későbbi lépések (SM-2 vissza, készségenkénti lap) ebből dolgoznak. */
export interface ExamItemResult {
  item: ExamItem;
  correct: boolean;
}

/** Egy szint mentett eredménye (game_progress, `level-exam` játék, itemId = a szint). */
export interface ExamResult {
  /** Egyszer már átment-e (az újrapróba ezt nem veszi el). */
  passed: boolean;
  /** A legjobb pontszám, egész százalék. */
  best: number;
  /** A legjobb pontszám napja, YYYY-MM-DD. */
  bestAt: string;
  /** A legutóbbi próba pontszáma, egész százalék. */
  last: number;
  /** A legutóbbi próba napja, YYYY-MM-DD. */
  lastAt: string;
}

export type ExamResults = Record<string, ExamResult>;
