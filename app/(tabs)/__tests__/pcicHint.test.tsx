// The small sentence below the big word (learn-hint, the `*…*`
// part highlighted, without the asterisks) and the "also: b · c" row after Check (learn-also, for a
// slash-separated answer). Mock pattern: app/(tabs)/__tests__/pcicNote.test.tsx.

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

// Two items: the 1st has a slash-separated answer and a hint, the 2nd has a single form and no hint.
jest.mock('@/data/pcic', () => {
  const items = [
    { id: 'a1-hint0001', es: 'el carro / el coche / el auto', en: 'car', kind: 'word', section: 'Test', order: 0, hint: 'The *car* is red.' },
    { id: 'a1-hint0002', es: 'la mesa', en: 'table', kind: 'word', section: 'Test', order: 1 },
  ];
  return {
    PCIC_LEVELS: ['B1'],
    PCIC_VIEW_LEVELS: ['B1'],
    pcicItemsForLevel: () => items,
    findPcicItem: (id: string) => items.find((i) => i.id === id),
    setPcicTarget: () => {},
  };
});

import { act, fireEvent, render, within } from '@testing-library/react-native';
import { StyleSheet, TextInput } from 'react-native';

import { getDb } from '@/lib/database';
import { RESUME_GAME_ID } from '@/lib/resumeRoute';
import PcicScreen from '../index';

const flush = async (times = 4) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

// Text of the nested Text elements in one string (the children can be elements too).
const textOf = (node: unknown): string => {
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (node && typeof node === 'object' && 'props' in node) return textOf((node as { props: { children?: unknown } }).props.children);
  return '';
};

async function typeAndCheck(utils: ReturnType<typeof render>, answer: string) {
  fireEvent.changeText(utils.UNSAFE_getByType(TextInput), answer);
  fireEvent.press(utils.getByText('✓ Check'));
  await flush();
}

describe('PCIC tab: hint and "also" row', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(RESUME_GAME_ID);
    jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('the hint shows under the word, without an asterisk, with the marked part highlighted', async () => {
    const utils = render(<PcicScreen />);
    await flush();

    const hint = utils.getByTestId('learn-hint');
    expect(textOf(hint.props.children)).toBe('The car is red.');
    expect(textOf(hint.props.children)).not.toContain('*');
    const mark = StyleSheet.flatten(within(hint).getByText('car').props.style);
    expect(mark.fontWeight).toBe('700');
    expect(mark.textDecorationLine).toBe('underline');
    expect(mark.textDecorationColor).toBe('#EC4899');
  });

  it('the hint is still shown after Check', async () => {
    const utils = render(<PcicScreen />);
    await flush();
    await typeAndCheck(utils, 'el coche');

    expect(textOf(utils.getByTestId('learn-hint').props.children)).toBe('The car is red.');
  });

  it('no learn-hint on a card without a hint', async () => {
    const utils = render(<PcicScreen />);
    await flush();
    await typeAndCheck(utils, 'el coche');
    fireEvent.press(utils.getByText('Knew it'));
    await flush();

    // 2nd card: la mesa, no hint.
    expect(utils.queryByTestId('learn-hint')).toBeNull();
  });

  it('with a slash-separated answer, learn-also shows the other forms, without the shown one', async () => {
    const utils = render(<PcicScreen />);
    await flush();
    expect(utils.queryByTestId('learn-also')).toBeNull(); // Not there before Check

    await typeAndCheck(utils, 'el coche');
    expect(textOf(utils.getByTestId('learn-also').props.children)).toBe('also: el carro · el auto');
  });

  it('no learn-also with a single-form answer', async () => {
    const utils = render(<PcicScreen />);
    await flush();
    await typeAndCheck(utils, 'el coche');
    fireEvent.press(utils.getByText('Knew it'));
    await flush();
    await typeAndCheck(utils, 'la mesa');

    expect(utils.queryByTestId('learn-also')).toBeNull();
  });
});
