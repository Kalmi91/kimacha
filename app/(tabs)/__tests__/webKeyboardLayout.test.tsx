// What gives way while a phone browser's keyboard is open (lib/webKeyboard.ts): the tab bar, the floating 💬 button and the
// Learn header's counts. With the keyboard closed, which is always in the phone app, all three stay as they were.
// Mock pattern: pcicDockOverlap.test.tsx, betaTabs.test.tsx.

jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  // Tabs mock: the bar's display, as the navigator gets it.
  const Tabs = ({ screenOptions }: { screenOptions: { tabBarStyle: { display?: string } } }) =>
    React.createElement(Text, { testID: 'tab-bar-display' }, screenOptions.tabBarStyle.display ?? 'shown');
  Tabs.Screen = function Screen() {
    return null;
  };
  return { ...require('@/test-utils/mocks').focusEffectRouterMock(), Tabs };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 48 }),
}));
jest.mock('@/lib/webKeyboard', () => ({
  ...jest.requireActual('@/lib/webKeyboard'),
  useWebKeyboardOpen: jest.fn(() => false),
}));

const ITEM = { id: 'b1-x1', es: 'el coche', en: 'the car', kind: 'word' as const, section: 'Test', order: 0 };
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['B1'],
  PCIC_VIEW_LEVELS: ['B1'],
  pcicItemsForLevel: () => [ITEM],
  findPcicItem: (id: string) => (id === 'b1-x1' ? ITEM : undefined),
  setPcicTarget: () => {},
}));

import { fireEvent, render } from '@testing-library/react-native';
import { KeyboardAvoidingView, StyleSheet, TextInput } from 'react-native';

import FeedbackButton from '@/components/FeedbackModal';
import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';
import { useWebKeyboardOpen } from '@/lib/webKeyboard';
import { makeFlush } from '@/test-utils/flush';
import TabLayout from '../_layout';
import PcicScreen from '../index';

jest.setTimeout(60000);

const flush = makeFlush(4);
const keyboard = (open: boolean) => jest.mocked(useWebKeyboardOpen).mockReturnValue(open);

afterEach(() => keyboard(false));

describe('phone browser keyboard open', () => {
  it('the tab bar steps aside and comes back', async () => {
    const view = render(<ThemeProvider><TabLayout /></ThemeProvider>);
    await flush();
    expect(view.getByTestId('tab-bar-display').props.children).toBe('shown');

    keyboard(true);
    view.rerender(<ThemeProvider><TabLayout /></ThemeProvider>);
    expect(view.getByTestId('tab-bar-display').props.children).toBe('none');

    keyboard(false);
    view.rerender(<ThemeProvider><TabLayout /></ThemeProvider>);
    expect(view.getByTestId('tab-bar-display').props.children).toBe('shown');
  });

  describe('the 💬 button', () => {
    const button = () => <FeedbackButton level="B1" languagePair="es-en" currentCard="pcic" />;
    const display = (view: ReturnType<typeof render>) => StyleSheet.flatten(view.getByLabelText('Feedback', { includeHiddenElements: true }).props.style).display;

    it('the floating one hides while typing, so it does not cover the field', () => {
      const view = render(button());
      expect(display(view)).toBeUndefined();

      keyboard(true);
      view.rerender(button());
      expect(display(view)).toBe('none');

      keyboard(false);
      view.rerender(button());
      expect(display(view)).toBeUndefined();
    });

    it('its form survives the keyboard its own field opens', () => {
      const view = render(button());
      fireEvent.press(view.getByLabelText('Feedback'));
      fireEvent.changeText(view.getByPlaceholderText('Share your thoughts...'), 'hello');

      keyboard(true);
      view.rerender(button());
      expect(view.getByPlaceholderText('Share your thoughts...').props.value).toBe('hello');
    });

    it('the one in a header row stays: it covers nothing', () => {
      keyboard(true);
      const view = render(<FeedbackButton placement="inline" compact level="B1" languagePair="es-en" currentCard="pcic" />);
      expect(display(view)).toBeUndefined();
    });
  });

  describe('the Learn card', () => {
    beforeEach(async () => {
      await getDb().resetPcicCards();
    });

    it('keeps the level chip, the 💬, the prompt and the field, and drops the counts and the progress bar', async () => {
      const view = render(<PcicScreen />);
      const padding = () => StyleSheet.flatten(view.UNSAFE_getByType(KeyboardAvoidingView).props.style);
      await flush();
      expect(view.getByText('1 words')).toBeTruthy();
      expect(view.getByTestId('learn-progress-fill')).toBeTruthy();
      expect(padding().paddingBottom).toBeUndefined();

      keyboard(true);
      view.rerender(<PcicScreen />);
      await flush();
      expect(view.queryByText('1 words')).toBeNull();
      expect(view.queryByTestId('learn-progress-fill')).toBeNull();
      expect(padding().paddingBottom).toBe(0);
      expect(view.getByText('B1 ▾')).toBeTruthy();
      expect(view.getByLabelText('Feedback')).toBeTruthy();
      expect(view.getByText('the car')).toBeTruthy();
      expect(view.UNSAFE_getByType(TextInput)).toBeTruthy();

      keyboard(false);
      view.rerender(<PcicScreen />);
      await flush();
      expect(view.getByText('1 words')).toBeTruthy();
      expect(view.getByTestId('learn-progress-fill')).toBeTruthy();
      expect(padding().paddingBottom).toBeUndefined();
    });
  });
});
