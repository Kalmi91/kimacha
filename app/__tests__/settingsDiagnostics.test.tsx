jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn() }),
  useFocusEffect: (callback: () => void) => {
    const { useEffect } = require('react');
    useEffect(callback, []);
  },
}));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: '' } }));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-document-picker', () => ({}));
jest.mock('@/lib/exportAppLog', () => ({ exportAppLog: jest.fn() }));

import { fireEvent, render } from '@testing-library/react-native';
import DataSettingsScreen from '../settings-data';
import SettingsScreen from '@/components/settings/SettingsScreen';
import { ThemeProvider } from '@/lib/ThemeContext';
import { setLanguage, t } from '@/lib/i18n';
import { exportAppLog } from '@/lib/exportAppLog';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(8);

afterEach(() => { jest.clearAllMocks(); setLanguage('en'); });

it.each(['en', 'es', 'hu', 'de'] as const)('exports from the My data row in %s', async lang => {
  setLanguage(lang);
  const screen = render(<ThemeProvider><DataSettingsScreen /></ThemeProvider>);
  await flush();
  fireEvent.press(screen.getByText(`📋 ${t().settings.diagnostics.export}`));
  expect(exportAppLog).toHaveBeenCalledTimes(1);
});

it('keeps the export row inside My data', async () => {
  const screen = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
  await flush();
  expect(screen.queryByText(`📋 ${t().settings.diagnostics.export}`)).toBeNull();
});
