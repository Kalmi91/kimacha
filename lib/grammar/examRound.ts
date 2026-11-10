// The exam round of the Grammar tab (slice 2 of the exam strip): two gap texts in exam format (6 gaps, 3 options per gap),
// picked so that the weakest topics of the level get the most gaps. Pure module: no React, no DB, no Math.random, no
// Date.now. The texts live in data/grammar/exam-round/<lang>-<level lower-case>.json (schema: see ExamRoundFile; the gate is
// scripts/exam-round-check.mjs). Every gap names its grammar topic, and every answer counts as test evidence of that topic
// (kind `cloze`, see the screen app/grammar/exam-round.tsx).

import { TICK_PCT, topicPercent, type TopicEvidence } from '@/lib/grammar/randomRound';
import { examMissedTopics } from '@/lib/grammar/examEvidence';
import { weakestTopics } from '@/lib/grammar/levelTest';
import { shuffleArray } from '@/lib/shuffle';

export interface ExamRoundGap {
  options: string[];
  correct: number;
  topic: string;
}

export interface ExamRoundText {
  id: string;
  title: string;
  /** The text with the markers `{{1}}` .. `{{6}}`; `gaps[i]` belongs to `{{i+1}}`. */
  text: string;
  gaps: ExamRoundGap[];
}

export interface ExamRoundFile {
  lang: string;
  level: string;
  skip?: { topic: string; why: string }[];
  texts: ExamRoundText[];
}

export const ROUND_TEXTS = 2;

// The shipped files, a static require map (Metro needs literal paths). Add a line per file.
const FILES: Record<string, () => ExamRoundFile> = {
  'es-a1': () => require('@/data/grammar/exam-round/es-a1.json') as ExamRoundFile,
};

const fileKey = (lang: string, level: string) => `${lang}-${level.toLowerCase()}`;

/** The gap-text file of a learned language and level; `undefined` when there is none. */
export function examRoundFile(lang: string, level: string): ExamRoundFile | undefined {
  return FILES[fileKey(lang, level)]?.();
}

/** The round needs two texts to be offered. */
export const examRoundAvailable = (lang: string, level: string): boolean => (examRoundFile(lang, level)?.texts.length ?? 0) >= ROUND_TEXTS;

/**
 * How much a gap of this topic is worth in the pick: 3 for one of the weakest topics, 2 for a topic with a percent under
 * TICK_PCT, 1 for a topic without a percent yet, 0 for a topic at TICK_PCT or more.
 */
export function gapWeight(topicId: string, evidence: Map<string, TopicEvidence>, weakIds: readonly string[]): number {
  if (weakIds.includes(topicId)) return 3;
  const pct = topicPercent(evidence.get(topicId));
  if (pct === null) return 1;
  return pct < TICK_PCT ? 2 : 0;
}

/** The sum of the weights of the text's gaps. */
export const textScore = (text: ExamRoundText, evidence: Map<string, TopicEvidence>, weakIds: readonly string[]): number =>
  text.gaps.reduce((sum, g) => sum + gapWeight(g.topic, evidence, weakIds), 0);

/**
 * The texts of a round: those with the most gaps of an exam-missed topic first (examMissed), then those whose id is not in
 * `seen`, then the higher score; ties in the seeded order of shuffleArray(seed). `n` different texts (fewer if the file has fewer).
 */
export function pickRoundTexts(
  texts: ExamRoundText[],
  ids: string[],
  evidence: Map<string, TopicEvidence>,
  seen: readonly string[],
  seed: number,
  n: number = ROUND_TEXTS,
): ExamRoundText[] {
  const weakIds = weakestTopics(ids, evidence, 3).map((w) => w.id);
  const seenSet = new Set(seen);
  const missedSet = new Set(examMissedTopics(ids, evidence));
  const ranked = shuffleArray(texts, seed).map((text, order) => ({
    text,
    order,
    missed: text.gaps.filter((g) => missedSet.has(g.topic)).length,
    unseen: !seenSet.has(text.id),
    score: textScore(text, evidence, weakIds),
  }));
  ranked.sort((a, b) => b.missed - a.missed || Number(b.unseen) - Number(a.unseen) || b.score - a.score || a.order - b.order);
  return ranked.slice(0, n).map((r) => r.text);
}

/** The `seen` list after a finished round: the done texts added; when that covers every text of the file, only the two just done stay. */
export function nextSeen(seen: readonly string[], done: readonly string[], allIds: readonly string[]): string[] {
  const merged = [...seen.filter((id) => !done.includes(id)), ...done];
  return allIds.every((id) => merged.includes(id)) ? [...done] : merged;
}

/** The answers of one text: the gap index (0-based, as a string) to the picked option index. */
export type ExamAnswers = Record<string, number>;

export interface GapResult {
  /** The gap number, 1-based. */
  n: number;
  /** The picked option index, null if the gap was left open. */
  picked: number | null;
  /** The right option index. */
  right: number;
  ok: boolean;
  topic: string;
}

/** One row per gap of the text. */
export function scoreText(text: ExamRoundText, answers: ExamAnswers): GapResult[] {
  return text.gaps.map((g, i) => {
    const given = answers[String(i)];
    const picked = typeof given === 'number' && Number.isInteger(given) ? given : null;
    return { n: i + 1, picked, right: g.correct, ok: picked === g.correct, topic: g.topic };
  });
}

/** The saved run: the ids of the round's texts (empty = no open round), the position, the picks and the check state of the text on screen. */
export interface ExamRun {
  texts: string[];
  index: number;
  answers: ExamAnswers;
  checked: boolean;
  seed: number;
  /** The text ids of the finished rounds. */
  seen: string[];
}

export const examRunKey = (pair: string, level: string): string => `grammar-exam-round:${pair}:${level}`;

const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** A saved run, or null when the value is missing or damaged (the caller starts a new round). */
export function parseExamRun(raw: unknown): ExamRun | null {
  const r = raw as Partial<ExamRun> | null | undefined;
  if (!r || typeof r !== 'object') return null;
  const { texts, index, answers, checked, seed, seen } = r;
  if (!isStringList(texts) || texts.length > ROUND_TEXTS || !isStringList(seen)) return null;
  if (!Number.isInteger(index) || (index as number) < 0 || (index as number) > Math.max(0, texts.length - 1)) return null;
  if (typeof checked !== 'boolean' || typeof seed !== 'number' || !Number.isFinite(seed)) return null;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return null;
  const clean: ExamAnswers = {};
  for (const [k, v] of Object.entries(answers)) {
    if (!/^\d+$/.test(k) || !Number.isInteger(v) || (v as number) < 0) return null;
    clean[k] = v as number;
  }
  return { texts, index: index as number, answers: clean, checked, seed, seen };
}
