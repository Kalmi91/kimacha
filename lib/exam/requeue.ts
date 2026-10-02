// PLAN-vizsga A. szakasz 5. lépés (2b, Kálmán, 2026-10-01): az elrontott SZÓ-tétel kártyája
// visszakerül az SM-2 ismétlésbe: `again` értékelést kap (azonnal esedékes, a tanulófül
// következő menetében előkerül), mintha a tanulófülön rontotta volna el. A8 a: az elrontott
// NYELVTANI tételnek nincs SM-2 kártyája, ott csak lecke-link jön az eredményen
// (lib/exam/skills.ts), ezért ez a modul a nyelvtani, olvasás- és szóbeli tételt nem érinti.

import { sm2Review, type Sm2Card } from '@/lib/sm2';
import type { ExamItemResult } from './types';

/** A hibásan megoldott szó-tételek kártya-azonosítói, egyszer-egyszer, a vizsga sorrendjében. */
export function wrongWordItemIds(results: ExamItemResult[]): string[] {
  const ids: string[] = [];
  for (const { item, correct } of results) {
    if (correct || item.skill !== 'words') continue;
    // A párosítás egy tétel: elrontva mind a négy szava visszamegy (a hibás párt a tétel nem különíti el).
    if (item.kind === 'match') ids.push(...item.itemIds);
    else if (item.kind === 'word_type' || item.kind === 'sent_order' || item.kind === 'sent_type') ids.push(item.itemId);
  }
  return Array.from(new Set(ids));
}

/**
 * A visszaküldendő kártyák: a hibás szavak meglévő SM-2 kártyája `again` értékeléssel, `today`-re
 * esedékesen. Amelyiknek nincs kártyája, azt kihagyja (vizsgába csak kártyás, tanult szó kerül).
 */
export function requeueWrongWords(cards: Sm2Card[], results: ExamItemResult[], today: string): Sm2Card[] {
  const byId = new Map(cards.map((c) => [c.itemId, c]));
  const out: Sm2Card[] = [];
  for (const id of wrongWordItemIds(results)) {
    const card = byId.get(id);
    if (card) out.push(sm2Review(card, 'again', today));
  }
  return out;
}
