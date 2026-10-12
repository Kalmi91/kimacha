// Half-step logic shared by the practice modes (Practice tab, Sentences tab), spec HAROM-JATEK.md 5.1.
// A correct answer in a practice mode is one half; 2 halves = 1 full SRS step (forward). Two wrong TYPED
// answers in a row = 1 step back. Any other wrong answer (picking, matching) changes nothing.
// Only the main word card gives a full step with one answer.

import { getDb } from '@/lib/database';
import { addDays, sm2Review, type Sm2Card } from '@/lib/sm2';
import { localDateString } from '@/lib/usageStats';

export type PracticeResult = 'correct' | 'wrongTyped' | 'wrongOther';
export type SrsMove = 'forward' | 'back' | 'none';
export interface HalfState {
  halfSteps: number;
  wrongStreak: number;
}
export interface PracticeOutcome extends HalfState {
  srs: SrsMove;
}

export const HALVES_PER_STEP = 2;
export const WRONG_TYPED_PER_BACK = 2;

// Pure: the next counters + whether the SRS moves.
export function applyPracticeResult(state: HalfState, result: PracticeResult): PracticeOutcome {
  if (result === 'wrongOther') return { ...state, srs: 'none' };
  if (result === 'correct') {
    const halfSteps = state.halfSteps + 1;
    if (halfSteps >= HALVES_PER_STEP) return { halfSteps: 0, wrongStreak: 0, srs: 'forward' };
    return { halfSteps, wrongStreak: 0, srs: 'none' };
  }
  const wrongStreak = state.wrongStreak + 1;
  if (wrongStreak >= WRONG_TYPED_PER_BACK) return { halfSteps: 0, wrongStreak: 0, srs: 'back' };
  return { halfSteps: state.halfSteps, wrongStreak, srs: 'none' };
}

// One step back on the SM-2 ladder, the inverse of a "good" (sm2.ts has no such move):
// a review card's interval shrinks by its ease (down to 1 day), a card on its first review
// interval (1 day) drops back to learning, due today. Ease and lapses stay untouched.
export function sm2StepBack(card: Sm2Card, today: string): Sm2Card {
  if (card.state === 'new') return card;
  if (card.state === 'learning') return { ...card, step: Math.max(0, card.step - 1), due: today, lastReview: today };
  if (card.interval <= 1) return { ...card, state: 'learning', step: 0, due: today, lastReview: today };
  const interval = Math.max(1, Math.round(card.interval / card.ease));
  return { ...card, interval, due: addDays(today, interval), lastReview: today };
}

// Saves the counters and, when they say so, moves the word on the SRS ladder: forward = the same
// scheduler step as the main card's "Knew it" (sm2Review 'good'), back = sm2StepBack. A word that is
// not due can get a half too. A word with no card yet (never introduced) is left alone: returns null.
export async function recordPracticeResult(
  cardId: string,
  result: PracticeResult,
  today: string = localDateString()
): Promise<PracticeOutcome | null> {
  const db = getDb();
  const card = await db.getPcicCard(cardId);
  if (!card || card.state === 'new') return null;
  const outcome = applyPracticeResult({ halfSteps: card.halfSteps ?? 0, wrongStreak: card.wrongStreak ?? 0 }, result);
  const moved = outcome.srs === 'forward' ? sm2Review(card, 'good', today) : outcome.srs === 'back' ? sm2StepBack(card, today) : card;
  await db.upsertPcicCard({ ...moved, halfSteps: outcome.halfSteps, wrongStreak: outcome.wrongStreak });
  return outcome;
}
