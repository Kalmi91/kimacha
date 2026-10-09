// PLAN-fb1005i 2. lépés (FB498/FB500): kép egyes kártyákhoz, Wikimedia Commonsról, az appba csomagolva.
// A metaadat (szerző, licenc, forrás-URL) a data/words-open/images.json-ban van, kulcsa az `o<order>` kártya-id;
// a fájlok az assets/word-images/ alatt vannak. Metro csak statikus require-t tud, ezért a fájlnév -> forrás
// térkép itt kézzel van vezetve; a data/__tests__/wordImages.test.ts kapuja ellenőrzi, hogy a kettő egyezik.
import type { ImageSourcePropType } from 'react-native';
import imagesJson from '@/data/words-open/images.json';

type WordImageMeta = {
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
  // images.json `modified` szerint a kép vágott (a forrássor jelzi, CC BY / BY-SA módosítás-jelzés).
  cropped: boolean;
};

export const IMAGE_SOURCES: Record<string, ImageSourcePropType> = {
  'o2771.jpg': require('../assets/word-images/o2771.jpg'),
  'o1510.jpg': require('../assets/word-images/o1510.jpg'),
  'o938.jpg': require('../assets/word-images/o938.jpg'),
  'o939.jpg': require('../assets/word-images/o939.jpg'),
  'o945.jpg': require('../assets/word-images/o945.jpg'),
  'o1097.jpg': require('../assets/word-images/o1097.jpg'),
  'o1098.jpg': require('../assets/word-images/o1098.jpg'),
  'o1549.jpg': require('../assets/word-images/o1549.jpg'),
  'o1692.jpg': require('../assets/word-images/o1692.jpg'),
  'o1693.jpg': require('../assets/word-images/o1693.jpg'),
  'o1694.jpg': require('../assets/word-images/o1694.jpg'),
  'o1695.jpg': require('../assets/word-images/o1695.jpg'),
  'o2258.jpg': require('../assets/word-images/o2258.jpg'),
  'o2259.jpg': require('../assets/word-images/o2259.jpg'),
  'o2260.jpg': require('../assets/word-images/o2260.jpg'),
  'o2261.jpg': require('../assets/word-images/o2261.jpg'),
  'o2262.jpg': require('../assets/word-images/o2262.jpg'),
  'o2263.jpg': require('../assets/word-images/o2263.jpg'),
  'o2264.jpg': require('../assets/word-images/o2264.jpg'),
  'o2265.jpg': require('../assets/word-images/o2265.jpg'),
  'o2267.jpg': require('../assets/word-images/o2267.jpg'),
  'o2766.jpg': require('../assets/word-images/o2766.jpg'),
  'o2769.jpg': require('../assets/word-images/o2769.jpg'),
  'o2770.jpg': require('../assets/word-images/o2770.jpg'),
  'o2772.jpg': require('../assets/word-images/o2772.jpg'),
  'o2773.jpg': require('../assets/word-images/o2773.jpg'),
  'o2774.jpg': require('../assets/word-images/o2774.jpg'),
  'o2791.jpg': require('../assets/word-images/o2791.jpg'),
  'o2828.jpg': require('../assets/word-images/o2828.jpg'),
};

export const IMAGE_META = imagesJson as Record<string, WordImageMeta>;

// Egy kártya képe (kártya-id: `o<order>`), vagy undefined, ha nincs.
export function wordImageFor(cardId: string): WordImage | undefined {
  const meta = IMAGE_META[cardId];
  const source = meta && IMAGE_SOURCES[meta.file];
  if (!meta || !source) return undefined;
  return { source, width: meta.width, height: meta.height, author: meta.author, license: meta.license, sourceUrl: meta.sourceUrl, cropped: /cropped/i.test(meta.modified ?? '') };
}
