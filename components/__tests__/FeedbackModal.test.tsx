// P0 (Play-vágás 8. lépés): a 💬 gomb koppintására nyíljon meg a Feedback
// modal, és a küldés a flavor szerinti utat hívja (lib/buildFlavor.ts):
// Drive-flavor → fetch a FEEDBACK_URL-re, Play-flavor → Share.share, egyik
// se navigáljon el az appból (nincs router/Linking hívás ezen az úton).
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';
import FeedbackButton from '../FeedbackModal';

// Plain mutable object (not a `const` referenced by the factory closure, to
// dodge babel-plugin-jest-hoist's ordering rules): tests flip its fields
// per-case and the component reads them live through the module reference,
// so no jest.resetModules()/re-require dance (that duplicates the React
// module and breaks useContext, tried first, see FeedbackModal.tsx history).
jest.mock('@/lib/buildFlavor', () => ({ IS_PLAY_BUILD: false, FEEDBACK_URL: 'https://example.test/feedback' }));

describe('FeedbackModal (FeedbackButton)', () => {
  beforeEach(() => {
    const buildFlavor = require('@/lib/buildFlavor');
    buildFlavor.IS_PLAY_BUILD = false;
    buildFlavor.FEEDBACK_URL = 'https://example.test/feedback';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    // @ts-expect-error test-only cleanup of a global we set per test
    delete global.fetch;
  });

  it('opens the feedback modal when the 💬 button is tapped', () => {
    const { getByText, getByPlaceholderText, queryByText } = render(
      <FeedbackButton level="B1" languagePair="es-en" currentCard="pcic" />
    );

    expect(queryByText('Feedback')).toBeNull();
    fireEvent.press(getByText('💬'));

    expect(getByText('Feedback')).toBeTruthy();
    expect(getByPlaceholderText('Share your thoughts...')).toBeTruthy();
  });

  it('Drive-flavorban a küldés fetch-csel megy a FEEDBACK_URL-re, nem Share-rel', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    global.fetch = jest.fn().mockResolvedValue({ ok: true } as never);

    const { getByText, getByPlaceholderText } = render(
      <FeedbackButton level="B1" languagePair="es-en" currentCard="pcic:x1" />
    );
    fireEvent.press(getByText('💬'));
    fireEvent.changeText(getByPlaceholderText('Share your thoughts...'), 'Great app!');
    await act(async () => {
      fireEvent.press(getByText('Send'));
    });

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url.startsWith('https://example.test/feedback?')).toBe(true);
    expect(shareSpy).not.toHaveBeenCalled();
  });

  it('Play-flavorban a küldés a megosztás-lapot hívja, nem fetch-et', async () => {
    const buildFlavor = require('@/lib/buildFlavor');
    buildFlavor.IS_PLAY_BUILD = true;
    buildFlavor.FEEDBACK_URL = null;
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    global.fetch = jest.fn().mockResolvedValue({ ok: true } as never);

    const { getByText, getByPlaceholderText } = render(
      <FeedbackButton level="B1" languagePair="es-en" currentCard="pcic:x1" />
    );
    fireEvent.press(getByText('💬'));
    fireEvent.changeText(getByPlaceholderText('Share your thoughts...'), 'Great app!');
    await act(async () => {
      fireEvent.press(getByText('Send'));
    });

    await waitFor(() => expect(shareSpy).toHaveBeenCalledTimes(1));
    const message = shareSpy.mock.calls[0][0].message as string;
    expect(message).toContain('Great app!');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
