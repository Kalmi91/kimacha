// Registration of the Hungarian lane's game content (es→hu and en→hu: a Spanish or English native
// learns Hungarian). Same bundle pattern as `en.ts`: `content.ts` only stitches them together.
// A new Hungarian lesson = one `data/games/grammar/hu/<id>.json`, then `npm run gen:content`
// adds its line to `hu.index.ts` (the lazy registry; its order is the learning order). The lessons
// have no Hungarian sidecar: nobody learns Hungarian from Hungarian text.

import type { LanguageContentBundle } from '../content';
import { HU_GRAMMAR_INDEX } from './hu.index';

export const huContent: LanguageContentBundle = { grammarIndex: HU_GRAMMAR_INDEX };
