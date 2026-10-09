// User feedback ("new 42?"): a napi új-szó keret NAPI; az A1-en vett "+10" bónuszok és az ott ma bevezetett
// szavak a másik szinten is számítanak, tehát a szintváltás után nem jön vissza a teljes bónuszos
// keret új szóként. Mock-minta: pcicLevelPicker.test.tsx.

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

import { act, render } from '@testing-library/react-native';

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

describe('PCIC fül: a napi új-szó keret szintek közt közös (FB452)', () => {
  const today = localDateString();

  beforeEach(async () => {
    await getDb().resetPcicCards();
    await getDb().setPcicNewBonus(0, today);
  });

  it('A1-en ma 40 szó bevezetve + 32 bónusz: a B1 fejléc nem 42, hanem a megmaradt 2 új szót mutatja', async () => {
    for (const item of mockA1Items.slice(0, 40)) await getDb().upsertPcicCard(sm2Review(sm2NewCard(item.id), 'good', today));
    await getDb().setPcicNewBonus(32, today);
    await getDb().setPcicLevel('B1');

    const { getByText, queryByText } = render(<PcicScreen />);
    await flush();

    expect(getByText('B1 ▾')).toBeTruthy();
    expect(getByText('new 2')).toBeTruthy();
    expect(queryByText('new 42')).toBeNull();
  });

  it('bónusz nélkül, másik szinten nem volt bevezetés: a szint a teljes napi keretet (10) kapja', async () => {
    await getDb().setPcicLevel('B1');
    const { getByText } = render(<PcicScreen />);
    await flush();
    expect(getByText('new 10')).toBeTruthy();
  });
});
