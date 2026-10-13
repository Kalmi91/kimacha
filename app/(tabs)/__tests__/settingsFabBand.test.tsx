// The floating 💬 button sits 24 px above the tab bar and is 55 px tall (FeedbackModal styles.fab / brutalFab). The
// Settings list used to scroll under it (a toggle or a row could sit under the button until the list was scrolled).
// The list's viewport now ends above the button's band, so the button covers no row, even before scrolling.
// Mock pattern: settingsReset.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn() }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: '' } }));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-document-picker', () => ({}));

import { ScrollView, StyleSheet } from 'react-native';
import { act, render } from '@testing-library/react-native';

import { fabInsets } from '@/components/FabScrollView';
import { FAB_CLEARANCE } from '@/components/learn/DockedAction';
import { setPcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';
import SettingsScreen from '../settings';

jest.setTimeout(30000);

const FAB_BOTTOM = 24;
const FAB_HEIGHT = 55;

const flush = async () => {
  for (let i = 0; i < 8; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('Settings: the 💬 button band', () => {
  beforeEach(async () => {
    setPcicTarget('es');
    await getDb().setOnboarding('en', 'es');
  });

  it('the list scroller ends above the 💬 button, so it covers no row before scrolling', async () => {
    const { UNSAFE_getAllByType } = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
    await flush();

    const scroller = StyleSheet.flatten(UNSAFE_getAllByType(ScrollView)[0].props.style);
    expect(scroller.marginBottom as number).toBeGreaterThanOrEqual(FAB_BOTTOM + FAB_HEIGHT);
    expect(scroller.marginBottom).toBe(FAB_CLEARANCE);
  });

  it('landscape: the list ends left of the button, since a band would eat the little height', () => {
    expect(fabInsets(740, 360)).toEqual({ marginRight: FAB_CLEARANCE, width: 'auto' });
    expect(fabInsets(360, 740)).toEqual({ marginBottom: FAB_CLEARANCE });
  });
});
