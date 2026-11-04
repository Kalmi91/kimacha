// FB561: the grammar lesson an (i) note links to. The link exists only where the lesson exists for the course language.
import { findPcicItem, setPcicTarget } from '@/data/pcic';
import notes from '@/data/words-open/notes.json';
import noteLessons from '@/data/words-open/note-lessons.json';
import { noteLessonFor } from '../noteLesson';
import { hasLesson } from '../syllabus';

describe('noteLessonFor', () => {
  beforeEach(() => setPcicTarget('es'));

  it('o436 (quizá / quizás / tal vez / acaso) carries the ojala-quizas lesson on its card', () => {
    const item = findPcicItem('o436');
    expect(item?.note).toContain('Four ways to say "maybe"');
    expect(item?.noteLesson).toBe('ojala-quizas');
  });

  it('gives the lesson id and its title in the language the lesson screen uses', () => {
    expect(noteLessonFor('ojala-quizas', 'es', 'en')).toEqual({ id: 'ojala-quizas', title: 'Ojalá, quizás, tal vez' });
    const hu = noteLessonFor('ojala-quizas', 'es', 'hu');
    expect(hu?.id).toBe('ojala-quizas');
    expect(hu?.title).toBeTruthy();
  });

  it('gives nothing for a direction whose course has no such lesson', () => {
    expect(hasLesson('en', 'ojala-quizas')).toBe(false);
    expect(noteLessonFor('ojala-quizas', 'en', 'es')).toBeUndefined();
  });

  it('gives nothing without an id or for an unknown id', () => {
    expect(noteLessonFor(undefined, 'es', 'en')).toBeUndefined();
    expect(noteLessonFor('no-such-topic', 'es', 'en')).toBeUndefined();
  });

  it('every entry of note-lessons.json is a card that has a note, and points to a written lesson', () => {
    const bad: string[] = [];
    for (const [id, topic] of Object.entries(noteLessons as Record<string, string>)) {
      if (!(id in notes)) bad.push(`${id}: no (i) note`);
      if (!hasLesson('es', topic)) bad.push(`${id}: lesson ${topic} is not written`);
      if (findPcicItem(id)?.noteLesson !== topic) bad.push(`${id}: the card does not carry the lesson`);
    }
    expect(bad).toEqual([]);
  });
});
