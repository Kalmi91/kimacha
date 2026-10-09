// FB481/495/496/498 (PLAN-fb1005e): az (i) gomb a Learn-kártyán, csak magyarázatos (note) kártyán;
// koppintásra a magyarázat kinyílik, újra koppintásra becsukódik, kártyaváltáskor becsukva marad.
// Mock-minta: app/(tabs)/__tests__/pcicHint.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(cb, []);
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

// Két tétel: az 1. magyarázatos, a 2. nem.
jest.mock('@/data/pcic', () => {
  const items = [
    { id: 'o9001', es: 'la cena', en: 'dinner, supper', kind: 'word', section: '', order: 9001, note: 'Same meal, two English words.' },
    { id: 'o9002', es: 'la mesa', en: 'table', kind: 'word', section: '', order: 9002 },
  ];
  return {
    PCIC_LEVELS: ['B1'],
    PCIC_VIEW_LEVELS: ['B1'],
    pcicItemsForLevel: () => items,
    findPcicItem: (id: string) => items.find((i) => i.id === id),
    setPcicTarget: () => {},
  };
});

import { act, fireEvent, render } from '@testing-library/react-native';
import { TextInput } from 'react-native';

import { getDb } from '@/lib/database';
import PcicScreen from '../index';

const flush = async (times = 4) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const textOf = (node: unknown): string => {
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (node && typeof node === 'object' && 'props' in node) return textOf((node as { props: { children?: unknown } }).props.children);
  return '';
};

describe('PCIC fül: (i) magyarázat (FB481/495/496/498)', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
    jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('magyarázatos kártyán van (i), de a szöveg koppintásig zárva', async () => {
    const utils = render(<PcicScreen />);
    await flush();

    expect(utils.getByTestId('learn-info')).toBeTruthy();
    expect(utils.queryByTestId('learn-note')).toBeNull();
  });

  it('koppintásra látszik a magyarázat, újabb koppintásra becsukódik', async () => {
    const utils = render(<PcicScreen />);
    await flush();

    fireEvent.press(utils.getByTestId('learn-info'));
    expect(textOf(utils.getByTestId('learn-note').props.children)).toBe('Same meal, two English words.');

    fireEvent.press(utils.getByTestId('learn-info'));
    expect(utils.queryByTestId('learn-note')).toBeNull();
  });

  it('a megnyitott magyarázat a Check után is ott marad, a Check-sáv megmarad', async () => {
    const utils = render(<PcicScreen />);
    await flush();

    fireEvent.press(utils.getByTestId('learn-info'));
    fireEvent.changeText(utils.UNSAFE_getByType(TextInput), 'la cena');
    fireEvent.press(utils.getByText('✓ Check'));
    await flush();

    expect(utils.getByTestId('learn-note')).toBeTruthy();
    expect(utils.getByTestId('learn-dock')).toBeTruthy();
  });

  it('magyarázat nélküli kártyán nincs (i), és a következő kártyán a nyitott magyarázat nem marad', async () => {
    const utils = render(<PcicScreen />);
    await flush();

    fireEvent.press(utils.getByTestId('learn-info'));
    fireEvent.changeText(utils.UNSAFE_getByType(TextInput), 'la cena');
    fireEvent.press(utils.getByText('✓ Check'));
    await flush();
    fireEvent.press(utils.getByText('Knew it'));
    await flush();

    // 2. kártya: la mesa, nincs note.
    expect(utils.queryByTestId('learn-info')).toBeNull();
    expect(utils.queryByTestId('learn-note')).toBeNull();
  });
});
