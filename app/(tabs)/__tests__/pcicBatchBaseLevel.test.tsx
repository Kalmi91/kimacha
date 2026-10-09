// User feedback ("the progress bar doesn't work here for some reason", A2): the batch base (batchBase) of the "+N new words" batch was
// a measurement valid for ONE LEVEL, but it also stayed in place after a level switch. After +15 on A1 (base = the cards
// the day had finished so far on A1), the progress bar on the other level stayed at 0% until more cards than the base
// had been finished there. Mock pattern: pcicMoreNewSteps.test.tsx.

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

describe('PCIC fül: a haladás-csík a másik szinten is halad (FB485)', () => {
  const today = localDateString();

  // The daily budget (10) is used up on A1: 10 words done today, the queue is empty, the "done for today" screen shows up.
  beforeEach(async () => {
    await getDb().resetPcicCards();
    await getDb().setPcicNewBonus(0, today);
    for (const item of mockA1Items.slice(0, 10)) await getDb().upsertPcicCard(sm2Review(sm2NewCard(item.id), 'good', today));
    await getDb().setPcicLevel('A1');
  });

  it('A1-en +15 után, a B1-re váltva az első kész kártya már mozdítja a csíkot', async () => {
    const { getByTestId, getByText } = render(<PcicScreen />);
    await flush();
    fireEvent.press(getByTestId('learn-more-new-15'));
    await flush();

    fireEvent.press(getByText('A1 ▾'));
    await flush();
    fireEvent.press(getByText('Intermediate'));
    await flush();
    expect(getByText('B1 ▾')).toBeTruthy();
    expect(StyleSheet.flatten(getByTestId('learn-progress-fill').props.style).width).toBe('0%');

    for (let i = 0; i < 5; i++) {
      fireEvent.press(getByText("Don't learn this"));
      await flush();
    }
    const width = StyleSheet.flatten(getByTestId('learn-progress-fill').props.style).width as string;
    // 5 done, 10 to go: 5 / (15 - 1).
    expect(parseFloat(width)).toBeCloseTo((5 / 14) * 100, 1);
  });

  it('a +N adag-alapja a saját szintjén megmarad: A1-en +15 után, A1-en maradva a csík 0%-ról indul', async () => {
    const { getByTestId } = render(<PcicScreen />);
    await flush();
    fireEvent.press(getByTestId('learn-more-new-15'));
    await flush();
    expect(StyleSheet.flatten(getByTestId('learn-progress-fill').props.style).width).toBe('0%');
  });
});
