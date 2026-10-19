// A failed send (offline, or a non-2xx answer) keeps the typed text and shows
// an error; the thank-you toast only appears after a successful send.
import { act, fireEvent, render } from '@testing-library/react-native';
import FeedbackButton from '../FeedbackModal';

jest.mock('@/lib/buildFlavor', () => ({ IS_PLAY_BUILD: false, FEEDBACK_URL: 'https://example.test/feedback' }));

async function sendWith(fetchMock: jest.Mock) {
  global.fetch = fetchMock as never;
  const utils = render(<FeedbackButton level="B1" languagePair="en→es" currentCard="pcic:x1" />);
  fireEvent.press(utils.getByText('💬'));
  fireEvent.changeText(utils.getByPlaceholderText('Share your thoughts...'), 'Great app!');
  await act(async () => {
    fireEvent.press(utils.getByText('Send'));
  });
  return utils;
}

describe('FeedbackModal send errors', () => {
  afterEach(() => {
    // @ts-expect-error test-only cleanup of a global we set per test
    delete global.fetch;
  });

  it('fetch rejects: the text stays, an error shows, no thank-you', async () => {
    const { getByDisplayValue, getByText, queryByText } = await sendWith(jest.fn().mockRejectedValue(new Error('offline')));
    expect(getByDisplayValue('Great app!')).toBeTruthy();
    expect(getByText('Could not send. Please try again.')).toBeTruthy();
    expect(queryByText('Thank you!')).toBeNull();
  });

  it('fetch answers 500: the text stays, an error shows, no thank-you', async () => {
    const { getByDisplayValue, getByText, queryByText } = await sendWith(jest.fn().mockResolvedValue({ ok: false, status: 500 }));
    expect(getByDisplayValue('Great app!')).toBeTruthy();
    expect(getByText('Could not send. Please try again.')).toBeTruthy();
    expect(queryByText('Thank you!')).toBeNull();
  });

  it('fetch answers 200: the thank-you shows and the text is cleared', async () => {
    const { queryByDisplayValue, getByText, queryByText } = await sendWith(jest.fn().mockResolvedValue({ ok: true, status: 200 }));
    expect(getByText('Thank you!')).toBeTruthy();
    expect(queryByDisplayValue('Great app!')).toBeNull();
    expect(queryByText('Could not send. Please try again.')).toBeNull();
  });
});
