// The input field of the Learn card has a gray placeholder that tells what
// to type ("Type in Spanish"); the language name comes from the target language of the direction
// (in the es→en direction "Type in English"). Mock pattern: pcicDirection.test.tsx.

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

const FIXTURE_ITEM = { id: 'a1-x1', es: 'vida', en: 'life', kind: 'word' as const, section: 'Test', order: 0 };
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['A1'],
  PCIC_VIEW_LEVELS: ['A1'],
  pcicItemsForLevel: () => [FIXTURE_ITEM],
  findPcicItem: (id: string) => (id === 'a1-x1' ? FIXTURE_ITEM : undefined),
  setPcicTarget: () => {},
}));

import { act, render } from '@testing-library/react-native';
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

describe('PCIC tab: the input field placeholder', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
  });

  it('in the en→es direction "Type in Spanish"', async () => {
    await getDb().setOnboarding('en', 'es');
    const { UNSAFE_getByType } = render(<PcicScreen />);
    await flush();

    expect(UNSAFE_getByType(TextInput).props.placeholder).toBe('Type in Spanish');
  });

  it('in the es→en direction "Type in English"', async () => {
    await getDb().setOnboarding('es', 'en');
    const { UNSAFE_getByType } = render(<PcicScreen />);
    await flush();

    expect(UNSAFE_getByType(TextInput).props.placeholder).toBe('Type in English');
  });
});
