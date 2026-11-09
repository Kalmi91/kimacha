// the table-deck's input field remounts for every new cell
// (focused by useFocusOnNewCard, not autoFocus), otherwise after Check the keyboard did not come up on the disabled and then
// re-enabled field. Mock pattern:
// app/grammar/deck/__tests__/tableDeck.play.test.tsx.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ topic: 'ser-estar' }),
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { TextInput } from 'react-native';

import { getDb } from '@/lib/database.web';
import TableDeckScreen from '../[topic]';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(3);

const focusSpy = jest.spyOn(TextInput.prototype as unknown as { focus: () => void }, 'focus').mockImplementation(() => {});

describe('table-deck: a fresh input field for every cell', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    focusSpy.mockClear();
    const db = getDb();
    await db.setOnboarding('en', 'es');
    await db.setGameProgress('grammar', 'ser-estar:tabledeck', 'progress', undefined as never).catch(() => {});
  });

  it('after Next the field is a NEW instance, editable and focused', async () => {
    render(<TableDeckScreen />);
    await flush();
    const first = screen.getByTestId('tabledeck-input');
    await act(async () => { await new Promise((r) => setTimeout(r, 250)); });
    expect(focusSpy).toHaveBeenCalledTimes(1);

    fireEvent.changeText(first, 'zzz');
    fireEvent.press(screen.getByText('✓ Check'));
    await flush();
    expect(screen.getByTestId('tabledeck-input').props.editable).toBe(false);

    fireEvent.press(screen.getByText('Next →'));
    await flush();

    const second = screen.getByTestId('tabledeck-input');
    expect(second).not.toBe(first);
    expect(second.props.editable).toBe(true);
    await act(async () => { await new Promise((r) => setTimeout(r, 250)); });
    expect(focusSpy).toHaveBeenCalledTimes(2);
    expect(second.props.value).toBe('');
  });
});
