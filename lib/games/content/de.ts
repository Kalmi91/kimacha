// Registration of the German lane's game content (es→de, en→de and hu→de: a Spanish, English or Hungarian
// native learns German). Same bundle pattern as `hu.ts`: `content.ts` only stitches them together.
// A new German lesson = one `data/games/grammar/de/<id>.json`, then `npm run gen:content` adds its line to
// `de.index.ts` (the lazy registry; its order is the syllabus order, data/grammar/syllabus-de.json).
// The lessons are explained in English and Spanish (the `en` / `es` of every text); the Hungarian sidecars
// (de.hu.index.ts, data/games/grammar-hu/de) are laid over each lesson as it loads. A German speaker never
// takes the German course (nobody learns German from German text), so there is no German sidecar.

import type { GrammarIndexEntry, GrammarTopicData, LanguageContentBundle } from '../content';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';
import { DE_GRAMMAR_INDEX } from './de.index';
import { DE_GRAMMAR_HU } from './de.hu.index';
import { withOverlayIndex } from '@/lib/grammar/overlay';

// Wrapped lessons: artikel-genus also carries every noun of the German deck as a der / die / das task
// (lib/grammar/nounArticles.ts). nounArticles is required here, not imported, so the deck JSON it reads
// stays unparsed until that lesson is first loaded.
const WRAPPERS: Record<string, (lesson: LessonV2) => LessonV2> = {
  'artikel-genus': (lesson) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nounArticles: typeof import('@/lib/grammar/nounArticles') = require('@/lib/grammar/nounArticles');
    return nounArticles.withArticleNounsDe(lesson);
  },
};

const grammarIndex: GrammarIndexEntry[] = withOverlayIndex(DE_GRAMMAR_INDEX, [{ lang: 'hu', sidecars: DE_GRAMMAR_HU }]).map((entry) => {
  const wrap = WRAPPERS[entry.id];
  return wrap ? { id: entry.id, load: () => wrap(entry.load() as LessonV2) as GrammarTopicData } : entry;
});

export const deContent: LanguageContentBundle = { grammarIndex };
