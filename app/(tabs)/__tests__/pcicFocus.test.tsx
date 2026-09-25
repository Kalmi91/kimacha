// FB391: a beviteli mező fókuszt kap minden ÚJ PCIC-lapnál (kinyílik a
// billentyűzet), de a felfedés után nem nyílik újra. Mock-minta:
// app/(tabs)/__tests__/pcicSpeak.test.tsx (ugyanaz a FB319 effekt viszi mindkettőt).

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
const FIXTURE_ITEM = { id: 'b1-x1', es: 'vida', en: 'life', kind: 'word' as const, section: 'Test', order: 0 };
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['B1'],
  PCIC_VIEW_LEVELS: ['B1'],
  LEVEL_LABELS: { B1: 'Intermediate' },
  pcicItemsForLevel: () => [FIXTURE_ITEM],
  pcicItemsForViewLevel: () => [FIXTURE_ITEM],
  findPcicItem: (id: string) => (id === 'b1-x1' ? FIXTURE_ITEM : undefined),
  isPlusSentence: () => false,
  realLevelOfView: (level: string) => level,
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
