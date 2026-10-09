// The input field gets focus on every NEW PCIC page (the keyboard
// opens), but does not reopen after the reveal. Mock pattern:
// app/(tabs)/__tests__/pcicSpeak.test.tsx (the same effect drives both).

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
import PcicScreen from '../index';

const flush = async (times = 4) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('PCIC fül: a mező fókusza (FB391)', () => {
  let focusSpy: jest.SpyInstance;

  beforeEach(async () => {
    await getDb().resetPcicCards();
    focusSpy = jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => {});
  });

  afterEach(() => {
    focusSpy.mockRestore();
  });

  it('új lap megjelenésekor (mountkor) a mező fókuszt kap', async () => {
    render(<PcicScreen />);
    await flush();

    expect(focusSpy).toHaveBeenCalled();
  });

  it('felfedés (Check) után NEM kap újra fókuszt, amíg ugyanaz a lap van képernyőn', async () => {
    const { UNSAFE_getByType, getByText } = render(<PcicScreen />);
    await flush();
    const callsAfterMount = focusSpy.mock.calls.length;
    expect(callsAfterMount).toBeGreaterThan(0);

    fireEvent.changeText(UNSAFE_getByType(TextInput), 'vida');
    fireEvent.press(getByText('✓ Check'));
    await flush();

    expect(focusSpy.mock.calls.length).toBe(callsAfterMount);
  });
});
