// FB319/FB321: automatikus felolvasás a PCIC fülön. Mock-minta:
// app/grammar/__tests__/learnWordsButton.test.tsx (db, router, i18n).

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
import { speak } from '@/lib/speech';
import PcicScreen from '../index';

const mockSpeak = speak as jest.Mock;

const flush = async (times = 4) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('PCIC fül: automatikus felolvasás (FB319/FB321)', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
    mockSpeak.mockClear();
  });

  it('új lap megjelenésekor angolul mondja ki a promptot', async () => {
    render(<PcicScreen />);
    await flush();

    expect(mockSpeak).toHaveBeenCalledWith('life', 'en-US');
  });

  it('felfedéskor spanyolul mondja ki a helyes alakot', async () => {
    const { UNSAFE_getByType, getByText } = render(<PcicScreen />);
    await flush();
    mockSpeak.mockClear();

    fireEvent.changeText(UNSAFE_getByType(TextInput), 'vida');
    fireEvent.press(getByText('✓ Check'));
    await flush();

    expect(mockSpeak).toHaveBeenCalledWith('vida', 'es-MX');
  });
});
