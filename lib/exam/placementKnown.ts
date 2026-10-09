// Words answered correctly in the placement test count as known and are left out of
// learning: the words-open card goes to SM-2 `review` state with the normal first interval
// (one "good" answer, as on the Learn tab). The card of a wrong or skipped word does not change; nor does
// it overwrite an already `review` card (the existing schedule knows more than a placement hit).

import { sm2NewCard, sm2Review, type Sm2Card } from '@/lib/sm2';

/** The cards to graduate: only those not yet in `review` state. */
export function graduateKnownWords(correctItemIds: Iterable<string>, cards: Sm2Card[], today: string): Sm2Card[] {
  const byId = new Map(cards.map((card) => [card.itemId, card]));
  const out: Sm2Card[] = [];
  for (const id of new Set(correctItemIds)) {
    const existing = byId.get(id);
    if (existing?.state === 'review') continue;
    out.push(sm2Review(existing ?? sm2NewCard(id), 'good', today));
  }
  return out;
}

type CardStore = {
  getPcicCards(): Promise<Sm2Card[]>;
  upsertPcicCard(card: Sm2Card): Promise<void>;
};

/** Saves the graduated cards; returns how many words became known. */
export async function saveKnownWords(store: CardStore, correctItemIds: Iterable<string>, today: string): Promise<number> {
  const graduated = graduateKnownWords(correctItemIds, await store.getPcicCards(), today);
  for (const card of graduated) await store.upsertPcicCard(card);
  return graduated.length;
}
