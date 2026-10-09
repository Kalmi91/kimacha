// the V2 pilot lesson (ser-estar) on the lesson screen: the body
// (LessonBody) renders, and reading aloud goes through a single play<->stop button,
// not through the real engine of lib/speech, which is mocked out here.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  useLocalSearchParams: () => ({ topic: 'ser-estar' }),
}));

import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { speakSequence } from '@/lib/speech';
import GrammarLessonScreen from '../[topic]';

const flush = async (times = 3) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('grammar course, V2 pilot lesson (ser-estar)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
  });

  it('renders the body blocks (a lesson table) instead of rule/more prose', async () => {
    const view = render(<GrammarLessonScreen />);
    await flush(4);
    expect(screen.queryByTestId('table-ser-presente')).toBeTruthy();
    expect(screen.queryByTestId('table-estar-presente')).toBeTruthy();
    view.unmount();
  });

  it('toggles the read-aloud button to stop while speaking, and back on end', async () => {
    const view = render(<GrammarLessonScreen />);
    await flush(4);

    const toggle = () => within(screen.getByTestId('speakToggle'));
    expect(toggle().queryByText('⏹')).toBeFalsy();

    fireEvent.press(screen.getByTestId('speakToggle'));
    await flush(1);
    expect(toggle().queryByText('⏹')).toBeTruthy();
    expect(toggle().queryByText('🔊')).toBeFalsy();

    // The screen passed an onEnd callback to speakSequence; the engine calls
    // it when the last segment finishes, which flips the button back.
    const onEnd = (speakSequence as jest.Mock).mock.calls[0][1] as () => void;
    act(() => onEnd());
    await flush(1);
    expect(toggle().queryByText('🔊')).toBeTruthy();
    expect(toggle().queryByText('⏹')).toBeFalsy();

    view.unmount();
  });
});
