// PLAN-fb0924 7b. lépés (FB384, D4): egy PCIC-szó több, ÉRDEMBEN eltérő
// jelentése (nem szinonima) a duplikátum-egyesítés (scripts/pcic-dedup.mjs)
// után a megmaradó kártyán jelentés-listaként marad meg, hogy ne vesszen el
// az információ, amit a törölt ismétlés hordozott. Adat: data/pcic/senses.json.

import sensesRaw from '@/data/pcic/senses.json';

export interface PcicSense {
  en: string;
  es: string;
}

const SENSES = sensesRaw as Record<string, PcicSense[]>;

/** Az item jelentés-listája, vagy undefined, ha egy jelentésű (a legtöbb szó). */
export function sensesFor(itemId: string): PcicSense[] | undefined {
  return SENSES[itemId];
}
