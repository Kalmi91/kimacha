// The direction sheet of Settings lists every supported pair (six), generated from lib/languages.ts, with the flags
// and the native names. Mock pattern: settingsFeedbackHeader.test.tsx.

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: '' } }));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-document-picker', () => ({}));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { setPcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { FeedbackHeaderProvider } from '@/lib/feedbackHeader';
import { pairLabel, supportedPairs } from '@/lib/languages';
import { ThemeProvider } from '@/lib/ThemeContext';
import SettingsScreen from '../settings';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(30000);

const flush = makeFlush(8);

describe('Settings: the direction sheet', () => {
  beforeEach(async () => {
    setPcicTarget('es');
    await getDb().setOnboarding('en', 'es');
  });

  it('has one option per supported pair: six, each as "flag name → flag name"', async () => {
    render(
      <ThemeProvider>
        <FeedbackHeaderProvider navigation={{ setOptions: jest.fn() }}>
          <SettingsScreen />
        </FeedbackHeaderProvider>
      </ThemeProvider>,
    );
    await flush();

    expect(supportedPairs).toHaveLength(6);
    // the row that opens the sheet shows the active pair
    fireEvent.press(screen.getByText('Learning direction'));
    for (const [source, target] of supportedPairs) {
      expect(screen.getAllByText(pairLabel(source, target)).length).toBeGreaterThan(0);
    }
    // the active one is in the row and in the sheet; the other five appear once, in the sheet only
    expect(screen.getAllByText('🇬🇧 English → 🇪🇸 Español')).toHaveLength(2);
    expect(screen.getAllByText('🇭🇺 Magyar → 🇬🇧 English')).toHaveLength(1);
  });
});