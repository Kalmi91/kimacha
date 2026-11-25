import { lessonFor } from '../syllabus';
import {
  answerFormCheck, formCheckCells, formCheckEnabled, freshFormCheckState,
  parseFormCheckState, startFormCheckPractice, type FormCheckState,
} from '../formCheck';

const lesson = lessonFor('es', 'indefinido-irregular')!;
const cells = formCheckCells(lesson);
const ids = cells.map((cell) => cell.id);
const practice = (count = 5): FormCheckState => startFormCheckPractice({
  ...freshFormCheckState(cells), phase: 'checkEnd', index: cells.length,
  wrong: cells.slice(0, count).map((cell) => ({ id: cell.id, typed: 'miss' })),
});

describe('verb form check', () => {
  it('enables only the first Spanish lesson', () => {
    expect(formCheckEnabled('indefinido-irregular', 'es')).toBe(true);
    expect(formCheckEnabled('indefinido-irregular', 'en')).toBe(false);
    expect(formCheckEnabled('ser-estar', 'es')).toBe(false);
  });

  it('extracts exactly 11 verbs × 5 persons in table order, never vosotros', () => {
    expect(cells).toHaveLength(55);
    expect(new Set(ids).size).toBe(55);
    expect(cells[0]).toMatchObject({ verb: 'tener', person: 'yo', answer: 'tuve' });
    const verbs = ['tener', 'estar', 'poder', 'hacer', 'poner', 'saber', 'venir', 'decir', 'ser', 'ir', 'dar'];
    expect(new Set(cells.map((cell) => cell.verb))).toEqual(new Set(verbs));
    for (const verb of verbs) {
      expect(cells.filter((cell) => cell.verb === verb).map((cell) => cell.person)).toEqual(['yo', 'tú', 'él/ella/usted', 'nosotros', 'ellos/ellas/ustedes']);
    }
    expect(cells.some((cell) => cell.person.includes('vosotros'))).toBe(false);
  });

  it('excludes meaning and person tables and absent lessons', () => {
    expect(formCheckCells(null)).toEqual([]);
    expect(formCheckCells(undefined)).toEqual([]);
    expect(formCheckCells(lessonFor('es', 'interrogativos'))).toEqual([]);
    const table = lesson.body.find((block) => block.kind === 'table')!;
    if (table.kind !== 'table') throw new Error('Expected a conjugation table');
    const personTable = { ...table, header: [{ en: 'Person', es: 'Persona' }, { en: 'Pronoun', es: 'Pronombre' }] };
    expect(formCheckCells({ ...lesson, body: [personTable] })).toEqual([]);
    expect(formCheckCells({ ...lesson, body: [{ ...table, rows: [['usted', 'tuvo', 'estuvo', 'pudo', 'hizo']] }] })).toEqual([]);
  });

  it('records only misses, preserves typed answers and reaches the check end', () => {
    let state = freshFormCheckState(cells);
    for (let i = 0; i < cells.length; i++) state = answerFormCheck(state, i !== 2 && i !== 5, i === 2 ? 'wrong' : '');
    expect(state.phase).toBe('checkEnd');
    expect(state.index).toBe(55);
    expect(state.wrong).toEqual([{ id: ids[2], typed: 'wrong' }, { id: ids[5], typed: '' }]);
    expect(answerFormCheck(state, true, '')).toBe(state);
    expect(startFormCheckPractice(freshFormCheckState(cells)).phase).toBe('check');
    const allKnown = { ...freshFormCheckState(cells), phase: 'checkEnd' as const, index: 55 };
    expect(startFormCheckPractice(allKnown)).toBe(allKnown);
    expect(answerFormCheck(freshFormCheckState([]), true, '')).toEqual(freshFormCheckState([]));
  });

  it.each([false, true])('puts a non-mastered answer (%s) after exactly three others', (correct) => {
    let state = practice();
    const initial = JSON.stringify(state);
    const next = answerFormCheck(state, correct, 'answer');
    expect(JSON.stringify(state)).toBe(initial);
    expect(next.queue).toEqual([ids[1], ids[2], ids[3], ids[0], ids[4]]);
    state = next;
    for (const id of ids.slice(1, 4)) {
      expect(state.queue[0]).toBe(id);
      state = answerFormCheck(state, true, 'right');
    }
    expect(state.queue[0]).toBe(ids[0]);
  });

  it('finishes a cell only after two consecutive right answers and resets on a miss', () => {
    let state = practice(1);
    state = answerFormCheck(state, true, 'right');
    expect(state.streaks[ids[0]]).toBe(1);
    expect(state.done).toEqual([]);
    state = answerFormCheck(state, false, 'wrong');
    expect(state.streaks[ids[0]]).toBe(0);
    state = answerFormCheck(state, true, 'right');
    expect(state.phase).toBe('practice');
    state = answerFormCheck(state, true, 'right');
    expect(state).toMatchObject({ phase: 'practiceEnd', queue: [], done: [ids[0]] });
    expect(answerFormCheck(state, true, '')).toBe(state);
  });

  it.each([1, 2, 3, 4])('uses the end when only %i cells remain', (count) => {
    const state = answerFormCheck(practice(count), false, 'wrong');
    expect(state.queue).toEqual([...ids.slice(1, count), ids[0]]);
  });

  it.each([undefined, null, 'bad', [], {}, { version: 2 }, { ...freshFormCheckState(cells), index: -1 }, { ...freshFormCheckState(cells), phase: 'oops' }])('resets garbage state %#', (raw) => {
    expect(parseFormCheckState(raw, cells)).toEqual(freshFormCheckState(cells));
  });

  it('resets a changed cell set, dropping obsolete ids and including new cells', () => {
    const changed = [...cells.slice(1), { id: 'new' }];
    const parsed = parseFormCheckState(practice(), changed);
    expect(parsed).toEqual(freshFormCheckState(changed));
    expect(parsed.order).not.toContain(ids[0]);
  });

  it('drops stale auxiliary ids without losing the valid practice queue', () => {
    const state = practice();
    const raw = { ...state, wrong: [...state.wrong, { id: 'stale', typed: 'x' }], queue: [...state.queue, 'stale'], done: ['obsolete'], streaks: { ...state.streaks, stale: 1 } };
    expect(parseFormCheckState(raw, cells)).toEqual(state);
  });

  it('restores check, practice, their checked answers and end states exactly', () => {
    const check = answerFormCheck(freshFormCheckState(cells), false, 'wrong');
    const active = answerFormCheck(practice(), true, 'right');
    const ended = answerFormCheck(answerFormCheck(practice(1), true, ''), true, '');
    for (const state of [check, active, ended, { ...check, result: { id: ids[1], typed: 'answer', correct: true } }, { ...active, result: { id: active.queue[0], typed: '', correct: false } }]) {
      expect(parseFormCheckState(JSON.parse(JSON.stringify(state)), cells)).toEqual(state);
    }
  });

  it('resets inconsistent indices, answers, queues and streaks', () => {
    const state = practice();
    const invalid = [
      { ...state, index: 2 }, { ...state, streaks: {} }, { ...state, queue: state.queue.slice(1) },
      { ...state, queue: [ids[0], ids[0]] }, { ...state, phase: 'practiceEnd' },
      { ...state, wrong: [{ id: ids[0], typed: 4 }] },
      { ...state, result: { id: ids[5], typed: 'wrong cell', correct: false } },
      { ...state, phase: ['practice'] },
      { ...freshFormCheckState(cells), phase: 'checkEnd', index: 55, result: { typed: '', correct: true } },
      { ...freshFormCheckState(cells), index: 55 },
      { ...freshFormCheckState(cells), wrong: [{ id: ids[0], typed: 'future' }] },
      { ...freshFormCheckState(cells), wrong: state.wrong, queue: state.queue, streaks: state.streaks },
    ];
    for (const raw of invalid) expect(parseFormCheckState(raw, cells)).toEqual(freshFormCheckState(cells));
  });
});
