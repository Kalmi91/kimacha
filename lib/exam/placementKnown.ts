// a szintfelmérőben helyesen megválaszolt
// szavak tudottnak számítanak, és kimaradnak a tanulásból: az adott words-open kártya SM-2
// `review` állapotba kerül, a normál első intervallummal (egy "good" válasz, mint a
// tanulófülön). A hibás vagy kihagyott szó kártyája nem változik; az már `review` kártyát
// sem írja át (a meglévő ütemezés többet tud, mint egy felmérő-találat).

import { sm2NewCard, sm2Review, type Sm2Card } from '@/lib/sm2';

/** A graduálandó kártyák: csak azok, amik még nem `review` állapotúak. */
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

/** Elmenti a graduált kártyákat; visszaadja, hány szó lett tudott. */
export async function saveKnownWords(store: CardStore, correctItemIds: Iterable<string>, today: string): Promise<number> {
  const graduated = graduateKnownWords(correctItemIds, await store.getPcicCards(), today);
  for (const card of graduated) await store.upsertPcicCard(card);
  return graduated.length;
}
