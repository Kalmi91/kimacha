jest.mock('expo-router', () => ({
  ...require('@/test-utils/mocks').focusEffectRouterMock(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: '' } }));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-document-picker', () => ({}));
jest.mock('@/lib/speech', () => ({
  ...require('@/test-utils/mocks').speechMock(), loadVoices: jest.fn(async () => []), hasVoiceFor: () => true,
}));

import { fireEvent, render } from '@testing-library/react-native';
import { getDb } from '@/lib/database';
import { makeFlush } from '@/test-utils/flush';
import SettingsScreen from '../../settings-learning';
const flush = makeFlush(8);

it('defaults off, saves independently and remains enabled when reopened', async () => {
  await getDb().setOnboarding('en', 'es');
  const first = render(<SettingsScreen />);
  await flush();
  expect(first.getByTestId('settings-fatigue-detector').props.value).toBe(false);
  fireEvent(first.getByTestId('settings-fatigue-detector'), 'valueChange', true);
  await flush();
  expect(await getDb().getFatigueDetector()).toBe(true);
  expect(await getDb().getTiredButton()).toBe(false);
  first.unmount();
  const second = render(<SettingsScreen />);
  await flush();
  expect(second.getByTestId('settings-fatigue-detector').props.value).toBe(true);
  expect(second.getByTestId('settings-fatigue-detector').props.accessibilityLabel).toBe('Fatigue detector');
});
