// The read-aloud text of the Spanish grammar lessons contains no Spanish words.
import fs from 'node:fs';
import path from 'node:path';

import { splitByMarkers } from '@/lib/mixedSpeech';
import type { LessonV2 } from '../lessonTypes';

const dir = path.join(__dirname, '../../../data/games/grammar/es');
const lessons: { name: string; lesson: LessonV2 }[] = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ name: f.replace('.json', ''), lesson: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as LessonV2 }));

describe('reading Spanish lessons aloud', () => {
  it('all 79 Spanish lessons are present', () => {
    expect(lessons).toHaveLength(79);
  });

  it.each(lessons.map((l) => [l.name, l.lesson] as const))('%s: no marked Spanish section, text exists in both languages', (_name, lesson) => {
    for (const lang of ['en', 'es'] as const) {
      const text = lesson.speak[lang];
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(80);
      expect(text).not.toMatch(/[«»]/);
    }
  });

  it.each(lessons.map((l) => [l.name, l.lesson] as const))('%s: the read-aloud is a single English section, without a word of the learned language (Spanish)', (_name, lesson) => {
    const segments = splitByMarkers(lesson.speak.en, { learnedLang: 'es', nativeLang: 'en' });
    expect(segments.every((s) => s.lang === 'en')).toBe(true);
    // there are no Spanish letters in the English text either
    expect(lesson.speak.en).not.toMatch(/[áéíóúñ¿¡]/i);
  });
});
