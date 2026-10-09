// a "kész mára" képernyőn +5 / +10 / +15 új szó gomb van (a +10 testID-ja: learn-more-new);
// minden gomb a napi kerethez ennyivel többet ad. Mock-minta: pcicNewBudgetLevels.test.tsx.

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

describe('PCIC fül: +5 / +10 / +15 új szó a "kész mára" képernyőn (FB449, FB451)', () => {
  const today = localDateString();

  // A napi keret (10) ki van merítve: ma 10 szó bevezetve és kész, a sor üres, a "kész mára" képernyő jön.
  beforeEach(async () => {
    await getDb().resetPcicCards();
    await getDb().setPcicNewBonus(0, today);
    for (const item of mockB1Items.slice(0, 10)) await getDb().upsertPcicCard(sm2Review(sm2NewCard(item.id), 'good', today));
    await getDb().setPcicLevel('B1');
  });

  it('a három gomb ott van a "kész mára" képernyőn', async () => {
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
  ])('%s: pontosan %i új szót ad a napi keretre', async (testID, n) => {
    const { getByTestId, getByText } = render(<PcicScreen />);
    await flush();
    fireEvent.press(getByTestId(testID));
    await flush();
    expect(getByText(`new ${n}`)).toBeTruthy();
    expect(await getDb().getPcicNewBonus(today)).toBe(n);
  });

  // User feedback ("nyomtam egy +15 szót és bebugosodott a csík"): a haladás-csík a +N után az ÚJ adagot méri,
  // az első új kártyánál üres (régen a nap eddigi 10 kész kártyájától 42%-ról indult).
  it.each([
    ['learn-more-new-5', 5],
    ['learn-more-new', 10],
    ['learn-more-new-15', 15],
  ])('%s: a haladás-csík 0%%-ról indul az új adagnál (FB456)', async (testID) => {
    const { getByTestId } = render(<PcicScreen />);
    await flush();
    fireEvent.press(getByTestId(testID));
    await flush();
    expect(StyleSheet.flatten(getByTestId('learn-progress-fill').props.style).width).toBe('0%');
  });
});
