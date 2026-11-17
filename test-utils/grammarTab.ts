import { grammarTabLevelKey } from '@/lib/grammar/levelTestRoute';
import { saveResumeValue } from '@/lib/resumeStore';

// The Grammar tab keeps the learner's level pick per language pair (lib/grammar/levelTestRoute.ts), so a test that
// presses a level button would leak the pick into the next test. A beforeEach clears every pair.
const LANGS = ['en', 'es', 'hu', 'de'];

export async function resetGrammarTabLevel(db: Parameters<typeof saveResumeValue>[0]): Promise<void> {
  for (const from of LANGS) for (const to of LANGS) await saveResumeValue(db, grammarTabLevelKey(`${from}→${to}`), null);
}
