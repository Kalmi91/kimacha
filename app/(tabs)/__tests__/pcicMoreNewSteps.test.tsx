// The "done for today" screen has +5 / +10 / +15 new word buttons (testID of +10: learn-more-new);
// each button adds that much to the daily budget. Mock pattern: pcicNewBudgetLevels.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

const mkItems = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `${prefix}-w${i}`,
    es: `${prefix}palabra${i}`,
    en: `${prefix}word${i}`,
    kind: 'word' as const,
    section: 'Test',
    order: i,
  }));
const mockA1Items = mkItems('a1', 50);
const mockB1Items = mkItems('b1', 100);
const mockItemsByLevel: Record<string, ReturnType<typeof mkItems>> = { A1: mockA1Items, B1: mockB1Items };
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['A1', 'B1'],
  PCIC_VIEW_LEVELS: ['A1', 'B1'],
  pcicItemsForLevel: (level: string) => mockItemsByLevel[level] ?? [],
  findPcicItem: (id: string) => [...mockA1Items, ...mockB1Items].find((i) => i.id === id),
  levelOfItem: (id: string) => (id.startsWith('a1-') ? 'A1' : id.startsWith('b1-') ? 'B1' : undefined),
  setPcicTarget: () => {},
}));

import { StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { sm2NewCard, sm2Review } from '@/lib/sm2';
import { localDateString } from '@/lib/usageStats';
import PcicScreen from '../index';

jest.setTimeout(30000);

const flush = async (times = 8) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('PCIC tab: +5 / +10 / +15 new words on the "done for today" screen', () => {
  const today = localDateString();

  // The daily budget (10) is used up: 10 words introduced and done today, the queue is empty, the "done for today" screen shows up.
  beforeEach(async () => {
    await getDb().resetPcicCards();
    await getDb().setPcicNewBonus(0, today);
    for (const item of mockB1Items.slice(0, 10)) await getDb().upsertPcicCard(sm2Review(sm2NewCard(item.id), 'good', today));
    await getDb().setPcicLevel('B1');
  });

  it('the three buttons are on the "done for today" screen', async () => {
    const { getByText, getByTestId } = render(<PcicScreen />);
    await flush();
    expect(getByText('Done for today')).toBeTruthy();
    expect(getByTestId('learn-more-new-5')).toBeTruthy();
    expect(getByTestId('learn-more-new')).toBeTruthy();
    expect(getByTestId('learn-more-new-15')).toBeTruthy();
  });

  it.each([
    ['learn-more-new-5', 5],
    ['learn-more-new', 10],
    ['learn-more-new-15', 15],
  ])('%s: gives exactly %i new words for the daily budget', async (testID, n) => {
    const { getByTestId, getByText } = render(<PcicScreen />);
    await flush();
    fireEvent.press(getByTestId(testID));
    await flush();
    expect(getByText(`new ${n}`)).toBeTruthy();
    expect(await getDb().getPcicNewBonus(today)).toBe(n);
  });

  // User feedback ("I pressed +15 words and the bar got buggy"): after +N the progress bar measures the NEW batch,
  // and is empty at the first new card (it used to start at 42% from the 10 cards the day had already finished).
  it.each([
    ['learn-more-new-5', 5],
    ['learn-more-new', 10],
    ['learn-more-new-15', 15],
  ])('%s: the progress bar starts from 0%% for the new batch', async (testID) => {
    const { getByTestId } = render(<PcicScreen />);
    await flush();
    fireEvent.press(getByTestId(testID));
    await flush();
    expect(StyleSheet.flatten(getByTestId('learn-progress-fill').props.style).width).toBe('0%');
  });
});
