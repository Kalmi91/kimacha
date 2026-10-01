// PLAN-fb1001 K1: a haladás-nullázás a Beállításokban él (a Learn fejlécből
// költözött): megerősítés után hívja a resetPcicCards-ot az aktív szintre.
// Mock-minta: settingsBrutal.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn() }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(cb, []);
  },
}));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: '' } }));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-document-picker', () => ({}));

import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';
import SettingsScreen from '../settings';

jest.setTimeout(30000);

const flush = async () => {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('Beállítások: Haladás nullázása (PLAN-fb1001 K1)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('a sor kiírja a szintet, megerősítés után nullázza az aktív szintet', async () => {
    await getDb().setPcicLevel('B1');
    const resetSpy = jest.spyOn(getDb(), 'resetPcicCards').mockResolvedValue();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText } = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
    await flush();

    fireEvent.press(getByText('🗑️ Reset progress (B1)'));
    expect(resetSpy).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledTimes(1);

    const buttons = alertSpy.mock.calls[0][2] ?? [];
    const yes = buttons.find((b) => b.style === 'destructive');
    await act(async () => {
      yes?.onPress?.();
    });
    expect(resetSpy).toHaveBeenCalledWith('b1');
  });

  it('megerősítés nélkül (Cancel) nem nulláz', async () => {
    await getDb().setPcicLevel('B1');
    const resetSpy = jest.spyOn(getDb(), 'resetPcicCards').mockResolvedValue();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText } = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
    await flush();

    fireEvent.press(getByText('🗑️ Reset progress (B1)'));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(resetSpy).not.toHaveBeenCalled();
  });
});
