import type { GapTask } from '../gapFill';
import { newPracticeRound, parsePracticeRound, restorePracticeRound, type PracticeRound } from '../practiceRound';

const task = (itemId: string): GapTask => ({ itemId, before: '', after: '.', answer: itemId, translation: 't', meaning: 'm' });
const TODAY = '2026-10-12';
const taskFor = (id: string) => (id === 'gone' ? null : task(id));

const round = (over: Partial<PracticeRound> = {}): PracticeRound => ({
  v: 1,
  date: TODAY,
  target: 'es',
  ids: ['a', 'b', 'c'],
  index: 1,
  results: ['right', null, null],
  ...over,
});

describe('newPracticeRound', () => {
  it('the task order as card ids, index 0, nothing answered', () => {
    expect(newPracticeRound([task('a'), task('b')], 'es', TODAY)).toEqual({
      v: 1, date: TODAY, target: 'es', ids: ['a', 'b'], index: 0, results: [null, null],
    });
  });
});

describe('parsePracticeRound', () => {
  it('reads back what JSON.stringify wrote', () => {
    expect(parsePracticeRound(JSON.stringify(round()))).toEqual(round());
  });

  it.each([
    ['null', null],
    ['empty', ''],
    ['not JSON', '{broken'],
    ['an array', '[]'],
    ['another version', JSON.stringify({ ...round(), v: 2 })],
    ['no date', JSON.stringify({ ...round(), date: 5 })],
    ['a bad direction', JSON.stringify({ ...round(), target: 'hu' })],
    ['no ids', JSON.stringify({ ...round(), ids: [], results: [] })],
    ['an id that is not a string', JSON.stringify({ ...round(), ids: ['a', 2, 'c'] })],
    ['an index past the end', JSON.stringify({ ...round(), index: 4 })],
    ['a negative index', JSON.stringify({ ...round(), index: -1 })],
    ['a results list of another length', JSON.stringify({ ...round(), results: ['right'] })],
    ['an unknown result', JSON.stringify({ ...round(), results: ['right', 'maybe', null] })],
  ])('%s: null', (_name, raw) => {
    expect(parsePracticeRound(raw)).toBeNull();
  });

  it('index = the number of tasks is fine (the round was over)', () => {
    expect(parsePracticeRound(JSON.stringify(round({ index: 3 })))).toMatchObject({ index: 3 });
  });
});

describe('restorePracticeRound', () => {
  it('the same day and direction: the saved order and results; a task answered right is moved past', () => {
    const r = restorePracticeRound(round(), TODAY, 'es', taskFor)!;
    expect(r.tasks.map((t) => t.itemId)).toEqual(['a', 'b', 'c']);
    expect(r.index).toBe(1);
    expect(r.results).toEqual(['right', null, null]);
    const right = restorePracticeRound(round({ index: 0 }), TODAY, 'es', taskFor)!;
    expect(right.index).toBe(1);
  });

  it('a task answered wrong stays the current one (it waits for Next)', () => {
    const r = restorePracticeRound(round({ index: 1, results: ['right', 'wrong', null] }), TODAY, 'es', taskFor)!;
    expect(r.index).toBe(1);
  });

  it('the last task answered right: the index is past the end (the round is over)', () => {
    const r = restorePracticeRound(round({ index: 2, results: ['right', 'wrong', 'right'] }), TODAY, 'es', taskFor)!;
    expect(r.index).toBe(3);
  });

  it('nothing saved, another day, another direction or a word without a task: null (a new round)', () => {
    expect(restorePracticeRound(null, TODAY, 'es', taskFor)).toBeNull();
    expect(restorePracticeRound(round({ date: '2026-10-11' }), TODAY, 'es', taskFor)).toBeNull();
    expect(restorePracticeRound(round(), TODAY, 'en', taskFor)).toBeNull();
    expect(restorePracticeRound(round({ ids: ['a', 'gone', 'c'] }), TODAY, 'es', taskFor)).toBeNull();
  });
});
