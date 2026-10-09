import type { SkinId } from '@/constants/Skins';
import { useSkin } from '@/lib/useSkin';

import { bauhausDecor } from './bauhaus';
import { botanikusDecor } from './botanikus';
import { csillamponyDecor } from './csillampony';
import { decoDecor } from './deco';
import { diszlexiaDecor } from './diszlexia';
import { gamerDecor } from './gamer';
import { graffitiDecor } from './graffiti';
import { kalocsaiDecor } from './kalocsai';
import { kawaiiDecor } from './kawaii';
import { kodexDecor } from './kodex';
import { konnyuDecor } from './konnyu';
import { loteriaDecor } from './loteria';
import { memphisDecor } from './memphis';
import { plakatDecor } from './plakat';
import { popartDecor } from './popart';
import { retro95Decor } from './retro95';
import { seniorDecor } from './senior';
import { szecesszioDecor } from './szecesszio';
import { szocrealDecor } from './szocreal';
import type { SkinDecor } from './types';
import { ukiyoeDecor } from './ukiyoe';
import { y2kDecor } from './y2k';
import { zenDecor } from './zen';

export type { SkinDecor } from './types';

// A dísz-regiszter. Az első adag a 4 kezdő téma díszét tölti (deco, szocreal,
// csillampony, ukiyoe), a második a loteria, senior, konnyu, retro95, y2k, kawaii, gamer, botanikus, zen,
// a harmadik a diszlexia, plakat, bauhaus, popart, szecesszio, kalocsai, memphis, kodex, graffiti díszét.
// A brutal és a classic szándékosan dísz nélküli (no-op).
export const SKIN_DECOR: Partial<Record<SkinId, SkinDecor>> = {
  deco: decoDecor,
  szocreal: szocrealDecor,
  csillampony: csillamponyDecor,
  ukiyoe: ukiyoeDecor,
  loteria: loteriaDecor,
  senior: seniorDecor,
  konnyu: konnyuDecor,
  retro95: retro95Decor,
  y2k: y2kDecor,
  kawaii: kawaiiDecor,
  gamer: gamerDecor,
  botanikus: botanikusDecor,
  zen: zenDecor,
  diszlexia: diszlexiaDecor,
  plakat: plakatDecor,
  bauhaus: bauhausDecor,
  popart: popartDecor,
  szecesszio: szecesszioDecor,
  kalocsai: kalocsaiDecor,
  memphis: memphisDecor,
  kodex: kodexDecor,
  graffiti: graffitiDecor,
};

const NO_DECOR: SkinDecor = {};

export function decorFor(id: SkinId | 'none'): SkinDecor {
  return (id !== 'none' && SKIN_DECOR[id]) || NO_DECOR;
}

// Az aktív téma (mixnél a mix.decor) díszei.
export function useSkinDecor(): SkinDecor {
  return decorFor(useSkin().decorId);
}
