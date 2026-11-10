// The mock exam's grammar evidence (lib/exam/mock/evidence.ts): a tagged and answered cloze gap / transform item is one
// answer, its `ok` follows the scoring; untagged and unanswered ones are none.

import { mockExamAnswers } from '@/lib/exam/mock/evidence';
import { scoreMockExam } from '@/lib/exam/mock/score';
import type { MockAnswers, MockExam, MockTask } from '@/lib/exam/mock/types';

const cloze = {
  id: 'reading-1',
  skill: 'reading',
  kind: 'cloze',
  instruction: 'TAREA 1.',
  text: 'a {{1}} b {{2}} c {{3}} d {{4}}',
  gaps: [
    { options: ['x', 'y', 'z'], correct: 0, topic: 'presente-regular' },
    { options: ['x', 'y', 'z'], correct: 1, topic: 'imperfecto' },
    { options: ['x', 'y', 'z'], correct: 2 },
    { answers: ['hablo', 'hablé'], topic: 'indefinido-regular' },
  ],
} as unknown as MockTask;

const transform = {
  id: 'reading-2',
  skill: 'reading',
  kind: 'transform',
  instruction: 'TAREA 2.',
  items: [
    { first: 'a', key: 'k', before: 'b', after: 'c', answers: ['uno'], topic: 'perfecto' },
    { first: 'a', key: 'k', before: 'b', after: 'c', answers: ['dos'] },
  ],
} as unknown as MockTask;

const exam = {
  target: 'es',
  level: 'B1',
  seed: 42,
  official: true,
  papers: [{ id: 'reading', name: 'Lectura', minutes: 60, points: 25, tasks: [cloze, transform] }],
  skillNames: {},
  rule: { kind: 'total', pass: 0.6 },
} as unknown as MockExam;

const answersOf = (a: MockAnswers) => mockExamAnswers(exam, scoreMockExam(exam, a), a);

describe('mockExamAnswers', () => {
  it('a tagged and answered gap / item is one answer; ok follows the scoring', () => {
    const out = answersOf({
      'reading-1': { '0': 0, '1': 0, '3': 'hablé' },
      'reading-2': { '0': 'tres', '1': 'dos' },
    });
    expect(out).toEqual([
      { topicId: 'presente-regular', id: 'exam:M42:reading-1#1', kind: 'cloze', ok: true },
      { topicId: 'imperfecto', id: 'exam:M42:reading-1#2', kind: 'cloze', ok: false },
      { topicId: 'indefinido-regular', id: 'exam:M42:reading-1#4', kind: 'cloze', ok: true },
      { topicId: 'perfecto', id: 'exam:M42:reading-2#1', kind: 'transform', ok: false },
    ]);
  });

  it('an untagged gap gives none, even when answered', () => {
    const out = answersOf({ 'reading-1': { '2': 2 }, 'reading-2': { '1': 'dos' } });
    expect(out).toEqual([]);
  });

  it('an unanswered or empty gap gives none', () => {
    expect(answersOf({})).toEqual([]);
    expect(answersOf({ 'reading-1': { '3': '   ' }, 'reading-2': { '0': '' } })).toEqual([]);
  });

  it('a right transform answer is ok', () => {
    const out = answersOf({ 'reading-2': { '0': 'uno' } });
    expect(out).toEqual([{ topicId: 'perfecto', id: 'exam:M42:reading-2#1', kind: 'transform', ok: true }]);
  });
});
