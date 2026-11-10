// Progress reset lives in Settings (moved
// from the Learn header): one row for every deck (level) that has progress, and one
// row for grammar; all with confirmation. Mock pattern: settingsBrutal.test.tsx.

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

import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

import { pcicItemsForLevel, setPcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { GRAMMAR_PROGRESS_KEY } from '@/lib/grammar/syllabus';
import { GRAMMAR_RANDOM_KEY } from '@/lib/grammar/randomRound';
import { buildLearnResume, loadLearnResume, saveLearnResume } from '@/lib/learnResume';
import { sentencePair } from '@/lib/sentenceCards';
import { LADDER_KEY, loadLadder, saveStage } from '@/lib/sentenceLadder';
import { sentenceKey } from '@/lib/sentenceTab';
import { sm2NewCard } from '@/lib/sm2';
import { ThemeProvider } from '@/lib/ThemeContext';
import SettingsScreen from '../../settings-data';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(30000);

const flush = makeFlush(8);

// the reset rows are in a collapsible section, which has to be opened first.
const openReset = (r: { getByText: (t: string) => unknown }) => fireEvent.press(r.getByText('🗑️ Restart progress') as never);

// Presses the destructive button of the confirming Alert (native branch).
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

describe('Settings: progress reset', () => {
  beforeEach(async () => {
    setPcicTarget('es');
    await getDb().setOnboarding('en', 'es');
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(GRAMMAR_PROGRESS_KEY);
    await getDb().resetGameProgress(GRAMMAR_RANDOM_KEY);
    await getDb().resetGameProgress(LADDER_KEY);
  });
  afterEach(() => jest.restoreAllMocks());

  it('no reset row without progress', async () => {
    const { queryByText } = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
    await flush();

    expect(queryByText(/Reset progress/)).toBeNull();
    expect(queryByText(/Reset grammar progress/)).toBeNull();
    expect(queryByText('🗑️ Restart progress')).toBeNull();
  });

  it('only a deck with progress gets a row, after confirmation it resets its own level', async () => {
    await seedCard('A1');
    await seedCard('B1');
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const r = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
    const { getByText, queryByText } = r;
    await flush();

    // closed, the rows are not visible, the section header is.
    expect(queryByText('🗑️ Reset progress (B1)')).toBeNull();
    openReset(r);
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

  // The Sentences tab's ladder: a level's learned sentences come back and none resumes mid-ladder (the other levels stay).
  it('resetting a level also clears the ladder rows of that level’s sentences, the other levels’ rows stay', async () => {
    const keyOf = (level: 'A1' | 'B1') => {
      const item = pcicItemsForLevel(level).find((i) => sentencePair(i, 'es') !== null);
      return sentenceKey(sentencePair(item!, 'es')!);
    };
    expect(keyOf('A1')).not.toBe(keyOf('B1'));
    await seedCard('A1');
    await seedCard('B1');
    await saveStage(getDb(), keyOf('A1'), 'learned');
    await saveStage(getDb(), keyOf('B1'), 3);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const r = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
    await flush();
    openReset(r);
    fireEvent.press(r.getByText('🗑️ Reset progress (A1)'));
    await confirmAlert(alertSpy);
    expect([...(await loadLadder(getDb()))]).toEqual([[keyOf('B1'), 3]]);
  });

  // the snapshot of the saved Learn round is no longer valid for the reset progress.
  it('resetting the deck also discards the saved Learn round snapshot', async () => {
    await seedCard('A1');
    await saveLearnResume(getDb(), buildLearnResume([sm2NewCard(pcicItemsForLevel('A1')[0].id)], '2026-10-05', 'A1', null));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const r = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
    await flush();
    openReset(r);
    fireEvent.press(r.getByText('🗑️ Reset progress (A1)'));
    await confirmAlert(alertSpy);
    expect(await loadLearnResume(getDb())).toBeNull();
  });

  it('without confirmation (Cancel) nothing is deleted', async () => {
    await seedCard('B1');
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const r = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
    const { getByText } = r;
    await flush();

    openReset(r);
    fireEvent.press(getByText('🗑️ Reset progress (B1)'));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect((await getDb().getPcicCards()).length).toBe(1);
  });

  it('the grammar row resets only the grammar progress, not the deck', async () => {
    await seedCard('B1');
    await getDb().setGameProgress(GRAMMAR_PROGRESS_KEY, 'presente-regular:form', 'done', { correct: 3, total: 3 });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const r = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
    const { getByText, queryByText } = r;
    await flush();

    openReset(r);
    fireEvent.press(getByText('🗑️ Reset grammar progress'));
    await confirmAlert(alertSpy);

    expect(await getDb().getGameProgress(GRAMMAR_PROGRESS_KEY)).toEqual([]);
    expect((await getDb().getPcicCards()).length).toBe(1);
    expect(queryByText('🗑️ Reset grammar progress')).toBeNull();
    expect(getByText('🗑️ Reset progress (B1)')).toBeTruthy();
  });

  // the random round's rows (test evidence, counter, open round) are grammar progress too.
  it('the grammar row also resets the random round rows, and shows up with only those', async () => {
    await getDb().setGameProgress(GRAMMAR_RANDOM_KEY, 'presente-regular', 'evidence', { answers: [] });
    await getDb().setGameProgress(GRAMMAR_RANDOM_KEY, '_meta', 'meta', { rounds: 2 });
    await getDb().setGameProgress(GRAMMAR_PROGRESS_KEY, 'presente-regular', 'done', { correct: 3, total: 3 });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const r = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
    await flush();

    openReset(r);
    fireEvent.press(r.getByText('🗑️ Reset grammar progress'));
    await confirmAlert(alertSpy);

    expect(await getDb().getGameProgress(GRAMMAR_PROGRESS_KEY)).toEqual([]);
    expect(await getDb().getGameProgress(GRAMMAR_RANDOM_KEY)).toEqual([]);
    expect(r.queryByText('🗑️ Reset grammar progress')).toBeNull();
  });

  it('only random round rows (no lesson progress) still give a grammar reset row', async () => {
    await getDb().setGameProgress(GRAMMAR_RANDOM_KEY, '_meta', 'meta', { rounds: 1 });
    const r = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
    await flush();

    openReset(r);
    expect(r.getByText('🗑️ Reset grammar progress')).toBeTruthy();
  });
});
