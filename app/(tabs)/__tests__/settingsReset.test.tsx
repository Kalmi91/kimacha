// PLAN-fb1001 K1 + 7. lépés (FB431): a haladás-nullázás a Beállításokban él (a Learn
// fejlécből költözött): egy sor minden paklira (szintre), amin van haladás, és egy
// sor a nyelvtanra; mind megerősítéssel. Mock-minta: settingsBrutal.test.tsx.

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

import { pcicItemsForLevel, setPcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { GRAMMAR_PROGRESS_KEY } from '@/lib/grammar/syllabus';
import { sm2NewCard } from '@/lib/sm2';
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

// A megerősítő Alert destruktív gombját nyomja meg (natív ág).
const confirmAlert = async (alertSpy: jest.SpyInstance) => {
  const buttons = alertSpy.mock.calls[alertSpy.mock.calls.length - 1][2] ?? [];
  const yes = buttons.find((b: { style?: string }) => b.style === 'destructive');
  await act(async () => {
    yes?.onPress?.();
  });
  await flush();
};

const seedCard = async (level: 'A1' | 'B1') => {
  await getDb().upsertPcicCard(sm2NewCard(pcicItemsForLevel(level)[0].id));
};

describe('Beállítások: haladás nullázása (PLAN-fb1001 K1 + FB431)', () => {
  beforeEach(async () => {
    setPcicTarget('es');
    await getDb().setOnboarding('en', 'es');
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(GRAMMAR_PROGRESS_KEY);
  });
  afterEach(() => jest.restoreAllMocks());

  it('haladás nélkül nincs nullázó sor', async () => {
    const { queryByText } = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
    await flush();

    expect(queryByText(/Reset progress/)).toBeNull();
    expect(queryByText(/Reset grammar progress/)).toBeNull();
  });

  it('csak a haladásos pakli kap sort, megerősítés után a saját szintjét nullázza', async () => {
    await seedCard('A1');
    await seedCard('B1');
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText, queryByText } = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
    await flush();

    expect(queryByText('🗑️ Reset progress (A2)')).toBeNull();
    expect(getByText('🗑️ Reset progress (B1)')).toBeTruthy();
    fireEvent.press(getByText('🗑️ Reset progress (A1)'));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect((await getDb().getPcicCards()).length).toBe(2);

    await confirmAlert(alertSpy);
    const left = (await getDb().getPcicCards()).map((c) => c.itemId);
    expect(left).toEqual([pcicItemsForLevel('B1')[0].id]);
    expect(queryByText('🗑️ Reset progress (A1)')).toBeNull();
    expect(getByText('🗑️ Reset progress (B1)')).toBeTruthy();
  });

  it('megerősítés nélkül (Cancel) semmi nem törlődik', async () => {
    await seedCard('B1');
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText } = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
    await flush();

    fireEvent.press(getByText('🗑️ Reset progress (B1)'));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect((await getDb().getPcicCards()).length).toBe(1);
  });

  it('a nyelvtan-sor csak a nyelvtan-haladást nullázza, a paklit nem', async () => {
    await seedCard('B1');
    await getDb().setGameProgress(GRAMMAR_PROGRESS_KEY, 'presente-regular:form', 'done', { correct: 3, total: 3 });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText, queryByText } = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
    await flush();

    fireEvent.press(getByText('🗑️ Reset grammar progress'));
    await confirmAlert(alertSpy);

    expect(await getDb().getGameProgress(GRAMMAR_PROGRESS_KEY)).toEqual([]);
    expect((await getDb().getPcicCards()).length).toBe(1);
    expect(queryByText('🗑️ Reset grammar progress')).toBeNull();
    expect(getByText('🗑️ Reset progress (B1)')).toBeTruthy();
  });
});
