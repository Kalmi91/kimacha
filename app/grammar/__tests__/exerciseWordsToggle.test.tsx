// The exercise word list opens and closes from its own toggle (FB724).

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

const mockTopicId = 'imperfecto';
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  useLocalSearchParams: () => ({ topic: mockTopicId }),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import GrammarLessonScreen from '../[topic]';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(4);

describe('grammar lesson screen: exercise words toggle', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
  });

  it('the list is absent at first, opens on press and closes on the second press', async () => {
    const view = render(<GrammarLessonScreen />);
    await flush();

    expect(screen.queryByTestId('grammar-exercise-words')).toBeFalsy();

    fireEvent.press(screen.getByTestId('grammar-exercise-words-toggle'));
    expect(screen.getByTestId('grammar-exercise-words')).toBeTruthy();

    fireEvent.press(screen.getByTestId('grammar-exercise-words-toggle'));
    expect(screen.queryByTestId('grammar-exercise-words')).toBeFalsy();

    view.unmount();
  });
});
