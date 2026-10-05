// PLAN-tobbjelentes 3. lépés (SZ8): a nagy szó alatti kis mondat (learn-hint, a `*…*`
// rész kiemelve, csillag nélkül) és a Check utáni „also: b · c” sor (learn-also, perjeles
// válasznál). Mock-minta: app/(tabs)/__tests__/pcicNote.test.tsx.

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

// Két tétel: az 1. perjeles válaszú és hintes, a 2. egy alakú és hint nélküli.
jest.mock('@/data/pcic', () => {
  const items = [
    { id: 'a1-hint0001', es: 'el carro / el coche / el auto', en: 'car', kind: 'word', section: 'Test', order: 0, hint: 'The *car* is red.' },
    { id: 'a1-hint0002', es: 'la mesa', en: 'table', kind: 'word', section: 'Test', order: 1 },
  ];
  return {
    PCIC_LEVELS: ['B1'],
    PCIC_VIEW_LEVELS: ['B1'],
    LEVEL_LABELS: { B1: 'Intermediate' },
    pcicItemsForLevel: () => items,
    pcicItemsForViewLevel: () => items,
    findPcicItem: (id: string) => items.find((i) => i.id === id),
    isPlusSentence: () => false,
    realLevelOfView: (level: string) => level,
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

// A beágyazott Text-ek szövege egy stringben (a children elemek is lehetnek).
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

describe('PCIC fül: hint és „also” sor (PLAN-tobbjelentes 3. lépés)', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(RESUME_GAME_ID);
    jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('a hint megjelenik a szó alatt, csillag nélkül, a jelölt rész kiemelve', async () => {
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

  it('a hint a Check után is látszik', async () => {
    const utils = render(<PcicScreen />);
    await flush();
    await typeAndCheck(utils, 'el coche');

    expect(textOf(utils.getByTestId('learn-hint').props.children)).toBe('The car is red.');
  });

  it('hint nélküli kártyán nincs learn-hint', async () => {
    const utils = render(<PcicScreen />);
    await flush();
    await typeAndCheck(utils, 'el coche');
    fireEvent.press(utils.getByText('Knew it'));
    await flush();

    // 2. kártya: la mesa, nincs hint.
    expect(utils.queryByTestId('learn-hint')).toBeNull();
  });

  it('perjeles válasznál a learn-also a többi alakot mutatja, a mutatott alak nélkül', async () => {
    const utils = render(<PcicScreen />);
    await flush();
    expect(utils.queryByTestId('learn-also')).toBeNull(); // Check előtt nincs

    await typeAndCheck(utils, 'el coche');
    expect(textOf(utils.getByTestId('learn-also').props.children)).toBe('also: el carro · el auto');
  });

  it('egy alakú válasznál nincs learn-also', async () => {
    const utils = render(<PcicScreen />);
    await flush();
    await typeAndCheck(utils, 'el coche');
    fireEvent.press(utils.getByText('Knew it'));
    await flush();
    await typeAndCheck(utils, 'la mesa');

    expect(utils.queryByTestId('learn-also')).toBeNull();
  });
});
