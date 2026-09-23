// PLAN-play 12. lépés (s5, Kálmán 2026-09-23): "Known" = a PCIC-tétel
// ismétlési ideje (interval) >= KNOWN_THRESHOLD_DAYS; "graduated" = túljutott
// a tanuló-lépéseken (state 'review', SM-2 "learning" fázison már túl van),
// de a küszöb alatt. Tiszta függvények a már betöltött Sm2Card[]-on, a
// lib/pcicLevels.ts mintáját követve (a hívó adja a kártyákat, itt csak szűrés).
//
// A kézzel "Ezt nem tanulom"-mal jelölt tételek (sm2MarkKnown, `known: true`)
// egyik számba sem mennek bele: azok nem repetíció útján lettek ismertek,
// hanem Kálmán mondta ki egyszer, hogy tudja őket.

import type { Sm2Card } from './sm2';

export const KNOWN_THRESHOLD_DAYS = 21;

function isGraduatedNaturally(card: Sm2Card): boolean {
  return card.state === 'review' && !card.known;
}

/** Túljutott a tanuló-lépéseken (state === 'review'), a kézzel "ismertnek"
 *  jelölt tételek nélkül. Tartalmazza a `countKnown` halmazát is. */
export function countGraduated(cards: Sm2Card[]): number {
  return cards.filter(isGraduatedNaturally).length;
}

/** A `thresholdDays` napos ismétlési időt (interval) elért, graduált tételek
 *  száma. */
export function countKnown(cards: Sm2Card[], thresholdDays: number = KNOWN_THRESHOLD_DAYS): number {
  return cards.filter((c) => isGraduatedNaturally(c) && c.interval >= thresholdDays).length;
}
