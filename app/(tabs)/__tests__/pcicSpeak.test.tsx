// Automatic read-aloud on the PCIC tab. Mock pattern:
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
    useEffect(cb, []);
  },
}));

// useDockLift (the PCIC docked bar) now calls useSafeAreaInsets, which
// throws without a SafeAreaProvider; its size does not matter here, it just must not throw.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

// One fixed item, so the test does not depend on the real PCIC corpus.
// The id has a "b1-" prefix because lib/pcicLevels.ts decides the
// level filter from the id prefix (the tab starts at the B1 base level).
const FIXTURE_ITEM = { id: 'b1-x1', es: 'vida', en: 'life', kind: 'word' as const, section: 'Test', order: 0 };
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['B1'],
  PCIC_VIEW_LEVELS: ['B1'],
  pcicItemsForLevel: () => [FIXTURE_ITEM],
  findPcicItem: (id: string) => (id === 'b1-x1' ? FIXTURE_ITEM : undefined),
  setPcicTarget: () => {},
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
