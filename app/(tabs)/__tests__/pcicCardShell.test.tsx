// 5b (döntés 5/6b): a PCIC fül átveszi a Learn kártya-felületét (CardShell,
// DockedAction). Kálmán 2026-09-21: felfedés után a régi Tudtam/Nem tudtam
// gombsor dönt a kártyában, nincs dokkolt Next. Mock-minta: pcicSpeak.test.tsx
// (db, router, speech, data/pcic).

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

// FB350: useDockLift (a PCIC dokkolt sávja) most useSafeAreaInsets-et hív, ami
// SafeAreaProvider nélkül dob; itt a mérete nem számít, csak ne dobjon.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

// Egy fix tétel, hogy a teszt ne a valódi PCIC-korpusztól függjön.
const FIXTURE_ITEM = { id: 'x1', es: 'vida', en: 'life', kind: 'word' as const, section: 'Test', order: 0 };
jest.mock('@/data/pcic', () => ({
  PCIC_ITEMS: [FIXTURE_ITEM],
  findPcicItem: (id: string) => (id === 'x1' ? FIXTURE_ITEM : undefined),
}));

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

describe('PCIC fül: Learn kártya-felület (5b)', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
  });

  it('a Learn CardShell chipjét (new) és a dokkolt Check gombot mutatja gépeléskor', async () => {
    const { getByText } = render(<PcicScreen />);
    await flush();

    expect(getByText('new')).toBeTruthy();
    expect(getByText('✓ Check')).toBeTruthy();
  });

  it('felfedés után a régi Tudtam/Nem tudtam gombok látszanak intervallum-előnézettel, dokkolt Next nélkül', async () => {
    const { getByText, queryByText, getAllByText, UNSAFE_getByType } = render(<PcicScreen />);
    await flush();

    fireEvent.changeText(UNSAFE_getByType(TextInput), 'vida');
    fireEvent.press(getByText('✓ Check'));
    await flush();

    expect(queryByText('→ Next')).toBeNull();
    expect(queryByText('✓ Check')).toBeNull();
    expect(getByText('Knew it')).toBeTruthy();
    expect(getByText("Didn't know")).toBeTruthy();
    expect(getAllByText('<1 day').length).toBe(2);
  });

  it('üres beküldés is felfedi a helyes alakot és a két gombot mutatja, a koppintás dönt', async () => {
    const { getByText, getAllByText, queryByText } = render(<PcicScreen />);
    await flush();

    fireEvent.press(getByText('✓ Check'));
    await flush();

    expect(queryByText('→ Next')).toBeNull();
    expect(getAllByText('vida').length).toBeGreaterThan(0);
    expect(getByText('Knew it')).toBeTruthy();
    expect(getByText("Didn't know")).toBeTruthy();

    fireEvent.press(getByText("Didn't know"));
    await flush();

    expect(getByText('✓ Check')).toBeTruthy();
  });
});
