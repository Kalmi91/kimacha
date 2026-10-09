// The PCIC tab became direction-aware. This
// test covers the es→en direction: the prompt is the source (Spanish) field, the answer
// (grading + read-aloud) is the target-language (English) field - the mirror image of the
// en→es case in pcicSpeak.test.tsx. Mock pattern: app/(tabs)/__tests__/pcicSpeak.test.tsx.

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

// Same fixture shape as in pcicSpeak.test.tsx (both the es and en fields
// filled in); the direction decides which one is the prompt and which one is the answer.
const FIXTURE_ITEM = { id: 'a1-x1', es: 'vida', en: 'life', kind: 'word' as const, section: 'Test', order: 0 };
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['A1'],
  PCIC_VIEW_LEVELS: ['A1'],
  pcicItemsForLevel: () => [FIXTURE_ITEM],
  findPcicItem: (id: string) => (id === 'a1-x1' ? FIXTURE_ITEM : undefined),
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

describe('PCIC fül: es→en irány (PLAN-ketiranyu 4. lépés)', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
    await getDb().setOnboarding('es', 'en');
    mockSpeak.mockClear();
  });

  it('új lap megjelenésekor a spanyol promptot mondja ki (a kiinduló nyelv)', async () => {
    render(<PcicScreen />);
    await flush();

    expect(mockSpeak).toHaveBeenCalledWith('vida', 'es-MX');
  });

  it('felfedéskor angolul mondja ki a helyes (célnyelvi) alakot, "life"-ra bírál', async () => {
    const { UNSAFE_getByType, getByText } = render(<PcicScreen />);
    await flush();
    mockSpeak.mockClear();

    fireEvent.changeText(UNSAFE_getByType(TextInput), 'life');
    fireEvent.press(getByText('✓ Check'));
    await flush();

    expect(mockSpeak).toHaveBeenCalledWith('life', 'en-US');
  });

  // In a freshly switched direction where no level has been chosen yet
  // (db.hasPcicLevel() false), the main tab opens the level picker sheet by itself
  // instead of silently jumping to the fallback level.
  it('szint nélkül landolva (hasPcicLevel false) magától felnyílik a szint-választó lap', async () => {
    const { getByText } = render(<PcicScreen />);
    await flush();

    expect(getByText('Choose level')).toBeTruthy();
  });
});
