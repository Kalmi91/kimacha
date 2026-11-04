// FB560 + FB561 on the real cards: o1666 (la cintura) shows the English example sentence as its hint, and the (i) note of
// o436 (quizá / quizás / tal vez / acaso) explains the four answers and links to the ojala-quizas lesson, but only
// in a direction where that lesson exists. The items are the real corpus cards, only the deck list is stubbed.
// Mock pattern: app/(tabs)/__tests__/pcicNote.test.tsx.

jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

let mockItems: { id: string }[] = [];
jest.mock('@/data/pcic', () => {
  const actual = jest.requireActual('@/data/pcic');
  return {
    PCIC_LEVELS: ['B1'],
    PCIC_VIEW_LEVELS: ['B1'],
    pcicItemsForLevel: () => mockItems,
    levelOfItem: () => 'B1',
    findPcicItem: (id: string) => mockItems.find((i) => i.id === id) ?? actual.findPcicItem(id),
    setPcicTarget: () => {},
    __actualFind: actual.findPcicItem,
  };
});

import { fireEvent, render, within } from '@testing-library/react-native';
import { StyleSheet, TextInput } from 'react-native';

import * as pcic from '@/data/pcic';
import { getDb } from '@/lib/database';
import PcicScreen from '../index';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(4);
const realCard = (id: string) => (pcic as unknown as { __actualFind: (id: string) => { id: string } }).__actualFind(id);

const textOf = (node: unknown): string => {
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (node && typeof node === 'object' && 'props' in node) return textOf((node as { props: { children?: unknown } }).props.children);
  return '';
};

describe('PCIC tab: o1666 hint and o436 note with the lesson link', () => {
  beforeEach(async () => {
    mockPush.mockClear();
    await getDb().resetPcicCards();
    await getDb().setOnboarding('en', 'es');
    await getDb().setPcicLevel('B1');
    jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('FB560: the waist card shows the English example sentence under the word, "waist" marked', async () => {
    mockItems = [realCard('o1666')];
    const utils = render(<PcicScreen />);
    await flush();

    const hint = utils.getByTestId('learn-hint');
    expect(textOf(hint.props.children)).toBe('The pants are big for my waist.');
    const mark = StyleSheet.flatten(within(hint).getByText('waist').props.style);
    expect(mark.fontWeight).toBe('700');
    expect(mark.textDecorationLine).toBe('underline');
  });

  it('FB561: the (i) of o436 explains the four answers and the link row pushes the lesson route', async () => {
    mockItems = [realCard('o436')];
    const utils = render(<PcicScreen />);
    await flush();

    expect(utils.queryByTestId('learn-note-lesson')).toBeNull(); // closed until (i) is tapped
    fireEvent.press(utils.getByTestId('learn-info'));
    expect(textOf(utils.getByTestId('learn-note').props.children)).toContain('Four ways to say "maybe"');
    const row = utils.getByTestId('learn-note-lesson');
    expect(row.props.accessibilityRole).toBe('link');
    expect(textOf(row.props.children)).toContain('Open the lesson: Ojalá, quizás, tal vez');

    fireEvent.changeText(utils.UNSAFE_getByType(TextInput), 'tal vez');
    fireEvent.press(row);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/grammar/ojala-quizas');
    // a push, not a replace: the card, the open note and the typed answer are all still there for the way Back.
    expect(utils.getByTestId('learn-note-lesson')).toBeTruthy();
    expect(utils.UNSAFE_getByType(TextInput).props.value).toBe('tal vez');
  });

  it('FB561: the hu→es deck gets the link row too (the lesson title is the Spanish topic name in every language)', async () => {
    await getDb().setOnboarding('hu', 'es');
    mockItems = [realCard('o436')];
    const utils = render(<PcicScreen />);
    await flush();

    fireEvent.press(utils.getByTestId('learn-info'));
    expect(textOf(utils.getByTestId('learn-note-lesson').props.children)).toBe('Open the lesson: Ojalá, quizás, tal vez ›');
  });

  it('FB561: in a direction without the lesson the note shows and the link row does not', async () => {
    await getDb().setOnboarding('es', 'en');
    mockItems = [{ ...realCard('o436'), en: 'maybe', es: 'quizá' } as { id: string }];
    const utils = render(<PcicScreen />);
    await flush();

    fireEvent.press(utils.getByTestId('learn-info'));
    expect(utils.getByTestId('learn-note')).toBeTruthy();
    expect(utils.queryByTestId('learn-note-lesson')).toBeNull();
  });
});
