// The "Practice exam" card on the Stats tab for a learner of German, on the real registry of the authored papers: all five
// levels have a button (A1 / A2 are the speaking paper, B1 to C1 the four papers), whatever the learner's own language is,
// and the card does not call the exam official.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: jest.fn() }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));

import { fireEvent, render } from '@testing-library/react-native';

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

describe('Stats tab: Practice exam card, German', () => {
  beforeEach(async () => {
    mockPush.mockClear();
    await getDb().resetGameProgress(MOCK_EXAM_PROGRESS_KEY);
  });

  it.each(['en', 'es', 'hu'])('%s→de: A1 to C1 all have a button, and a press opens that level', async (source) => {
    await getDb().setOnboarding(source, 'de');
    const view = await renderStats();
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1']) expect(view.getByTestId(`mock-exam-start-${level}`)).toBeTruthy();
    fireEvent.press(view.getByTestId('mock-exam-start-C1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/mock-exam', params: { level: 'C1' } });
    fireEvent.press(view.getByTestId('mock-exam-start-A1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/mock-exam', params: { level: 'A1' } });
    expect(view.queryByText(/official/i)).toBeNull();
    view.unmount();
  });

  it('the latest German result and the unfinished-exam marker show on the card', async () => {
    await getDb().setOnboarding('en', 'de');
    await getDb().setGameProgress(MOCK_EXAM_PROGRESS_KEY, 'de-B1', 'passed', { passed: true, provisional: true, date: '2026-10-20', groups: [{ points: 70, needed: 60, of: 100 }] });
    await getDb().setGameProgress(MOCK_EXAM_PROGRESS_KEY, 'de-B2-session', 'open', { seed: 1, sig: 'x', done: ['reading'], answers: {} });
    const view = await renderStats();
    expect(view.getByTestId('mock-exam-status-B1').props.children).toBe('Last result B1: passed, 2026-10-20');
    expect(view.getByTestId('mock-exam-status-B2').props.children).toBe('B2 exam in progress');
    view.unmount();
  });
});
