// the A1 row of the level picker sheet
// with the exam row under it: closed shows how much is missing, open shows "Ready" + the saved result.

import { ScrollView } from 'react-native';
import { fireEvent, render, within } from '@testing-library/react-native';

import Colors from '@/constants/Colors';
import { setPcicTarget } from '@/data/pcic';
import { sm2NewCard } from '@/lib/sm2';
import type { ExamLevelStatus } from '@/lib/exam/unlock';
import LevelPickerSheet from '../LevelPickerSheet';

const base: ExamLevelStatus = { level: 'A1', total: 150, learned: 87, needed: 120, missing: 33, lessonDone: true, unlocked: false };

const renderSheet = (status?: ExamLevelStatus, handlers = { onStart: jest.fn(), onPractice: jest.fn(), onGrammar: jest.fn() }) =>
  render(
    <LevelPickerSheet
      visible
      active="A1"
      cards={[sm2NewCard('o1')]}
      colors={Colors.light}
      title="Level"
      target="es"
      exam={status ? { status, ...handlers } : undefined}
      onSelect={jest.fn()}
      onClose={jest.fn()}
    />,
  );

describe('LevelPickerSheet: exam row (A1)', () => {
  beforeEach(() => setPcicTarget('es'));

  it('locked: padlock, the number of missing words, and the button leads to word practice', () => {
    const handlers = { onStart: jest.fn(), onPractice: jest.fn(), onGrammar: jest.fn() };
    const { getByText, getByTestId, queryByText } = renderSheet(base, handlers);

    expect(getByText(/Level exam A1/)).toBeTruthy();
    expect(getByText(/🔒/)).toBeTruthy();
    expect(getByTestId('exam-row-words').props.children).toBe('87 / 120 words learned, 33 to go');
    expect(queryByText(/Ready/)).toBeNull();

    fireEvent.press(getByTestId('exam-row-A1'));
    expect(handlers.onPractice).toHaveBeenCalledTimes(1);
    expect(handlers.onStart).not.toHaveBeenCalled();
  });

  it('locked, at 79% (119 / 150): 1 more word is missing, no exam starts', () => {
    const handlers = { onStart: jest.fn(), onPractice: jest.fn(), onGrammar: jest.fn() };
    const { getByTestId } = renderSheet({ ...base, learned: 119, missing: 1 }, handlers);
    expect(getByTestId('exam-row-words').props.children).toBe('119 / 120 words learned, 1 to go');
    fireEvent.press(getByTestId('exam-row-A1'));
    expect(handlers.onStart).not.toHaveBeenCalled();
  });

  it('locked because the lesson is missing (the words are done): the lesson row shows, the button leads to the lessons', () => {
    const handlers = { onStart: jest.fn(), onPractice: jest.fn(), onGrammar: jest.fn() };
    const { getByTestId, queryByTestId } = renderSheet({ ...base, learned: 130, missing: 0, lessonDone: false }, handlers);
    expect(queryByTestId('exam-row-words')).toBeNull();
    expect(getByTestId('exam-row-lesson').props.children).toBe('Finish one A1 grammar lesson to unlock');
    fireEvent.press(getByTestId('exam-row-A1'));
    expect(handlers.onGrammar).toHaveBeenCalledTimes(1);
  });

  it('open: "Ready", no padlock, tapping starts the exam', () => {
    const handlers = { onStart: jest.fn(), onPractice: jest.fn(), onGrammar: jest.fn() };
    const open: ExamLevelStatus = { ...base, learned: 120, missing: 0, unlocked: true };
    const { getByTestId, queryByText, getByText } = renderSheet(open, handlers);

    expect(getByTestId('exam-row-ready').props.children).toEqual(['Ready', '']);
    expect(queryByText(/🔒/)).toBeNull();
    expect(getByText(/Start exam/)).toBeTruthy();

    fireEvent.press(getByTestId('exam-row-A1'));
    expect(handlers.onStart).toHaveBeenCalledTimes(1);
  });

  it('open, with an earlier result: whether passed and the best score show', () => {
    const passed = { passed: true, best: 92, bestAt: '2026-10-01', last: 80, lastAt: '2026-10-02' };
    const { getByTestId, rerender } = renderSheet({ ...base, learned: 120, missing: 0, unlocked: true, result: passed });
    expect(getByTestId('exam-row-ready').props.children).toEqual(['Ready', ' · Passed · best 92%']);

    rerender(
      <LevelPickerSheet
        visible
        active="A1"
        cards={[]}
        colors={Colors.light}
        title="Level"
        target="es"
        exam={{
          status: { ...base, learned: 120, missing: 0, unlocked: true, result: { ...passed, passed: false, best: 64 } },
          onStart: jest.fn(),
          onPractice: jest.fn(),
          onGrammar: jest.fn(),
        }}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(getByTestId('exam-row-ready').props.children).toEqual(['Ready', ' · Best 64%']);
  });

  it('without exam there is no exam row, and only under A1 (not on the other levels)', () => {
    const none = renderSheet(undefined);
    expect(none.queryByTestId('exam-row-A1')).toBeNull();
    none.unmount();

    const { getAllByTestId, queryByTestId } = renderSheet(base);
    expect(getAllByTestId('exam-row-A1')).toHaveLength(1);
    expect(queryByTestId('exam-row-A2')).toBeNull();
    expect(queryByTestId('exam-row-B1')).toBeNull();
  });

  it('step 4: every level A1-B2 has an exam row, and each starts with its own level', () => {
    const levels = ['A1', 'A2', 'B1', 'B2'] as const;
    const rows = levels.map((level) => ({
      status: { ...base, level, learned: 120, missing: 0, unlocked: true },
      onStart: jest.fn(),
      onPractice: jest.fn(),
      onGrammar: jest.fn(),
    }));
    const { getByTestId, getAllByText } = render(
      <LevelPickerSheet visible active="A1" cards={[]} colors={Colors.light} title="Level" target="es" exam={rows} onSelect={jest.fn()} onClose={jest.fn()} />,
    );
    expect(getAllByText(/Start exam/)).toHaveLength(4);
    levels.forEach((level, i) => {
      fireEvent.press(getByTestId(`exam-row-${level}`));
      expect(rows[i].onStart).toHaveBeenCalledTimes(1);
      rows.forEach((row, j) => j !== i && expect(row.onStart).not.toHaveBeenCalledTimes(2));
    });
    rows.forEach((row) => expect(row.onStart).toHaveBeenCalledTimes(1));
  });

  it('step 4: the level and exam rows are in a scrollable list, so the A1 row is not cut off even on a short phone', () => {
    const rows = (['A1', 'A2', 'B1', 'B2'] as const).map((level) => ({
      status: { ...base, level, learned: 120, missing: 0, unlocked: true },
      onStart: jest.fn(),
      onPractice: jest.fn(),
      onGrammar: jest.fn(),
    }));
    const { UNSAFE_getByType, getByText } = render(
      <LevelPickerSheet visible active="A1" cards={[]} colors={Colors.light} title="Level" target="es" exam={rows} onSelect={jest.fn()} onClose={jest.fn()} />,
    );
    const list = within(UNSAFE_getByType(ScrollView));
    for (const level of ['A1', 'A2', 'B1', 'B2']) expect(list.getByTestId(`exam-row-${level}`)).toBeTruthy();
    // The title stays outside the scrolled list.
    expect(getByText('Level')).toBeTruthy();
    expect(list.queryByText('Level')).toBeNull();
  });

  it('the UI never prints the DELE name', () => {
    const { toJSON } = renderSheet({ ...base, unlocked: true, learned: 120, missing: 0 });
    expect(JSON.stringify(toJSON())).not.toMatch(/DELE/i);
  });
});
