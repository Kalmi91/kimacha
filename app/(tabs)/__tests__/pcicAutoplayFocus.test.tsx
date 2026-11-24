// The word-card tab mounts at launch; if the learner leaves it before the load finishes, the first card
// must not be read aloud on the other tab.
// Mock pattern: pcicRefocus.test.tsx, with a useFocusEffect that keeps every callback and its cleanup.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

const mockCleanups: (() => void)[] = [];
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = require('react');
    useEffect(() => {
      const cleanup = cb();
      if (typeof cleanup === 'function') mockCleanups.push(cleanup);
    }, []);
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
import { TextInput } from 'react-native';

import { getDb } from '@/lib/database';
import { speakAuto } from '@/lib/speech';
import PcicScreen from '../index';

const mockSpeakAuto = speakAuto as jest.Mock;

const flush = async (times = 6) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('PCIC tab: read-aloud only while focused', () => {
  let focusSpy: jest.SpyInstance;

  beforeEach(async () => {
    await getDb().resetPcicCards();
    mockSpeakAuto.mockClear();
    mockCleanups.length = 0;
    focusSpy = jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => {});
  });

  afterEach(() => {
    focusSpy.mockRestore();
  });

  it('focused the whole time: the first card prompt is read after the load', async () => {
    render(<PcicScreen />);
    await flush();
    expect(mockSpeakAuto).toHaveBeenCalledWith('life', 'en-US');
  });

  it('blurred before the load finishes: the prompt is not read', async () => {
    render(<PcicScreen />);
    act(() => {
      mockCleanups.forEach((c) => c());
    });
    await flush();
    expect(mockSpeakAuto).not.toHaveBeenCalledWith('life', 'en-US');
  });
});
