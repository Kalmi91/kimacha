// PLAN-nyelvtan-en 3-4. lépés: az angol tanterv (es→en irány) az angol
// témafából generálódik, a spanyol tanterv pedig bájtra változatlan marad.

import { createHash } from 'crypto';
import {
  GRAMMAR_SYLLABUS,
  GRAMMAR_UNITS,
  SYLLABUS_LEVELS,
  hasLesson,
  lessonCoverage,
  nextWrittenTopic,
  orphanLessons,
  syllabusForLevel,
  syllabusLevels,
  syllabusTopic,
  topicsForUnit,
  unitsForLevel,
} from '../syllabus';

// The B1 lessons written so far, in syllabus order (grows lesson by lesson).
const B1_WRITTEN: string[] = ['present_perfect_vs_past', 'present_perfect_continuous', 'past_continuous', 'past_perfect', 'used_to', 'will_vs_going_to', 'first_conditional', 'second_conditional', 'modals_obligation_advice', 'modals_deduction'];

describe('English grammar syllabus (lang = en)', () => {
  it('has the 36 grammar topics of the English topic tree, levels A1, A2 and B1', () => {
    expect(syllabusLevels('en')).toEqual(['A1', 'A2', 'B1']);
    expect(syllabusForLevel('A1', 'en')).toHaveLength(13);
    expect(syllabusForLevel('A2', 'en')).toHaveLength(8);
    expect(syllabusForLevel('B1', 'en')).toHaveLength(15);
    expect(lessonCoverage('en').planned).toBe(36);
  });

  it('opens A1 with basic_verbs, then the A1 topics in tree order', () => {
    const a1 = syllabusForLevel('A1', 'en').map((t) => t.id);
    expect(a1[0]).toBe('basic_verbs');
    expect(a1[1]).toBe('to_be');
    expect(syllabusTopic('basic_verbs', 'en')?.unit).toBe('A1.1');
  });

  it('groups topics into the sublevel units, each with a title in all four languages', () => {
    expect(unitsForLevel('A1', 'en').map((u) => u.id)).toEqual(['A1.1', 'A1.2', 'A1.3', 'A1.4', 'A1.5', 'A1.6']);
    expect(unitsForLevel('A2', 'en').map((u) => u.id)).toEqual(['A2.1', 'A2.2', 'A2.3', 'A2.4', 'A2.5']);
    // B1.1-B1.4 are vocabulary sublevels, only the grammar ones are units.
    expect(unitsForLevel('B1', 'en').map((u) => u.id)).toEqual(['B1.5', 'B1.6', 'B1.7', 'B1.8']);
    for (const lvl of syllabusLevels('en')) {
      for (const unit of unitsForLevel(lvl, 'en')) {
        expect(topicsForUnit(unit.id, 'en').length).toBeGreaterThan(0);
        for (const l of ['hu', 'en', 'es', 'de']) expect(unit.title[l]).toBeTruthy();
      }
      for (const topic of syllabusForLevel(lvl, 'en')) {
        for (const l of ['hu', 'en', 'es', 'de']) expect(topic.title[l]).toBeTruthy();
      }
    }
  });

  it('has only the lessons written so far, and nothing is orphaned', () => {
    expect(lessonCoverage('en').written).toBe(21 + B1_WRITTEN.length);
    expect(hasLesson('en', 'to_be')).toBe(true);
    expect(hasLesson('en', 'articles')).toBe(true);
    expect(hasLesson('en', 'present_simple')).toBe(true);
    expect(hasLesson('en', 'plurals')).toBe(true);
    expect(hasLesson('en', 'this_that')).toBe(true);
    expect(hasLesson('en', 'possessives')).toBe(true);
    expect(hasLesson('en', 'there_is_are')).toBe(true);
    expect(hasLesson('en', 'prepositions')).toBe(true);
    expect(hasLesson('en', 'have_got')).toBe(true);
    expect(hasLesson('en', 'can_ability')).toBe(true);
    expect(hasLesson('en', 'question_words')).toBe(true);
    expect(hasLesson('en', 'present_continuous')).toBe(true);
    expect(hasLesson('en', 'past_simple_regular')).toBe(true);
    expect(hasLesson('en', 'past_simple_irregular')).toBe(true);
    expect(hasLesson('en', 'going_to')).toBe(true);
    expect(hasLesson('en', 'will')).toBe(true);
    expect(hasLesson('en', 'present_perfect')).toBe(true);
    expect(hasLesson('en', 'comparatives')).toBe(true);
    expect(hasLesson('en', 'superlatives')).toBe(true);
    expect(hasLesson('en', 'must_have_to')).toBe(true);
    expect(hasLesson('en', 'basic_verbs')).toBe(true);
    expect(nextWrittenTopic('en', 'basic_verbs')?.id).toBe('to_be');
    expect(nextWrittenTopic('en', 'to_be')?.id).toBe('articles');
    expect(nextWrittenTopic('en', 'articles')?.id).toBe('present_simple');
    expect(nextWrittenTopic('en', 'present_simple')?.id).toBe('plurals');
    expect(nextWrittenTopic('en', 'plurals')?.id).toBe('this_that');
    expect(nextWrittenTopic('en', 'this_that')?.id).toBe('possessives');
    expect(nextWrittenTopic('en', 'possessives')?.id).toBe('there_is_are');
    expect(nextWrittenTopic('en', 'there_is_are')?.id).toBe('prepositions');
    expect(nextWrittenTopic('en', 'prepositions')?.id).toBe('have_got');
    expect(nextWrittenTopic('en', 'have_got')?.id).toBe('can_ability');
    expect(nextWrittenTopic('en', 'can_ability')?.id).toBe('question_words');
    expect(nextWrittenTopic('en', 'question_words')?.id).toBe('present_continuous');
    expect(nextWrittenTopic('en', 'present_continuous')?.id).toBe('past_simple_regular');
    expect(nextWrittenTopic('en', 'past_simple_regular')?.id).toBe('past_simple_irregular');
    expect(nextWrittenTopic('en', 'past_simple_irregular')?.id).toBe('going_to');
    expect(nextWrittenTopic('en', 'going_to')?.id).toBe('will');
    expect(nextWrittenTopic('en', 'will')?.id).toBe('present_perfect');
    expect(nextWrittenTopic('en', 'present_perfect')?.id).toBe('comparatives');
    expect(nextWrittenTopic('en', 'comparatives')?.id).toBe('superlatives');
    expect(nextWrittenTopic('en', 'superlatives')?.id).toBe('must_have_to');
    for (const id of B1_WRITTEN) expect(hasLesson('en', id)).toBe(true);
    const chain = ['must_have_to', ...B1_WRITTEN];
    chain.forEach((id, i) => expect(nextWrittenTopic('en', id)?.id).toBe(chain[i + 1]));
    expect(orphanLessons('en')).toEqual([]);
  });

  it('does not share topic ids with the Spanish syllabus', () => {
    const es = new Set(GRAMMAR_SYLLABUS.map((t) => t.id));
    for (const lvl of syllabusLevels('en')) {
      for (const t of syllabusForLevel(lvl, 'en')) expect(es.has(t.id)).toBe(false);
    }
  });
});

describe('Spanish grammar syllabus (default lang) is unchanged', () => {
  it('keeps its levels, size and content fingerprint', () => {
    expect(syllabusLevels()).toBe(SYLLABUS_LEVELS);
    expect(syllabusLevels('es')).toBe(SYLLABUS_LEVELS);
    expect(GRAMMAR_SYLLABUS).toHaveLength(SYLLABUS_LEVELS.reduce((n, l) => n + syllabusForLevel(l).length, 0));
    expect(lessonCoverage('es').planned).toBe(GRAMMAR_SYLLABUS.length);
    expect(syllabusTopic('presente-regular')?.level).toBe('A1');
    expect(syllabusTopic('to_be')).toBeUndefined();
    const fingerprint = createHash('sha1').update(JSON.stringify([GRAMMAR_UNITS, GRAMMAR_SYLLABUS])).digest('hex');
    expect({ units: GRAMMAR_UNITS.length, topics: GRAMMAR_SYLLABUS.length, fingerprint }).toEqual({
      units: 17,
      topics: 79,
      fingerprint: 'aa0d25fd61fca9334cebe3c2f4cbb276fbb6a000',
    });
  });
});
