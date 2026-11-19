// The English grammar course bands (target en): the core+ and core topics are pinned, every other English topic is
// 'exam', and every core topic of every level has the task types the content gate asks for (taskTypeGaps empty).

import { getGrammarTier, syllabusForLevel, syllabusLevels } from '../syllabus';
import { exemptErrors, taskTypeGaps } from '../taskTypes';

const CORE_PLUS = [
  'to_be',
  'present_simple',
  'present_continuous',
  'can_ability',
  'past_simple_regular',
  'past_simple_irregular',
  'going_to',
  'will',
  'present_perfect_vs_past',
  'first_conditional',
];
const CORE = [
  'basic_verbs',
  'articles',
  'plurals',
  'possessives',
  'there_is_are',
  'question_words',
  'present_perfect',
  'comparatives',
  'must_have_to',
  'past_continuous',
  'second_conditional',
  'modals_obligation_advice',
  'passive_voice',
  'third_conditional',
  'wish_if_only',
  'passive_advanced',
  'reporting_verbs',
  'discourse_markers',
];

const topics = () => syllabusLevels('en').flatMap((l) => syllabusForLevel(l, 'en'));

describe('English grammar bands (lang = en)', () => {
  it('pins the core+ and core topics, all of them in the English syllabus', () => {
    const ids = new Set(topics().map((t) => t.id));
    for (const id of CORE_PLUS) {
      expect(ids.has(id)).toBe(true);
      expect(getGrammarTier(id)).toBe('core-plus');
    }
    for (const id of CORE) {
      expect(ids.has(id)).toBe(true);
      expect(getGrammarTier(id)).toBe('core');
    }
  });

  it('every other English topic is exam', () => {
    for (const t of topics()) if (![...CORE_PLUS, ...CORE].includes(t.id)) expect(getGrammarTier(t.id)).toBe('exam');
  });

  it('has no task-type gap on any level, and the exempt list knows the English topic', () => {
    for (const level of syllabusLevels('en')) expect(taskTypeGaps(level, 'en')).toEqual([]);
    expect(exemptErrors()).toEqual([]);
  });
});
