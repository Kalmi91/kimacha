// 5b (döntés 5/6b): a PCIC fül átveszi a Learn kártya-felületét (CardShell,
// DockedAction). Felfedés
// után a dokkolt sáv "Next"-re vált (a javasolt értékeléssel a feliratban),
// a régi Tudtam/Nem tudtam gombsor a kártyában felülbírálásra marad. Mock-minta:
// pcicSpeak.test.tsx (db, router, speech, data/pcic).

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

// useDockLift (a PCIC dokkolt sávja) most useSafeAreaInsets-et hív, ami
// SafeAreaProvider nélkül dob; itt a mérete nem számít, csak ne dobjon.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

// Egy fix tétel, hogy a teszt ne a valódi PCIC-korpusztól függjön.
// az id "b1-" előtaggal, mert lib/pcicLevels.ts a
// szint-szűrést az id-előtagból dönti el (a fül a B1 alap-szinten indul).
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

  it('felfedés után a dokkolt sáv "Next -> Knew it"-re vált, a régi gombok maradnak felülbírálásra', async () => {
    const { getByText, queryByText, getAllByText, UNSAFE_getByType } = render(<PcicScreen />);
    await flush();

    fireEvent.changeText(UNSAFE_getByType(TextInput), 'vida');
    fireEvent.press(getByText('✓ Check'));
    await flush();

    expect(queryByText('✓ Check')).toBeNull();
    expect(getByText('Next → Knew it')).toBeTruthy();
    expect(getByText('Knew it')).toBeTruthy();
    expect(getByText("Didn't know")).toBeTruthy();
    // LEARNING_STEPS=1: "Didn't know" (again) marad ma esedékes (<1 day), de
    // "Knew it" (good) egy lépésben graduál, interval 1 nap.
    expect(getAllByText('<1 day').length).toBe(1);
    expect(getByText('1 day')).toBeTruthy();
  });

  it('üres beküldés is felfedi a helyes alakot, "Next -> Didn\'t know"-t javasol, a koppintás dönt', async () => {
    const { getByText, getAllByText } = render(<PcicScreen />);
    await flush();

    fireEvent.press(getByText('✓ Check'));
    await flush();

    expect(getByText("Next → Didn't know")).toBeTruthy();
    expect(getAllByText('vida').length).toBeGreaterThan(0);
    expect(getByText('Knew it')).toBeTruthy();
    expect(getByText("Didn't know")).toBeTruthy();

    fireEvent.press(getByText("Didn't know"));
    await flush();

    expect(getByText('✓ Check')).toBeTruthy();
  });
});
