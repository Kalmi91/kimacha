jest.mock('@/lib/appDiagnostics', () => ({ logError: jest.fn() }));
jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn(() => Promise.resolve()) }));

import { useEffect } from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import AppErrorBoundary from '../AppErrorBoundary';
import { logError } from '@/lib/appDiagnostics';
import { setLanguage, t } from '@/lib/i18n';

function BrokenScreen(): never {
  throw new Error('Render failure');
}

function FailedStartup() {
  useEffect(() => { throw new Error('Font loading failed'); }, []);
  return null;
}

afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); setLanguage('en'); });

it('renders working children without logging', () => {
  const screen = render(<AppErrorBoundary><Text>Working</Text></AppErrorBoundary>);
  expect(screen.getByText('Working')).toBeTruthy();
  expect(logError).not.toHaveBeenCalled();
});

it.each(['en', 'es', 'hu', 'de'] as const)('records a render failure and shows the %s fallback', lang => {
  setLanguage(lang);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const screen = render(<AppErrorBoundary><BrokenScreen /></AppErrorBoundary>);
  expect(screen.getByText(t().settings.diagnostics.renderError)).toBeTruthy();
  expect(logError).toHaveBeenCalledWith('render-error', expect.objectContaining({ message: 'Render failure' }), expect.stringContaining('BrokenScreen'));
});

it('hides the splash screen when startup fails before rendering content', () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const screen = render(<AppErrorBoundary><FailedStartup /></AppErrorBoundary>);
  expect(screen.getByText(t().settings.diagnostics.renderError)).toBeTruthy();
  expect(logError).toHaveBeenCalledWith('render-error', expect.objectContaining({ message: 'Font loading failed' }), expect.stringContaining('FailedStartup'));
  expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
});

it('keeps the fallback and log when hiding the splash screen rejects', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.mocked(SplashScreen.hideAsync).mockRejectedValueOnce(new Error('Splash unavailable'));
  const screen = render(<AppErrorBoundary><FailedStartup /></AppErrorBoundary>);
  await Promise.resolve();
  expect(screen.getByText(t().settings.diagnostics.renderError)).toBeTruthy();
  expect(logError).toHaveBeenCalledWith('render-error', expect.objectContaining({ message: 'Font loading failed' }), expect.any(String));
  expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
});
