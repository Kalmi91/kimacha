// The 💬 button is in the navigator's header (right end), not floating over the Settings list: no row or toggle can sit
// under it, and the list scroller keeps the whole screen height. Mock pattern: settingsReset.test.tsx.

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

import { setPcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { FeedbackHeaderProvider } from '@/lib/feedbackHeader';
import { ThemeProvider } from '@/lib/ThemeContext';
import SettingsScreen from '../settings';

jest.setTimeout(30000);

const flush = async () => {
  for (let i = 0; i < 8; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('Settings: the 💬 button is in the header', () => {
  beforeEach(async () => {
    setPcicTarget('es');
    await getDb().setOnboarding('en', 'es');
  });

  it('the screen hands its button to the navigator header and the list scroller is full height', async () => {
    const setOptions = jest.fn();
    const { UNSAFE_getAllByType, queryByLabelText } = render(
      <ThemeProvider>
        <FeedbackHeaderProvider navigation={{ setOptions }}>
          <SettingsScreen />
        </FeedbackHeaderProvider>
      </ThemeProvider>,
    );
    await flush();

    expect(queryByLabelText('Feedback')).toBeNull();
    expect(setOptions).toHaveBeenCalledWith({ headerRight: expect.any(Function) });
    const scroller = StyleSheet.flatten(UNSAFE_getAllByType(ScrollView)[0].props.style);
    expect(scroller?.marginBottom ?? 0).toBe(0);
    expect(scroller?.marginRight ?? 0).toBe(0);
  });
});
