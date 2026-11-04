// The input field gets focus on every NEW PCIC page (the keyboard
// opens), but does not reopen after the reveal. Mock pattern:
// app/(tabs)/__tests__/pcicSpeak.test.tsx (the same effect drives both).

jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

jest.mock('expo-router', () => require('@/test-utils/mocks').focusEffectRouterMock());

// useDockLift (the PCIC docked bar) now calls useSafeAreaInsets, which
// throws without a SafeAreaProvider; its size does not matter here, it just must not throw.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

// One fixed item, so the test does not depend on the real PCIC corpus.
const FIXTURE_ITEM = { id: 'b1-x1', es: 'vida', en: 'life', kind: 'word' as const, section: 'Test', order: 0 };
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['B1'],
  PCIC_VIEW_LEVELS: ['B1'],
  pcicItemsForLevel: () => [FIXTURE_ITEM],
  findPcicItem: (id: string) => (id === 'b1-x1' ? FIXTURE_ITEM : undefined),
  setPcicTarget: () => {},
}));

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { TextInput } from 'react-native';

import { getDb } from '@/lib/database';
import PcicScreen from '../index';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(4);

describe('PCIC tab: field focus', () => {
  let focusSpy: jest.SpyInstance;

  beforeEach(async () => {
    await getDb().resetPcicCards();
    focusSpy = jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => {});
  });

  afterEach(() => {
    focusSpy.mockRestore();
  });

  it('when a new card appears (on mount), the field gets focus', async () => {
    render(<PcicScreen />);
    await flush();

    await waitFor(() => expect(focusSpy).toHaveBeenCalled());
  });

  it('after reveal (Check) it does NOT regain focus while the same card is on screen', async () => {
    const settle = () => act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    const { UNSAFE_getByType, getByText } = render(<PcicScreen />);
    await flush();
    await settle();
    const callsAfterMount = focusSpy.mock.calls.length;
    expect(callsAfterMount).toBeGreaterThan(0);

    fireEvent.changeText(UNSAFE_getByType(TextInput), 'vida');
    fireEvent.press(getByText('✓ Check'));
    await flush();
    await settle();

    expect(focusSpy.mock.calls.length).toBe(callsAfterMount);
  });
});
