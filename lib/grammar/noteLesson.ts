import { getGrammarTopicIds } from '@/lib/games/content';
import { syllabusTopic } from '@/lib/grammar/syllabus';

export interface NoteLesson {
  id: string;
  title: string;
}

/**
 * The grammar lesson the (i) note of a Learn card links to (FB561), or undefined when the card has no link
 * or the lesson is not written for the current direction (`target` = the course language, as in app/grammar/random.tsx).
 * The title is in the language the lesson screen shows it in (`contentLang`, English when that one has no title).
 */
export function noteLessonFor(topicId: string | undefined, target: string, contentLang: string): NoteLesson | undefined {
  // the id list only (no lesson JSON is loaded; on web the packs are fetched by the gate before the app mounts anyway)
  if (!topicId || !getGrammarTopicIds(target).includes(topicId)) return undefined;
  const entry = syllabusTopic(topicId, target);
  if (!entry) return undefined;
  return { id: topicId, title: entry.title[contentLang] ?? entry.title.en ?? topicId };
}
