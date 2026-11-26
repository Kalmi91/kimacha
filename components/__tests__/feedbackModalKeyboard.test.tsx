// Phone, 11-25: with the card's keyboard up, the letters typed into the opened feedback modal reached only Gboard's
// suggestion bar, the field stayed empty. The 💬 closes that keyboard first and opens the modal once it is down, and
// the field asks for the keyboard only once the modal's own window is up (onShow).
import { act, fireEvent, render } from '@testing-library/react-native';
import { Keyboard, TextInput } from 'react-native';
import FeedbackButton from '../FeedbackModal';

jest.mock('@/lib/buildFlavor', () => ({ IS_PLAY_BUILD: false, FEEDBACK_URL: 'https://example.test/feedback' }));
jest.mock('@/lib/cloud/session', () => ({ loadSession: jest.fn(() => null) }));

let hideListener: (() => void) | null = null;
const focus = jest.fn();
const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });
const renderButton = () => render(<FeedbackButton level="B1" languagePair="es-en" currentCard="pcic" />);

beforeEach(() => {
  jest.useFakeTimers();
  hideListener = null;
  focus.mockReset();
  jest.spyOn(TextInput.prototype as unknown as { focus: () => void }, 'focus').mockImplementation(focus);
  jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: () => void) => {
    if (event === 'keyboardDidHide') hideListener = cb;
    return { remove: jest.fn() };
  }) as never);
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('FeedbackModal and the keyboard', () => {
  it('with the keyboard down, the 💬 opens the modal at once', () => {
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
    const { getByText, queryByText } = renderButton();
    fireEvent.press(getByText('💬'));
    expect(Keyboard.dismiss).not.toHaveBeenCalled();
    expect(queryByText('Feedback')).toBeTruthy();
  });

  it('with the card keyboard up, the 💬 closes it first and opens the modal once it is down', () => {
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
    const { getByText, queryByText } = renderButton();
    fireEvent.press(getByText('💬'));
    expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
    expect(queryByText('Feedback')).toBeNull();
    act(() => { hideListener?.(); });
    expect(queryByText('Feedback')).toBeTruthy();
  });

  it('opens the modal after 600 ms even when no keyboardDidHide comes', () => {
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
    const { getByText, queryByText } = renderButton();
    fireEvent.press(getByText('💬'));
    advance(599);
    expect(queryByText('Feedback')).toBeNull();
    advance(1);
    expect(queryByText('Feedback')).toBeTruthy();
  });

  it('the field asks for the keyboard only once the modal window is up (onShow)', () => {
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
    const { getByText, getByPlaceholderText } = renderButton();
    fireEvent.press(getByText('💬'));
    advance(3000);
    expect(focus).not.toHaveBeenCalled();
    fireEvent(getByPlaceholderText('Share your thoughts...'), 'show');
    advance(149);
    expect(focus).not.toHaveBeenCalled();
    advance(1);
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('a modal opened again waits for its own onShow too', () => {
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
    const { getByText, getByPlaceholderText } = renderButton();
    fireEvent.press(getByText('💬'));
    fireEvent(getByPlaceholderText('Share your thoughts...'), 'show');
    advance(3000);
    fireEvent.press(getByText('Cancel'));
    focus.mockReset();
    fireEvent.press(getByText('💬'));
    advance(3000);
    expect(focus).not.toHaveBeenCalled();
    fireEvent(getByPlaceholderText('Share your thoughts...'), 'show');
    advance(150);
    expect(focus).toHaveBeenCalledTimes(1);
  });
});
