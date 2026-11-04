// The Settings "Sign in" row exists only for a web guest (no cloud account yet); pressing it asks the cloud gate for the
// sign-in chooser. Mock pattern: settingsDirectionSheet.test.tsx.

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

import { Platform } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { setPcicTarget } from '@/data/pcic';
import { resetGuestStateForTests, setCloudGuest, subscribeSignInRequests } from '@/lib/cloud/guest';
import { getDb } from '@/lib/database';
import { FeedbackHeaderProvider } from '@/lib/feedbackHeader';
import { ThemeProvider } from '@/lib/ThemeContext';
import SettingsScreen from '../settings';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(30000);

const flush = makeFlush(8);

async function renderSettings() {
  render(
    <ThemeProvider>
      <FeedbackHeaderProvider navigation={{ setOptions: jest.fn() }}>
        <SettingsScreen />
      </FeedbackHeaderProvider>
    </ThemeProvider>,
  );
  await flush();
}

describe('Settings: the web guest sign-in row', () => {
  beforeEach(async () => {
    setPcicTarget('es');
    await getDb().setOnboarding('en', 'es');
  });

  // under Platform.OS 'web' the theme provider reads window.location.search (lib/webTestHooks.ts)
  beforeEach(() => {
    Object.defineProperty(globalThis, 'location', { value: { search: '' }, configurable: true, writable: true });
  });

  afterEach(() => {
    delete (globalThis as any).location;
    resetGuestStateForTests();
    jest.restoreAllMocks();
  });

  it('web has no General and Voice tabs, the Voice tab would be empty there', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    await renderSettings();
    expect(screen.queryByTestId('settings-tab-general')).toBeNull();
    expect(screen.queryByTestId('settings-tab-voice')).toBeNull();
    expect(screen.getByTestId('settings-theme-row')).toBeTruthy();
  });

  it('shows for a guest on web, and pressing it requests the sign-in chooser', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    await renderSettings();
    expect(screen.queryByText('Sign in')).toBeNull();

    act(() => setCloudGuest(true));
    const requested = jest.fn();
    const off = subscribeSignInRequests(requested);
    fireEvent.press(screen.getByText('Sign in'));
    off();
    expect(requested).toHaveBeenCalledTimes(1);
  });

  it('is gone once the user is signed in (not a guest)', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    await renderSettings();
    act(() => setCloudGuest(true));
    expect(screen.getByText('Sign in')).toBeTruthy();
    act(() => setCloudGuest(false));
    expect(screen.queryByText('Sign in')).toBeNull();
  });

  it('never shows on native, even if the guest flag were set', async () => {
    await renderSettings();
    act(() => setCloudGuest(true));
    expect(screen.queryByText('Sign in')).toBeNull();
  });
});
