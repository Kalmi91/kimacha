// per-lesson content decisions from the feedback sheet.
//  - indefinido-imperfecto: no `form` drill ("ez a feladat típus ide nem kell")
//  - perfecto-vs-indefinido: no "Practice the words" deck and no matching drill
// The word deck is switched off by the lesson-level flag `noWordDeck`, only for that lesson.

import type { LessonV2 } from '../lessonTypes';
import { lessonFor } from '../syllabus';
import { grammarKindCounts } from '../../games/content';
import { WORD_DECK_MIN_CARDS, wordCellsForLesson } from '../tableDeck';

describe('indefinido-imperfecto (FB469)', () => {
  const lesson = lessonFor('es', 'indefinido-imperfecto')!;

  it('has no form items, so no form drill button', () => {
    expect(lesson.items.some((i) => i.kind === 'form')).toBe(false);
    expect(grammarKindCounts(lesson).form).toBe(0);
  });

  it('keeps its other drills', () => {
    const counts = grammarKindCounts(lesson);
    expect(counts.choice).toBeGreaterThan(0);
    expect(counts.match).toBeGreaterThan(0);
    expect(counts.why).toBeGreaterThan(0);
    expect(counts.transform).toBeGreaterThan(0);
  });
});

describe('perfecto-vs-indefinido (FB471, FB472)', () => {
  const lesson = lessonFor('es', 'perfecto-vs-indefinido')!;

  it('has no matching drill', () => {
    expect(lesson.items.some((i) => i.kind === 'match')).toBe(false);
    expect(grammarKindCounts(lesson).match).toBe(0);
  });

  it('is flagged noWordDeck and gives no "Practice the words" cards', () => {
    expect((lesson as LessonV2).noWordDeck).toBe(true);
    expect(wordCellsForLesson(lesson, 'es')).toEqual([]);
  });

  it('keeps its other drills', () => {
    const counts = grammarKindCounts(lesson);
    expect(counts.choice).toBeGreaterThan(0);
    expect(counts.why).toBeGreaterThan(0);
    expect(counts.transform).toBeGreaterThan(0);
  });
});

describe('noWordDeck flag', () => {
  it('switches the deck off for a lesson that would otherwise have one, and only for that lesson', () => {
    const lesson = lessonFor('es', 'clases-de-palabras') as LessonV2;
    expect(wordCellsForLesson(lesson, 'es').length).toBeGreaterThanOrEqual(WORD_DECK_MIN_CARDS);
    expect(wordCellsForLesson({ ...lesson, noWordDeck: true }, 'es')).toEqual([]);
    // the flag is not set on any other real lesson
    expect((lesson as LessonV2).noWordDeck).toBeUndefined();
  });
});
