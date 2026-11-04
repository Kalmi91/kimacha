// The tense drill and the table deck while a phone browser's keyboard is open (lib/webKeyboard.ts): the container gives up its
// padding and the progress bar steps aside, so the prompt and the field fit. With the keyboard closed, which is always in the
// phone app, both stay as they were. Mock pattern: tenseDrill.play.test.tsx, deck/__tests__/tableDeck.play.test.tsx.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  useLocalSearchParams: () => ({ topic: 'ser-estar' }),
}));
jest.mock('@/lib/webKeyboard', () => ({
  ...jest.requireActual('@/lib/webKeyboard'),
  useWebKeyboardOpen: jest.fn(() => false),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';
import { KeyboardAvoidingView, StyleSheet } from 'react-native';

import { getDb } from '@/lib/database.web';
import { GRAMMAR_PROGRESS_KEY } from '@/lib/grammar/syllabus';
import { setLanguage } from '@/lib/i18n';
import { useWebKeyboardOpen } from '@/lib/webKeyboard';
import { makeFlush } from '@/test-utils/flush';
import TableDeckScreen from '../deck/[topic]';
import TenseDrillScreen from '../tense-drill';

const flush = makeFlush(4);
const keyboard = (open: boolean) => jest.mocked(useWebKeyboardOpen).mockReturnValue(open);
const container = () => StyleSheet.flatten(screen.UNSAFE_getByType(KeyboardAvoidingView).props.style);

afterEach(() => {
  keyboard(false);
  setLanguage('en');
});

describe('phone browser keyboard open', () => {
  it('the tense drill keeps the prompt and the field', async () => {
    const db = getDb();
    await db.setOnboarding('en', 'de');
    (db as any).__setLevelForTest('A1');
    render(<TenseDrillScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('tensedrill-begin'));
    await flush();
    expect(container().paddingBottom).toBeUndefined();

    keyboard(true);
    screen.rerender(<TenseDrillScreen />);
    await flush();
    expect(container()).toMatchObject({ paddingTop: 8, paddingBottom: 0 });
    expect(screen.getByTestId('tensedrill-prompt')).toBeTruthy();
    expect(screen.getByTestId('tensedrill-input')).toBeTruthy();

    keyboard(false);
    screen.rerender(<TenseDrillScreen />);
    await flush();
    expect(container().paddingBottom).toBeUndefined();
  });

  it('the table deck keeps the prompt and the field', async () => {
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    await db.setGameProgress(GRAMMAR_PROGRESS_KEY, 'ser-estar:tabledeck', 'progress', { cells: [], resetCount: 0, shuffled: false });
    render(<TableDeckScreen />);
    await flush();
    expect(container().paddingBottom).toBeUndefined();

    keyboard(true);
    screen.rerender(<TableDeckScreen />);
    await flush();
    expect(container()).toMatchObject({ paddingTop: 8, paddingBottom: 0 });
    expect(screen.getByTestId('tabledeck-input')).toBeTruthy();

    keyboard(false);
    screen.rerender(<TableDeckScreen />);
    await flush();
    expect(container().paddingBottom).toBeUndefined();
  });
});
