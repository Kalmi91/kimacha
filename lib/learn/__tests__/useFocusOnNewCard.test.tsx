// The first focus of a cold start can be lost: the hook tries again (3 tries in about a second) until the field has the focus.
import { act, render } from '@testing-library/react-native';
import { useRef } from 'react';
import { Keyboard, TextInput } from 'react-native';

import { useFocusOnNewCard } from '../useFocusOnNewCard';

let focused = false;
const focus = jest.fn(() => {});

function Field({ ready = true, cardKey = 'a' }: { ready?: boolean; cardKey?: string }) {
  const ref = useRef<TextInput>(null);
  useFocusOnNewCard(ref, ready, cardKey);
  return <TextInput ref={ref} />;
}

const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

beforeEach(() => {
  jest.useFakeTimers();
  focused = false;
  focus.mockReset();
  jest.spyOn(TextInput.prototype as unknown as { focus: () => void }, 'focus').mockImplementation(focus);
  jest.spyOn(TextInput.prototype as unknown as { isFocused: () => boolean }, 'isFocused').mockImplementation(() => focused);
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('useFocusOnNewCard retry', () => {
  it('focuses after 150 ms and, while the focus did not stick, tries again, three times at most', () => {
    render(<Field />);
    advance(149);
    expect(focus).not.toHaveBeenCalled();
    advance(1);
    expect(focus).toHaveBeenCalledTimes(1);
    advance(300);
    expect(focus).toHaveBeenCalledTimes(2);
    advance(550);
    expect(focus).toHaveBeenCalledTimes(3);
    advance(5000);
    expect(focus).toHaveBeenCalledTimes(3);
  });

  it('a field that counts as focused but has no keyboard is blurred and focused again (the show request was lost)', () => {
    const blur = jest.spyOn(TextInput.prototype as unknown as { blur: () => void }, 'blur').mockImplementation(() => {});
    focus.mockImplementation(() => { focused = true; });
    render(<Field />);
    advance(150);
    expect(blur).not.toHaveBeenCalled();
    advance(5000);
    expect(blur).toHaveBeenCalledTimes(2);
    expect(focus).toHaveBeenCalledTimes(3);
  });

  it('stops retrying once the keyboard is up', () => {
    focus.mockImplementation(() => { focused = true; });
    render(<Field />);
    advance(150);
    (Keyboard.isVisible as jest.Mock).mockReturnValue(true);
    advance(5000);
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('does not retry while the keyboard is already up', () => {
    (Keyboard.isVisible as jest.Mock).mockReturnValue(true);
    render(<Field />);
    advance(5000);
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('a new card key starts over; a card that is no longer the active one stops', () => {
    const { rerender, unmount } = render(<Field cardKey="a" />);
    advance(150);
    rerender(<Field cardKey="b" />);
    advance(150);
    expect(focus).toHaveBeenCalledTimes(2);
    rerender(<Field cardKey="b" ready={false} />);
    advance(5000);
    expect(focus).toHaveBeenCalledTimes(2);
    unmount();
  });
});
