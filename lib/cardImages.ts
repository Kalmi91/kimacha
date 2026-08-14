// FB124/FB127, Kálmán 2026-08-14: "erről a szóról legyen egy kép, szedhetsz a
// netről is ... ami leírja, hogy ez mi". Some words cannot be translated into a
// picture in the learner's head from the gloss alone (a "tapa" is not a lid
// here), and an emoji is too coarse for them, so those cards carry a photo.
//
// Hand-kept list, like lib/cardIcons.ts: a photo is bundled only where it
// removes a real misunderstanding, never generated. To add one, drop a small
// (~300 px, < 100 kB) freely licensed image into assets/words/ and map the
// Spanish lemma to it below.
//
// Provenance of the bundled files (all public domain / CC0, no attribution
// required, but recorded so the source stays traceable):
//   tapa.jpg, Wikimedia Commons "Tapas at Casa Don Carlos 2025-10-01.jpg", CC0.

import type { ImageSourcePropType } from 'react-native';

export interface NamedWord {
  es?: string;
  [key: string]: unknown;
}

// Key = Spanish lemma with the article stripped.
const IMAGES: Record<string, ImageSourcePropType> = {
  tapa: require('../assets/words/tapa.jpg'),
  tapas: require('../assets/words/tapa.jpg'),
};

const strip = (value: string): string =>
  value
    .toLowerCase()
    .replace(/^(el|la|los|las|un|una|unos|unas)\s+/, '')
    .trim();

export function cardImage(word: NamedWord, targetLang: string): ImageSourcePropType | null {
  if (targetLang !== 'es') return null;
  return IMAGES[strip(String(word.es ?? ''))] ?? null;
}
