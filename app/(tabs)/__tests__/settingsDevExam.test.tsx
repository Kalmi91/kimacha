// PLAN-vizsga A. szakasz 2. lépés (8. követelmény): a Settings alján egy csak __DEV__-ben
// látszó vezérlő beállít egy A1 állapotot (a szint kártyáinak 85%-a graduált + egy A1 lecke
// kész), hogy a vizsga a web-előnézetben végigkattintható legyen. Release-buildben
// (`__DEV__ === false`) nem jelenik meg. Mock-minta: settingsReset.test.tsx.

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

describe('Beállítások: __DEV__-only vizsga-vezérlő', () => {
  beforeEach(async () => {
    setPcicTarget('es');
    await getDb().setOnboarding('en', 'es');
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(GRAMMAR_PROGRESS_KEY);
  });
  afterEach(() => {
    g.__DEV__ = originalDev;
  });

  it('fejlesztői buildben látszik, és beállítja az A1 állapotot: a vizsga nyitva', async () => {
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

  it('release-buildben (__DEV__ === false) nem jelenik meg', async () => {
    g.__DEV__ = false;
    const { queryByTestId, queryByText } = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
    await flush();

    expect(queryByTestId('dev-seed-exam')).toBeNull();
    expect(queryByText(/DEV:/)).toBeNull();
  });
});
