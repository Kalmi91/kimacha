// the table-deck's input field remounts for every new cell
// (with autoFocus), otherwise after Check the keyboard did not come up on the disabled and then
// re-enabled field. Mock pattern:
// app/grammar/deck/__tests__/tableDeck.play.test.tsx.

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
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ topic: 'ser-estar' }),
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import TableDeckScreen from '../[topic]';

const flush = async (times = 3) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('table-deck: a fresh input field for every cell', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    const db = getDb();
    await db.setOnboarding('en', 'es');
    await db.setGameProgress('grammar', 'ser-estar:tabledeck', 'progress', undefined as never).catch(() => {});
  });

  it('after Next the field is a NEW instance, editable and autoFocus', async () => {
    render(<TableDeckScreen />);
    await flush();
    const first = screen.getByTestId('tabledeck-input');
    expect(first.props.autoFocus).toBe(true);

    fireEvent.changeText(first, 'zzz');
    fireEvent.press(screen.getByText('✓ Check'));
    await flush();
    expect(screen.getByTestId('tabledeck-input').props.editable).toBe(false);

    fireEvent.press(screen.getByText('Next →'));
    await flush();

    const second = screen.getByTestId('tabledeck-input');
    expect(second).not.toBe(first);
    expect(second.props.editable).toBe(true);
    expect(second.props.autoFocus).toBe(true);
    expect(second.props.value).toBe('');
  });
});
