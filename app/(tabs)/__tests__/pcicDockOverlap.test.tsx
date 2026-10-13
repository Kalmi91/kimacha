// A tall word card (article buttons, accepted forms, example sentence) after Check: its "Knew it" / "Didn't know"
// row sits in the card's scroller, "Next" in the docked bar. The bar is lifted `dockLift` (the navigation-bar inset)
// above the tab bar, and a scroller that only had bottom padding let the card show through under / below the bar,
// over "Next". The scroller's viewport has to end at the bar's top edge. Mock pattern: pcicCardShell.test.tsx.

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

const NAV_BAR = 48;
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 48 }),
}));

// A noun with the article row, two accepted forms and an example sentence: the tallest kind of Learn card.
const TALL_ITEM = {
  id: 'b1-x2',
  es: 'el coche / el carro',
  en: 'the car (the automobile, the vehicle for the family)',
  kind: 'word' as const,
  section: 'Test',
  order: 0,
  exampleEs: 'El coche de mi madre es muy viejo, pero todavía funciona perfectamente.',
  exampleEn: 'My mother’s car is very old, but it still works perfectly.',
};
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['B1'],
  PCIC_VIEW_LEVELS: ['B1'],
  pcicItemsForLevel: () => [TALL_ITEM],
  findPcicItem: (id: string) => (id === 'b1-x2' ? TALL_ITEM : undefined),
  setPcicTarget: () => {},
}));

import { act, fireEvent, render } from '@testing-library/react-native';
import { DeviceEventEmitter, KeyboardAvoidingView, ScrollView, StyleSheet, TextInput } from 'react-native';

import { DOCK_RESERVE, FAB_CLEARANCE } from '@/components/learn/DockedAction';
import { getDb } from '@/lib/database';
import PcicScreen from '../index';

const flush = async (times = 4) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const DOCK_H = DOCK_RESERVE;

// the card's scroller is the one holding the answer field
const cardScroller = (utils: ReturnType<typeof render>) =>
  utils.UNSAFE_getAllByType(ScrollView).find((sv) => sv.findAllByType(TextInput).length > 0)!;

jest.setTimeout(60000);

describe('PCIC tab: the card never runs under the docked Next bar', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
  });

  const revealTallCard = async () => {
    const utils = render(<PcicScreen />);
    await flush();
    fireEvent.changeText(utils.UNSAFE_getByType(TextInput), 'xyz');
    fireEvent.press(utils.getByText('✓ Check'));
    await flush();
    // the bar reports its drawn height (what DockedAction's onLayout does on a device)
    fireEvent(utils.getByTestId('learn-dock'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 412, height: DOCK_H } } });
    await flush();
    return utils;
  };

  it('keyboard closed: the scroller ends above the bar and the 💬 button, with the Knew it row inside', async () => {
    const utils = await revealTallCard();
    const { getByText, UNSAFE_getByType } = utils;

    expect(getByText('Knew it')).toBeTruthy();
    expect(getByText('el coche')).toBeTruthy();

    const container = StyleSheet.flatten(UNSAFE_getByType(KeyboardAvoidingView).props.style);
    const scroller = StyleSheet.flatten(cardScroller(utils).props.style);
    const content = StyleSheet.flatten(cardScroller(utils).props.contentContainerStyle);

    // distance of the scroller's bottom edge / of the bar's top edge above the container's bottom edge
    const scrollerBottom = (container.padding as number) + ((scroller.marginBottom as number) ?? 0);
    const barTop = NAV_BAR + DOCK_H;
    // and above the 💬 button floating over the bar (24 above it, 55 tall): it never covers the card, even before scrolling
    expect(scrollerBottom).toBeGreaterThanOrEqual(barTop + FAB_CLEARANCE);
    expect(content.paddingBottom).toBe(0);
  });

  it('keyboard open: the typing layout is unchanged (full-height scroller, room under the bar as padding)', async () => {
    const utils = render(<PcicScreen />);
    await flush();
    act(() => {
      DeviceEventEmitter.emit('keyboardDidShow', { endCoordinates: { height: 300 } });
    });
    await flush();

    const scroller = StyleSheet.flatten(cardScroller(utils).props.style);
    const content = StyleSheet.flatten(cardScroller(utils).props.contentContainerStyle);
    expect(scroller.marginBottom ?? 0).toBe(0);
    expect(content.paddingBottom).toBe(FAB_CLEARANCE + DOCK_H + 300 + NAV_BAR);
  });
});
