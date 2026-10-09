// After a correct answer the word is shown only once (the
// pink row with the speaker), the green echo (diff row) is left out. If the typed
// answer differs (wrong, or accepted without accents), both rows stay.
// Mock pattern: pcicBrutal.test.tsx.

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

const FIXTURE_ITEM = { id: 'b1-x1', es: 'está', en: 'is', kind: 'word' as const, section: 'Test', order: 0 };
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['B1'],
  PCIC_VIEW_LEVELS: ['B1'],
  pcicItemsForLevel: () => [FIXTURE_ITEM],
  findPcicItem: (id: string) => (id === 'b1-x1' ? FIXTURE_ITEM : undefined),
  setPcicTarget: () => {},
}));

import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, TextInput } from 'react-native';

import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';
import PcicScreen from '../index';

const flush = async (times = 6) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

jest.setTimeout(30000);

async function revealWith(typed: string) {
  const view = render(<ThemeProvider><PcicScreen /></ThemeProvider>);
  await flush();
  fireEvent.changeText(view.UNSAFE_getByType(TextInput), typed);
  fireEvent.press(view.getByText('✓ Check'));
  await flush();
  return view;
}

describe('PCIC reveal: the correct answer shows only once', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
  });

  it('exactly the target (ignoring case and edge whitespace): no green echo, a single "está" (the pink row)', async () => {
    for (const typed of ['está', '  EstÁ  ']) {
      const view = await revealWith(typed);
      expect(view.queryByTestId('pcic-diff-line')).toBeNull();
      expect(view.getAllByText('está')).toHaveLength(1);
      view.unmount();
    }
  });

  it('an answer accepted without accents: the diff row (typed form) and the pink target row both stay', async () => {
    const view = await revealWith('esta');
    expect(view.getByTestId('pcic-diff-line')).toBeTruthy();
    expect(view.getAllByText('está')).toHaveLength(1);
    view.unmount();
  });

  it('wrong answer: the diff row and the pink target row both stay', async () => {
    const view = await revealWith('xyz');
    expect(view.getByTestId('pcic-diff-line')).toBeTruthy();
    expect(view.getAllByText('está')).toHaveLength(1);
    view.unmount();
  });

  // User feedback (a small gap is needed between "Not quite!" and the misspelled word): the row of the typed word under the badge does not touch it.
  it('wrong answer: there is a gap between the "Not quite!" badge and the typed (wrong) word', async () => {
    const view = await revealWith('xyz');
    const gap = StyleSheet.flatten(view.getByTestId('pcic-diff-line').props.style).marginTop ?? 0;
    expect(gap).toBeGreaterThanOrEqual(8);
    view.unmount();
  });
});
