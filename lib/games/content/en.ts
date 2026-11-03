// Registration of the English lane's game content (es→en direction: a Spanish native
// learns English). Same bundle pattern as `es.ts`: `content.ts` only stitches
// them together. A new English lesson = one `data/games/grammar/en/<id>.json`, then
// `npm run gen:content` adds its line to `en.index.ts` (the lazy registry; its order is the
// learning order). Topics that do not have a lesson yet get a
// "próximamente" badge on the Grammar tab.

import type { LanguageContentBundle } from '../content';
import { EN_GRAMMAR_INDEX } from './en.index';
import { EN_GRAMMAR_HU } from './en.hu.index';
import { EN_GRAMMAR_DE } from './en.de.index';
import { withOverlayIndex } from '@/lib/grammar/overlay';

// The Hungarian and German sidecars (en.hu.index.ts, data/games/grammar-hu/en; en.de.index.ts, data/games/grammar-de/en)
// are laid over each lesson as it loads.
export const enContent: LanguageContentBundle = {
  grammarIndex: withOverlayIndex(EN_GRAMMAR_INDEX, [
    { lang: 'hu', sidecars: EN_GRAMMAR_HU },
    { lang: 'de', sidecars: EN_GRAMMAR_DE },
  ]),
};
