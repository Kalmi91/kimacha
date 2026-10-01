// PLAN-vizsga E. szakasz (Kálmán E1 a): a Stats fül "Practice exam" kártyája a próbavizsga belépője.
// Szintenként egy gomb (mindkét irányban A1 és A2; az angol irányon a felirat nemzetközi mintát jelöl,
// nem hivatalosat), a gomb a /mock-exam képernyőre visz, alatta a legutóbbi eredmény
// vagy a félbehagyott vizsga jelzése. Mock-minta: statsBrutal.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: jest.fn() }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(cb, []);
  },
}));

import { act, fireEvent, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { MOCK_EXAM_PROGRESS_KEY } from '@/lib/exam/mock/session';
import { ThemeProvider } from '@/lib/ThemeContext';
import StatsScreen from '../stats';

jest.setTimeout(30000);

const flush = async (times = 8) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const renderStats = async () => {
  const view = render(
    <ThemeProvider>
      <StatsScreen />
    </ThemeProvider>,
  );
  await flush();
  return view;
};

describe('Stats fül: Practice exam kártya (E1 a)', () => {
  beforeEach(async () => {
    mockPush.mockClear();
    await getDb().resetGameProgress(MOCK_EXAM_PROGRESS_KEY);
  });

  it('es irány (en→es): A1 és A2 gomb, a gomb a próbavizsgára visz a szinttel', async () => {
    await getDb().setOnboarding('en', 'es');
    const view = await renderStats();
    expect(view.getByTestId('mock-exam-card')).toBeTruthy();
    expect(view.getByText('Practice exam')).toBeTruthy();
    expect(view.getByText('A full practice exam in the official format: reading, listening, writing and speaking.')).toBeTruthy();
    expect(view.getByTestId('mock-exam-start-A2')).toBeTruthy();
    fireEvent.press(view.getByTestId('mock-exam-start-A1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/mock-exam', params: { level: 'A1' } });
    view.unmount();
  });

  it('es→en irány: A1 és A2 gomb is, nemzetközi-minta felirattal (nem "official")', async () => {
    await getDb().setOnboarding('es', 'en');
    const view = await renderStats();
    expect(view.getByText('A full practice exam modelled on an international format: reading, listening, writing and speaking.')).toBeTruthy();
    expect(view.queryByText(/official/i)).toBeNull();
    fireEvent.press(view.getByTestId('mock-exam-start-A1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/mock-exam', params: { level: 'A1' } });
    fireEvent.press(view.getByTestId('mock-exam-start-A2'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/mock-exam', params: { level: 'A2' } });
    view.unmount();
  });

  it('a legutóbbi eredmény látszik a kártyán (szint, átment-e, dátum)', async () => {
    await getDb().setOnboarding('en', 'es');
    await getDb().setGameProgress(MOCK_EXAM_PROGRESS_KEY, 'es-A1', 'passed', {
      passed: true,
      provisional: true,
      date: '2026-10-01',
      groups: [{ points: 34, needed: 30, of: 50 }],
    });
    const view = await renderStats();
    expect(view.getByTestId('mock-exam-status-A1').props.children).toBe('Last result A1: passed, 2026-10-01');
    expect(view.queryByTestId('mock-exam-status-A2')).toBeNull();
    view.unmount();
  });

  it('a félbehagyott vizsgát jelzi a kártya', async () => {
    await getDb().setOnboarding('en', 'es');
    await getDb().setGameProgress(MOCK_EXAM_PROGRESS_KEY, 'es-A2-session', 'open', { seed: 1, sig: 'x', done: ['reading'], answers: {} });
    const view = await renderStats();
    expect(view.getByTestId('mock-exam-status-A2').props.children).toBe('A2 exam in progress');
    view.unmount();
  });
});
