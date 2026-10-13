// Registration of the English lane's game content (es→en direction: a Spanish native
// learns English). Same bundle pattern as `es.ts`: `content.ts` only stitches
// them together. A new English lesson = one `data/games/grammar/en/<id>.json`, then
// `npm run gen:content` adds its line to `en.index.ts` (the lazy registry; its order is the
// learning order). Topics that do not have a lesson yet get a
// "próximamente" badge on the Grammar tab.

import type { LanguageContentBundle } from '../content';
import { EN_GRAMMAR_INDEX } from './en.index';

export const enContent: LanguageContentBundle = { grammarIndex: EN_GRAMMAR_INDEX };
