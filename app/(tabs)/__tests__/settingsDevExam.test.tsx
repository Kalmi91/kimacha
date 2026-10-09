// A control at the bottom of Settings, visible only in __DEV__,
// sets up an A1 state (85% of the level's cards graduated + one A1 lesson
// done) so the exam can be clicked through in the web preview. It does not appear in a
// release build (`__DEV__ === false`). Mock pattern: settingsReset.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn() }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: '' } }));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-document-picker', () => ({}));

import { act, fireEvent, render } from '@testing-library/react-native';

import { setPcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { GRAMMAR_PROGRESS_KEY } from '@/lib/grammar/syllabus';
import { examStatusFor } from '@/lib/exam/unlock';
import { ThemeProvider } from '@/lib/ThemeContext';
import SettingsScreen from '../settings';

jest.setTimeout(30000);

const flush = async () => {
  for (let i = 0; i < 8; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const g = globalThis as unknown as { __DEV__: boolean };
const originalDev = g.__DEV__;

describe('Settings: __DEV__-only exam control', () => {
  beforeEach(async () => {
    setPcicTarget('es');
    await getDb().setOnboarding('en', 'es');
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(GRAMMAR_PROGRESS_KEY);
  });
  afterEach(() => {
    g.__DEV__ = originalDev;
  });

  it('shown in a dev build, and sets the A1 state: the exam is open', async () => {
    g.__DEV__ = true;
    const { getByTestId } = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
    await flush();

    const status = async () =>
      examStatusFor('A1', 'es', await getDb().getPcicCards(), await getDb().getGameProgress(GRAMMAR_PROGRESS_KEY));
    expect((await status()).unlocked).toBe(false);

    expect(getByTestId('dev-seed-exam').props.children).toBe('DEV: set up the exam state (A1-B2)');
    fireEvent.press(getByTestId('dev-seed-exam'));
    await flush();

    expect(await status()).toMatchObject({ unlocked: true, lessonDone: true, missing: 0 });
    expect(getByTestId('dev-seed-exam').props.children).toBe('DEV: exam state is set (A1-B2), open the level sheet');
  });

  it('not shown in a release build (__DEV__ === false)', async () => {
    g.__DEV__ = false;
    const { queryByTestId, queryByText } = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
    await flush();

    expect(queryByTestId('dev-seed-exam')).toBeNull();
    expect(queryByText(/DEV:/)).toBeNull();
  });
});
