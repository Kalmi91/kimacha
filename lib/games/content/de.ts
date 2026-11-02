// Registration of the German lane's game content (es→de, en→de and hu→de: a Spanish, English or Hungarian
// native learns German). Same bundle pattern as `hu.ts`: `content.ts` only stitches them together.
// A new German lesson = one `data/games/grammar/de/<id>.json`, then `npm run gen:content` adds its line to
// `de.index.ts` (the lazy registry; its order is the syllabus order, data/grammar/syllabus-de.json).
// The lessons are explained in English and Spanish (the `en` / `es` of every text); the Hungarian sidecars
// (de.hu.index.ts, data/games/grammar-hu/de) are laid over each lesson as it loads. A German speaker never
// takes the German course (nobody learns German from German text), so there is no German sidecar.

import type { LanguageContentBundle } from '../content';
import { DE_GRAMMAR_INDEX } from './de.index';
import { DE_GRAMMAR_HU } from './de.hu.index';
import { withOverlayIndex } from '@/lib/grammar/overlay';

export const deContent: LanguageContentBundle = {
  grammarIndex: withOverlayIndex(DE_GRAMMAR_INDEX, [{ lang: 'hu', sidecars: DE_GRAMMAR_HU }]),
};
