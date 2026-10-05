// PLAN-fb1005i 2. lépés (FB498/FB500): kép egyes kártyákhoz, Wikimedia Commonsról, az appba csomagolva.
// A metaadat (szerző, licenc, forrás-URL) a data/words-open/images.json-ban van, kulcsa az `o<order>` kártya-id;
// a fájlok az assets/word-images/ alatt vannak. Metro csak statikus require-t tud, ezért a fájlnév -> forrás
// térkép itt kézzel van vezetve; a data/__tests__/wordImages.test.ts kapuja ellenőrzi, hogy a kettő egyezik.
import type { ImageSourcePropType } from 'react-native';
import imagesJson from '@/data/words-open/images.json';

export type WordImageMeta = {
  file: string;
  width: number;
  height: number;
  author: string;
  license: string;
  sourceUrl: string;
  modified?: string;
};

export type WordImage = {
  source: ImageSourcePropType;
  width: number;
  height: number;
  author: string;
  license: string;
  sourceUrl: string;
};

export const IMAGE_SOURCES: Record<string, ImageSourcePropType> = {
  'o2771.jpg': require('../assets/word-images/o2771.jpg'),
  'o1510.jpg': require('../assets/word-images/o1510.jpg'),
};

export const IMAGE_META = imagesJson as Record<string, WordImageMeta>;

// Egy kártya képe (kártya-id: `o<order>`), vagy undefined, ha nincs.
export function wordImageFor(cardId: string): WordImage | undefined {
  const meta = IMAGE_META[cardId];
  const source = meta && IMAGE_SOURCES[meta.file];
  if (!meta || !source) return undefined;
  return { source, width: meta.width, height: meta.height, author: meta.author, license: meta.license, sourceUrl: meta.sourceUrl };
}
