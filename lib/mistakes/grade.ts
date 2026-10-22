// The one place a "My mistakes" card is graded: the SM-2 step (lib/sm2.ts) and its save in the card's own table. The
// deck's Knew it / Didn't know buttons (app/mistakes/deck.tsx) and the Sentences tab's mistake step
// (lib/sentenceMistakes.ts) both call this, so a card moves the same way wherever it was answered.

import { getDb } from '@/lib/database';
import { sm2Review, type Sm2Card, type Sm2Grade } from '@/lib/sm2';

/** Grades `card` today ('good' = knew it, 'again' = didn't know), saves it, returns the scheduled card. */
export async function gradeMistakeCard(card: Sm2Card, grade: Sm2Grade, today: string): Promise<Sm2Card> {
  const next = sm2Review(card, grade, today);
  await getDb().upsertMistakeCard(next);
  return next;
}
