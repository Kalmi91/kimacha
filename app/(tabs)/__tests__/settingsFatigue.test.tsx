jest.mock('expo-router', () => ({
  ...require('@/test-utils/mocks').focusEffectRouterMock(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: '' } }));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-document-picker', () => ({}));
jest.mock('@/lib/speech', () => ({
  ...require('@/test-utils/mocks').speechMock(),
  loadVoices: jest.fn(async () => []), hasVoiceFor: () => true,
}));

import { fireEvent, render } from '@testing-library/react-native';
import { getDb } from '@/lib/database';
import { makeFlush } from '@/test-utils/flush';
import SettingsScreen from '../../settings-learning';

const flush = makeFlush(8);

it('fatigue settings default off, save independently, and survive reopening', async () => {
  await getDb().setOnboarding('en', 'es');
  const first = render(<SettingsScreen />);
  await flush();
  for (const id of ['settings-tired-button', 'settings-miss-cap']) {
    expect(first.getByTestId(id).props.value).toBe(false);
    fireEvent(first.getByTestId(id), 'valueChange', true);
    await flush();
  }
  expect(await getDb().getTiredButton()).toBe(true);
  expect(await getDb().getMissCap()).toBe(true);
  first.unmount();
  const second = render(<SettingsScreen />);
  await flush();
  for (const id of ['settings-tired-button', 'settings-miss-cap']) {
    expect(second.getByTestId(id).props.value).toBe(true);
  }
  fireEvent(second.getByTestId('settings-tired-button'), 'valueChange', false);
  await flush();
  expect(await getDb().getTiredButton()).toBe(false);
  expect(await getDb().getMissCap()).toBe(true);
});
