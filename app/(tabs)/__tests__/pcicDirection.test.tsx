// PLAN-ketiranyu 4. lépés (2026-09-28): a PCIC fül irány-tudatos lett. Ez a
// teszt az es→en irányt fedi: a prompt a kiinduló (spanyol) mező, a válasz
// (bírálás + felolvasás) a célnyelvi (angol) mező - a pcicSpeak.test.tsx
// en→es esetének tükörképe. Mock-minta: app/(tabs)/__tests__/pcicSpeak.test.tsx.

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

// Ugyanaz a fixture-alak, mint pcicSpeak.test.tsx-ben (es/en mező egyaránt
// kitöltve); az irány dönti el, melyik a prompt és melyik a válasz.
const FIXTURE_ITEM = { id: 'a1-x1', es: 'vida', en: 'life', kind: 'word' as const, section: 'Test', order: 0 };
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['A1'],
  PCIC_VIEW_LEVELS: ['A1'],
  LEVEL_LABELS: { A1: 'Beginner' },
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

  // PLAN-ketiranyu 4. lépés javítás (2026-09-28 review, 2. pont): egy
  // frissen váltott irányban, ahol még sose választottak szintet
  // (db.hasPcicLevel() false), a főfül magától felnyitja a szint-választó
  // lapot, ahelyett hogy csendben a fallback szintre ugorna.
  it('szint nélkül landolva (hasPcicLevel false) magától felnyílik a szint-választó lap', async () => {
    const { getByText } = render(<PcicScreen />);
    await flush();

    expect(getByText('Choose level')).toBeTruthy();
  });
});
