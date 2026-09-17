import { getDb } from '@/lib/database';
import { doneGrammarTopicProgress, GRAMMAR_PROGRESS_KEY } from '@/lib/grammar/syllabus';

// FB196 (moved from app/(tabs)/index.tsx, structural extraction only): az
// elvégzett nyelvtani leckék adják a feloldott szerkezeteket („legyen olyan
// hogy bizonyos nyelvtani szerkezeteket feloldunk"). D3 (FB290): egy téma
// csak akkor számít késznek, ha a leckéjében létező összes fajtájából van
// kész sor (doneGrammarTopicProgress, lib/grammar/syllabus.ts).
export async function doneGrammarTopics(learned: string): Promise<Set<string>> {
  const rows = await getDb().getGameProgress(GRAMMAR_PROGRESS_KEY);
  return new Set(doneGrammarTopicProgress(learned, rows).keys());
}
