// The Grammar tab's level percent counts the written lessons of a level; the level test asks the written lessons that
// have a usable question (a match card does not count). Both sets must be the same, or "all ticked" could never come.

import { buildLessonTest } from '@/lib/grammar/lessonTest';
import { hasLesson, lessonFor, syllabusForLevel, syllabusLevels } from '@/lib/grammar/syllabus';

jest.setTimeout(120000);

it.each(['es', 'en', 'hu', 'de'])('every written lesson of the %s course has a non-match question', (lang) => {
  const empty: string[] = [];
  for (const lvl of syllabusLevels(lang)) {
    for (const tp of syllabusForLevel(lvl, lang)) {
      if (!hasLesson(lang, tp.id)) continue;
      const contentLang = lang === 'en' ? 'es' : 'en';
      const lesson = lessonFor(lang, tp.id)!;
      const n = buildLessonTest(lesson, { seed: 1, learnedLang: lang, contentLang, size: 9999 }).filter((q) => q.kind !== 'match').length;
      if (n === 0) empty.push(tp.id);
    }
  }
  expect(empty).toEqual([]);
});
