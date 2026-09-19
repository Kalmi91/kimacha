// SZ7 (SZAVAK.md): FB188 névelő-gombsor a PCIC gépelős kártyán. Mock-minta:
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(cb, []);
  },
}));

// Egy fix, névelős tétel, hogy a composeAnswer bemenete ellenőrizhető legyen
// a valódi PCIC-korpusztól függetlenül.
const FIXTURE_ITEM = { id: 'x1', es: 'el perro', en: 'dog', kind: 'word' as const, section: 'Test', order: 0 };
jest.mock('@/data/pcic', () => ({
  PCIC_ITEMS: [FIXTURE_ITEM],
  findPcicItem: (id: string) => (id === 'x1' ? FIXTURE_ITEM : undefined),
}));

import { act, fireEvent, render } from '@testing-library/react-native';
import { TextInput } from 'react-native';

import { getDb } from '@/lib/database';
import PcicScreen from '../pcic';

const flush = async (times = 4) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('PCIC fül: névelő-gombsor (SZ7)', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
  });

  it('szó-tételen megjelenik a ⊘ (alapállás) chip', async () => {
    const { getByText } = render(<PcicScreen />);
    await flush();

    expect(getByText('⊘')).toBeTruthy();
  });

  it('el chip + gépelt szó a composeAnswer szerinti alakot adja a Check-nek', async () => {
    const { getByText, UNSAFE_getByType } = render(<PcicScreen />);
    await flush();

    fireEvent.press(getByText('el'));
    fireEvent.changeText(UNSAFE_getByType(TextInput), 'perro');
    fireEvent.press(getByText('✓ Check'));
    await flush();

    expect(UNSAFE_getByType(TextInput).props.value).toBe('el perro');
  });
});
