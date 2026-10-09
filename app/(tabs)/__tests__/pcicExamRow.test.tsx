// On the level picker sheet of the Learn tab,
// the exam row sits below the A1 row, computed from SM-2 data and finished lessons; tapping it
// leads to the exam (when open), to practicing the words, or to the grammar lessons. It runs against the real
// words-open corpus (data/pcic is not mocked). Mock pattern: pcicLevelPicker.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

import { act, fireEvent, render, within } from '@testing-library/react-native';

import { pcicItemsForLevel, setPcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { seedA1ExamState, seedExamState, a1SeedCards } from '@/lib/exam/devSeed';
import { EXAM_PROGRESS_KEY } from '@/lib/exam/result';
import { GRAMMAR_PROGRESS_KEY } from '@/lib/grammar/syllabus';
import PcicScreen from '../index';

jest.setTimeout(30000);

const flush = async (times = 8) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

// The sheet closes, and navigation only proceeds after the exit animation (SHEET_CLOSE_MS).
const afterSheetClose = async () => {
  await act(async () => {
    jest.advanceTimersByTime(600);
  });
  await flush();
};

// There is an exam row under every level A1-B2, so the level row labels have to be looked up per level.
const a1 = (screen: ReturnType<typeof render>) => within(screen.getByTestId('exam-row-A1'));

const openSheet = async () => {
  const screen = render(<PcicScreen />);
  await flush();
  fireEvent.press(screen.getByText('A1 ▾'));
  await flush();
  return screen;
};

describe('Learn tab: A1 exam row on the level picker sheet', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    mockPush.mockClear();
    setPcicTarget('es');
    await getDb().setOnboarding('en', 'es');
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(GRAMMAR_PROGRESS_KEY);
    await getDb().resetGameProgress(EXAM_PROGRESS_KEY);
    await getDb().setPcicLevel('A1');
  });
  afterEach(() => jest.useRealTimers());

  it('locked without progress: 0 / 80% of the level words, and tapping does not start an exam', async () => {
    const needed = Math.ceil(0.8 * pcicItemsForLevel('A1').length);
    const screen = await openSheet();
    expect(a1(screen).getByTestId('exam-row-words').props.children).toBe(`0 / ${needed} words learned, ${needed} to go`);
    expect(a1(screen).getByText(/Finish one A1 grammar lesson/)).toBeTruthy();

    // "Practice words": the sheet closes (the A1 deck stays), no exam starts.
    fireEvent.press(screen.getByTestId('exam-row-A1'));
    await flush();
    expect(screen.queryByTestId('exam-row-A1')).toBeNull();
    await afterSheetClose();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('locked just below 80% (by one), open at 80% with one finished lesson', async () => {
    const ids = pcicItemsForLevel('A1').map((i) => i.id);
    const needed = Math.ceil(0.8 * ids.length);
    for (const c of a1SeedCards(ids, '2026-10-01').slice(0, needed - 1)) await getDb().upsertPcicCard(c);
    await getDb().setGameProgress(GRAMMAR_PROGRESS_KEY, 'presente-regular', 'done', { correct: 1, total: 1 });
    let screen = await openSheet();
    expect(a1(screen).getByTestId('exam-row-words').props.children).toBe(`${needed - 1} / ${needed} words learned, 1 to go`);
    screen.unmount();

    for (const c of a1SeedCards(ids, '2026-10-01').slice(0, needed)) await getDb().upsertPcicCard(c);
    screen = await openSheet();
    expect(a1(screen).queryByTestId('exam-row-words')).toBeNull();
    expect(a1(screen).getByTestId('exam-row-ready')).toBeTruthy();
  });

  it('when open, tapping goes to the exam screen with the A1 level, and the sheet closes', async () => {
    await seedA1ExamState(getDb(), 'es', '2026-10-01');
    const screen = await openSheet();
    expect(a1(screen).getByTestId('exam-row-ready').props.children).toEqual(['Ready', '']);

    fireEvent.press(screen.getByTestId('exam-row-A1'));
    await flush();
    // The sheet closes FIRST, navigation only comes after that (otherwise the sheet stays above the exam).
    expect(screen.queryByTestId('exam-row-A1')).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
    await afterSheetClose();
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/exam', params: { level: 'A1' } });
    expect(screen.queryByTestId('exam-row-A1')).toBeNull();
  });

  it('step 4: every level A1-B2 has an exam row; the open A2-B2 starts with its own level', async () => {
    await seedExamState(getDb(), 'es', '2026-10-01');
    const screen = await openSheet();
    for (const level of ['A1', 'A2', 'B1', 'B2']) {
      expect(within(screen.getByTestId(`exam-row-${level}`)).getByTestId('exam-row-ready')).toBeTruthy();
    }

    fireEvent.press(screen.getByTestId('exam-row-B2'));
    await flush();
    await afterSheetClose();
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/exam', params: { level: 'B2' } });
  });

  it('step 4: the locked A2 row shows how much is missing, and "Practice words" opens the A2 deck', async () => {
    await seedA1ExamState(getDb(), 'es', '2026-10-01');
    const screen = await openSheet();
    expect(within(screen.getByTestId('exam-row-A2')).getByTestId('exam-row-words').props.children).toBe(
      `0 / ${Math.ceil(pcicItemsForLevel('A2').length * 0.8)} words learned, ${Math.ceil(pcicItemsForLevel('A2').length * 0.8)} to go`,
    );
    fireEvent.press(screen.getByTestId('exam-row-A2'));
    await flush();
    await afterSheetClose();
    expect(mockPush).not.toHaveBeenCalled();
    expect(await getDb().getPcicLevel()).toBe('A2');
  });

  it('the saved result (passed, best score) shows on the open row', async () => {
    await seedA1ExamState(getDb(), 'es', '2026-10-01');
    await getDb().saveExamResult('A1', 90, true, '2026-10-01');
    const screen = await openSheet();
    expect(a1(screen).getByTestId('exam-row-ready').props.children).toEqual(['Ready', ' · Passed · best 90%']);
  });

  it('if only the lesson is missing, tapping goes to the grammar lessons', async () => {
    const ids = pcicItemsForLevel('A1').map((i) => i.id);
    for (const c of a1SeedCards(ids, '2026-10-01')) await getDb().upsertPcicCard(c);
    const screen = await openSheet();
    expect(a1(screen).queryByTestId('exam-row-words')).toBeNull();

    fireEvent.press(screen.getByTestId('exam-row-A1'));
    await flush();
    expect(screen.queryByTestId('exam-row-A1')).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
    await afterSheetClose();
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/course');
  });
});
