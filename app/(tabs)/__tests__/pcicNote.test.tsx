// PLAN-fb0924 6. lépés (FB392/393): a ℹ️ gomb csak jegyzetes itemen jelenik
// meg, koppintásra ki/be nyitja a jegyzetet, kártyaváltáskor becsukódik.
// Mock-minta: app/(tabs)/__tests__/pcicFocus.test.tsx.

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

// Két tétel: az első id-je a VALÓDI notes.json-ban szerepel (a1-1b94c09a,
// haber), tehát a lib/pcicNotes.ts (nem mockolt) valódi jegyzetet talál
// hozzá; a második egy nem-létező, notes.json-ban nem szereplő id, tehát
// nincs jegyzete. (A jest.mock factory nem hivatkozhat külső változóra,
// ezért a két tétel itt, önmagában, kétszer van kiírva.)
jest.mock('@/data/pcic', () => {
  const items = [
    { id: 'a1-1b94c09a', es: 'haber', en: 'there is / there are', kind: 'word', section: 'Test', order: 0 },
    { id: 'a1-zzzzzzzz', es: 'mesa', en: 'table', kind: 'word', section: 'Test', order: 1 },
  ];
  return {
    PCIC_LEVELS: ['B1'],
    PCIC_VIEW_LEVELS: ['B1'],
    LEVEL_LABELS: { B1: 'Intermediate' },
    pcicItemsForLevel: () => items,
    pcicItemsForViewLevel: () => items,
    findPcicItem: (id: string) => items.find((i) => i.id === id),
    isPlusSentence: () => false,
    realLevelOfView: (level: string) => level,
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

describe('PCIC fül: ℹ️ jegyzet gomb (FB392/393)', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
    jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('jegyzetes itemen megjelenik a ℹ️ gomb, koppintásra kinyílik és becsukódik a jegyzet', async () => {
    const { getByTestId, queryByTestId } = render(<PcicScreen />);
    await flush();

    expect(getByTestId('pcic-note-toggle')).toBeTruthy();
    expect(queryByTestId('pcic-note-text')).toBeNull();

    fireEvent.press(getByTestId('pcic-note-toggle'));
    expect(getByTestId('pcic-note-text').props.children).toMatch(/haber/i);

    fireEvent.press(getByTestId('pcic-note-toggle'));
    expect(queryByTestId('pcic-note-text')).toBeNull();
  });

  it('jegyzet nélküli itemen NEM jelenik meg a ℹ️ gomb, és kártyaváltáskor a nyitott jegyzet becsukódik', async () => {
    const { getByTestId, getByText, queryByTestId, UNSAFE_getByType } = render(<PcicScreen />);
    await flush();

    // Nyissuk ki az 1. (jegyzetes) kártya jegyzetét.
    fireEvent.press(getByTestId('pcic-note-toggle'));
    expect(queryByTestId('pcic-note-text')).toBeTruthy();

    // Válaszoljunk és lépjünk tovább a 2. (jegyzet nélküli) kártyára.
    fireEvent.changeText(UNSAFE_getByType(TextInput), 'haber');
    fireEvent.press(getByText('✓ Check'));
    await flush();
    fireEvent.press(getByText('Knew it'));
    await flush();

    expect(queryByTestId('pcic-note-toggle')).toBeNull();
    expect(queryByTestId('pcic-note-text')).toBeNull();
  });
});
