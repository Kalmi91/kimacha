// GAMES.md 3. (F0): score math + record keeping (game_scores table). The
// combo-multiplier curve matches the one spelled out for word-rain (4.1: "5
// hibátlanonként lép", steps of 0.25 up to 2.0×), kept here, not duplicated
// per game, because every arcade game in this family uses the same curve
// unless a later spec explicitly says otherwise.

import { getDb } from '../database';

const COMBO_STEP = 0.25;
const COMBO_STEP_SIZE = 5; // every 5 correct in a row
const COMBO_MAX = 2.0;

export function comboMultiplier(streak: number): number {
  const steps = Math.floor(Math.max(0, streak) / COMBO_STEP_SIZE);
  return Math.min(COMBO_MAX, 1 + steps * COMBO_STEP);
}

export interface GameScoreRecord {
  bestScore: number;
  bestAt: string | null;
  plays: number;
  lastPlayed: string | null;
}

export async function getGameBest(gameId: string): Promise<GameScoreRecord | null> {
  return getDb().getGameScore(gameId);
}

export async function recordGameResult(gameId: string, score: number): Promise<{ isNewBest: boolean; best: number }> {
  return getDb().recordGameScore(gameId, score);
}
