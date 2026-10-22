// The "Practice exam" card on the Stats tab offers B1, B2 and C1 too, in both directions, but only the levels that have
// content: a level whose papers are not (all) written yet is not shown, so no button is a dead end.
// The registry of the authored papers is replaced by one made of the engine's fixtures: es B1 and B2 are complete, es C1
// has only one of its three papers, en has B2 only.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: jest.fn() }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));

jest.mock('@/data/exams/mock', () => {
  const { fixturePapers } = require('@/test-utils/mockExamFixtures');
  return { MOCK_AUTHORED: [...fixturePapers('es', 'B1'), ...fixturePapers('es', 'B2'), ...fixturePapers('es', 'C1').slice(0, 1), ...fixturePapers('en', 'B2')] };
});

import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { getDb } from '@/lib/database';
import { MOCK_EXAM_PROGRESS_KEY } from '@/lib/exam/mock/session';
import { ThemeProvider } from '@/lib/ThemeContext';
import StatsScreen from '../stats';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(30000);

const flush = makeFlush(8);

const renderStats = async () => {
  const view = render(
    <ThemeProvider>
      <StatsScreen />
    </ThemeProvider>,
  );
  await flush();
  return view;
};

describe('Stats tab: Practice exam card, B1-C1', () => {
  beforeEach(async () => {
    mockPush.mockClear();
    await getDb().resetGameProgress(MOCK_EXAM_PROGRESS_KEY);
  });

  it('es direction: A1 to B2 have a button, C1 (one paper of three written) has none, the buttons wrap', async () => {
    await getDb().setOnboarding('en', 'es');
    const view = await renderStats();
    for (const level of ['A1', 'A2', 'B1', 'B2']) expect(view.getByTestId(`mock-exam-start-${level}`)).toBeTruthy();
    expect(view.queryByTestId('mock-exam-start-C1')).toBeNull();
    expect(StyleSheet.flatten(view.getByTestId('mock-exam-levels').props.style).flexWrap).toBe('wrap');
    fireEvent.press(view.getByTestId('mock-exam-start-B1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/mock-exam', params: { level: 'B1' } });
    fireEvent.press(view.getByTestId('mock-exam-start-B2'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/mock-exam', params: { level: 'B2' } });
    view.unmount();
  });

  it('es→en direction: A1, A2 and B2; B1 and C1 are not written, so they have no button', async () => {
    await getDb().setOnboarding('es', 'en');
    const view = await renderStats();
    for (const level of ['A1', 'A2', 'B2']) expect(view.getByTestId(`mock-exam-start-${level}`)).toBeTruthy();
    expect(view.queryByTestId('mock-exam-start-B1')).toBeNull();
    expect(view.queryByTestId('mock-exam-start-C1')).toBeNull();
    fireEvent.press(view.getByTestId('mock-exam-start-B2'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/mock-exam', params: { level: 'B2' } });
    expect(view.queryByText(/official/i)).toBeNull();
    view.unmount();
  });

  it('the latest result and the unfinished-exam marker show for the B levels too', async () => {
    await getDb().setOnboarding('en', 'es');
    await getDb().setGameProgress(MOCK_EXAM_PROGRESS_KEY, 'es-B1', 'passed', { passed: true, provisional: true, date: '2026-10-20', groups: [{ points: 35, needed: 30, of: 50 }] });
    await getDb().setGameProgress(MOCK_EXAM_PROGRESS_KEY, 'es-B2-session', 'open', { seed: 1, sig: 'x', done: ['reading'], answers: {} });
    const view = await renderStats();
    expect(view.getByTestId('mock-exam-status-B1').props.children).toBe('Last result B1: passed, 2026-10-20');
    expect(view.getByTestId('mock-exam-status-B2').props.children).toBe('B2 exam in progress');
    view.unmount();
  });
});
