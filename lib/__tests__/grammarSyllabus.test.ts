// The grammar course's map: it has to cover the whole language, be internally
// consistent, and never lose an authored lesson.

jest.mock('../database', () => jest.requireActual('../database.web'));

import {
  GRAMMAR_SYLLABUS,
  GRAMMAR_UNITS,
  SYLLABUS_LEVELS,
  hasLesson,
  lessonCoverage,
  lessonFor,
  orphanLessons,
  syllabusForLevel,
  topicsForUnit,
  unitsForLevel,
} from '../grammar/syllabus';

describe('grammar syllabus map', () => {
  it('covers every level from A1 to C1', () => {
    for (const level of SYLLABUS_LEVELS) {
      expect(syllabusForLevel(level).length).toBeGreaterThan(0);
      expect(unitsForLevel(level).length).toBeGreaterThan(0);
    }
  });

  it('teaches the tenses the course was missing (past and future)', () => {
    const ids = GRAMMAR_SYLLABUS.map((t) => t.id);
    for (const must of [
      'indefinido-regular',
      'indefinido-irregular',
      'imperfecto',
      'indefinido-imperfecto',
      'perfecto',
      'pluscuamperfecto',
      'futuro-simple',
      'ir-a-infinitivo',
      'condicional-simple',
      'subjuntivo-presente-forma',
      'imperativo-afirmativo',
      'imperativo-negativo',
    ]) {
      expect(ids).toContain(must);
    }
  });

  it('has unique ids and a real unit for every topic', () => {
    const ids = GRAMMAR_SYLLABUS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const unitIds = new Set(GRAMMAR_UNITS.map((u) => u.id));
    for (const topic of GRAMMAR_SYLLABUS) {
      expect(unitIds.has(topic.unit)).toBe(true);
      const unit = GRAMMAR_UNITS.find((u) => u.id === topic.unit)!;
      expect(unit.level).toBe(topic.level); // a topic cannot sit in another level's unit
    }
  });

  it('names every topic and unit in all four languages', () => {
    for (const lang of ['hu', 'en', 'es', 'de']) {
      for (const topic of GRAMMAR_SYLLABUS) {
        expect(topic.title[lang]).toBeTruthy();
        expect(topic.blurb[lang]).toBeTruthy();
      }
      for (const unit of GRAMMAR_UNITS) {
        expect(unit.title[lang]).toBeTruthy();
      }
    }
  });

  it('has no empty unit', () => {
    for (const unit of GRAMMAR_UNITS) {
      expect(topicsForUnit(unit.id).length).toBeGreaterThan(0);
    }
  });

  it('never leaves an authored lesson off the map', () => {
    // A lesson missing from the syllabus would be unreachable from the course.
    expect(orphanLessons('es')).toEqual([]);
  });

  it('reports coverage honestly', () => {
    const { written, planned } = lessonCoverage('es');
    expect(planned).toBe(GRAMMAR_SYLLABUS.length);
    expect(written).toBeGreaterThan(0);
    expect(written).toBeLessThanOrEqual(planned);
    // Everything counted as written must actually load.
    for (const topic of GRAMMAR_SYLLABUS) {
      if (hasLesson('es', topic.id)) {
        const lesson = lessonFor('es', topic.id)!;
        expect(lesson.topic).toBe(topic.id);
        expect(lesson.items.length).toBeGreaterThan(0);
      }
    }
  });

  it('places each lesson at the level the syllabus claims', () => {
    for (const topic of GRAMMAR_SYLLABUS) {
      const lesson = lessonFor('es', topic.id);
      if (lesson) expect(lesson.level).toBe(topic.level);
    }
  });
});
