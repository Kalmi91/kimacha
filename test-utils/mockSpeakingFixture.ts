// A speaking paper file for screen tests (the real ones, data/exams/mock/*-speaking.json, are written by the content step):
// two tasks, the second one follows the first. English words only, so that the scoring's sense check (known words) passes
// on the lexicon. Like test-utils/mockExamFixtures.ts it must not import the blueprint.

import type { AuthoredPaperFile, AuthoredTask, MockLevel, MockTarget } from '@/lib/exam/mock/types';

const first: AuthoredTask = {
  skill: 'speaking',
  kind: 'speaking',
  instruction: 'Talk about a topic. The examiner asks you questions.',
  prepSeconds: 90,
  talkMinutes: [2, 3],
  choices: [
    {
      id: 'a',
      title: 'A holiday',
      prompt: 'Talk about a holiday you remember. It can be a short trip.',
      bullets: ['where you went', 'who you went with'],
      input: 'A friend writes: I want to travel this summer.',
      // en-b1-9 is not in the photo register of the tests: a missing photo is skipped
      photos: ['en-b1-1', 'en-b1-9'],
      turns: [
        {
          id: 't1',
          ask: 'Where did you go last summer?',
          minWords: 8,
          points: [{ id: 'place', label: 'a place', keywords: ['park', 'beach', 'mountain', 'city'] }],
          model: 'Last summer I went to the beach with my family and we had a very good time there',
        },
        { id: 't2', ask: 'Did you like it?', minWords: 4, points: [], model: 'Yes I liked it very much' },
      ],
    },
    {
      id: 'b',
      title: 'A job',
      prompt: 'Talk about your work or your studies.',
      turns: [
        {
          id: 't1',
          ask: 'What do you do every day?',
          minWords: 5,
          points: [{ id: 'job', label: 'an activity', keywords: ['work', 'study', 'office', 'school'] }],
          model: 'I work in an office and I study at night',
        },
      ],
    },
  ],
};

const second: AuthoredTask = {
  skill: 'speaking',
  kind: 'speaking',
  instruction: 'Answer the questions about your topic.',
  talkMinutes: [1, 2],
  follows: 1,
  choices: [
    {
      id: 'a',
      title: 'More about the holiday',
      prompt: 'Talk more about your holiday.',
      turns: [{ id: 't1', ask: 'Would you go there again?', minWords: 4, points: [{ id: 'again', label: 'a wish', keywords: ['again', 'next', 'soon'] }], model: 'Yes I would go there again next summer' }],
    },
    {
      id: 'b',
      title: 'More about the job',
      prompt: 'Talk more about your work or your studies.',
      turns: [{ id: 't1', ask: 'Do you like your work?', minWords: 4, points: [{ id: 'like', label: 'an opinion', keywords: ['like', 'love', 'enjoy'] }], model: 'Yes I like my work very much' }],
    },
  ],
};

/** The speaking paper file of a level (one form, two tasks). */
export function speakingFile(target: MockTarget, level: MockLevel): AuthoredPaperFile {
  return { target, level, paper: 'speaking', forms: [{ id: 'f1', tasks: [first, second] }] };
}
