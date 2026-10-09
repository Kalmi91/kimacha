// a spanyol nyelvtani leckék felolvasása spanyol szó nélkül szól.
import fs from 'node:fs';
import path from 'node:path';

import { splitByMarkers } from '@/lib/mixedSpeech';
import type { LessonV2 } from '../lessonTypes';

const dir = path.join(__dirname, '../../../data/games/grammar/es');
const lessons: { name: string; lesson: LessonV2 }[] = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ name: f.replace('.json', ''), lesson: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as LessonV2 }));

describe('spanyol leckék felolvasása (FB414)', () => {
  it('mind a 79 spanyol lecke megvan', () => {
    expect(lessons).toHaveLength(79);
  });

  it.each(lessons.map((l) => [l.name, l.lesson] as const))('%s: nincs jelölt spanyol szakasz, mind a négy nyelven van szöveg', (_name, lesson) => {
    for (const lang of ['hu', 'en', 'es', 'de'] as const) {
      const text = lesson.speak[lang];
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(80);
      expect(text).not.toMatch(/[«»]/);
    }
  });

  it.each(lessons.map((l) => [l.name, l.lesson] as const))('%s: a felolvasás egyetlen angol szakasz, a tanult nyelvű (spanyol) szó nélkül', (_name, lesson) => {
    const segments = splitByMarkers(lesson.speak.en, { learnedLang: 'es', nativeLang: 'en' });
    expect(segments.every((s) => s.lang === 'en')).toBe(true);
    // az angol szövegben sincs spanyol betű
    expect(lesson.speak.en).not.toMatch(/[áéíóúñ¿¡]/i);
  });
});
