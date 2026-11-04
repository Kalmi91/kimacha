// The PCIC input field REMOUNTS on every new card, because a native field that was disabled
// after Check (editable=false) and then re-enabled did not reliably bring up the keyboard, and
// deleting did not work on it either. The focus comes a moment after the mount, not from autoFocus:
// with autoFocus Gboard sometimes opened with its letters never reaching the field.

jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

jest.mock('expo-router', () => require('@/test-utils/mocks').focusEffectRouterMock());

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

const ITEMS = [
  { id: 'b1-x1', es: 'vida', en: 'life', kind: 'word' as const, section: 'Test', order: 0 },
  { id: 'b1-x2', es: 'mesa', en: 'table', kind: 'word' as const, section: 'Test', order: 1 },
];
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['B1'],
  PCIC_VIEW_LEVELS: ['B1'],
  pcicItemsForLevel: () => ITEMS,
  levelOfItem: () => 'A1',
  findPcicItem: (id: string) => ITEMS.find((i) => i.id === id),
  setPcicTarget: () => {},
}));

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { TextInput } from 'react-native';

import { getDb } from '@/lib/database';
import PcicScreen from '../index';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(4);
let focusSpy: jest.SpyInstance;

describe('PCIC tab: a fresh input field for every new card', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
    focusSpy = jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('the first card field is not autoFocus, it gets the focus a moment after mounting', async () => {
    const { UNSAFE_getByType } = render(<PcicScreen />);
    await flush();
    expect(UNSAFE_getByType(TextInput).props.autoFocus).toBe(false);
    await waitFor(() => expect(focusSpy).toHaveBeenCalled());
  });

  it('after Check the disabled field gets no new focus, on the next card a NEW field gets it', async () => {
    const settle = () => act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    const { UNSAFE_getByType, getByText } = render(<PcicScreen />);
    await flush();
    await settle();
    const first = UNSAFE_getByType(TextInput);
    const focusesBeforeCheck = focusSpy.mock.calls.length;
    expect(focusesBeforeCheck).toBeGreaterThan(0);

    fireEvent.changeText(first, 'zzz');
    fireEvent.press(getByText('✓ Check'));
    await flush();
    await settle();
    expect(UNSAFE_getByType(TextInput).props.editable).toBe(false);
    expect(focusSpy).toHaveBeenCalledTimes(focusesBeforeCheck);

    fireEvent.press(getByText(/^Next →/));
    await flush();

    const second = UNSAFE_getByType(TextInput);
    expect(second).not.toBe(first);
    expect(second.props.editable).toBe(true);
    expect(second.props.autoFocus).toBe(false);
    expect(second.props.value).toBe('');
    await waitFor(() => expect(focusSpy.mock.calls.length).toBeGreaterThan(focusesBeforeCheck));
  });
});
