// Coming back to the PCIC tab (blur, then focus) reads the prompt aloud again and refocuses the input field, as it did
// when every focus flipped `loading`; now the card stays on screen (no spinner) while the deck reloads.
// Mock pattern: pcicFocus.test.tsx + pcicSpeak.test.tsx, with a useFocusEffect that can be fired again.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
}));

let mockFocus: (() => void) | null = null;
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    mockFocus = cb;
    useEffect(cb, []);
  },
}));

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

import { act, render } from '@testing-library/react-native';
import { ActivityIndicator, TextInput } from 'react-native';

import { getDb } from '@/lib/database';
import { speak } from '@/lib/speech';
import PcicScreen from '../index';

const mockSpeak = speak as jest.Mock;

const flush = async (times = 6) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('PCIC tab: refocus', () => {
  let focusSpy: jest.SpyInstance;

  beforeEach(async () => {
    await getDb().resetPcicCards();
    mockSpeak.mockClear();
    focusSpy = jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => {});
  });

  afterEach(() => {
    focusSpy.mockRestore();
  });

  it('on returning to the tab the prompt is read again and the field is refocused, without a spinner', async () => {
    const { UNSAFE_queryByType } = render(<PcicScreen />);
    await flush();
    expect(mockSpeak).toHaveBeenCalledWith('life', 'en-US');
    mockSpeak.mockClear();
    focusSpy.mockClear();

    act(() => {
      mockFocus!();
    });
    // The card is still on screen right after the focus: no loading state in between.
    expect(UNSAFE_queryByType(ActivityIndicator)).toBeNull();
    expect(UNSAFE_queryByType(TextInput)).not.toBeNull();
    await flush();

    expect(mockSpeak).toHaveBeenCalledTimes(1);
    expect(mockSpeak).toHaveBeenCalledWith('life', 'en-US');
    expect(focusSpy).toHaveBeenCalled();
  });
});
