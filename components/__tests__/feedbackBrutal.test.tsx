// NY19: a chat-FAB és a Feedback modal brutalista palettán (négyzetes BrutalBox,
// doboz-modal), classic palettán a mai kör-gomb. Mock-minta: FeedbackModal.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('@/lib/buildFlavor', () => ({ IS_PLAY_BUILD: false, FEEDBACK_URL: 'https://example.test/feedback' }));

import { act, fireEvent, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';
import FeedbackButton from '../FeedbackModal';

jest.setTimeout(30000);

const flush = async (times = 6) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('Feedback FAB, neo-brutalista (NY19)', () => {
  it('brand palettán négyzetes BrutalBox FAB, a modal is doboz', async () => {
    await getDb().setGrammarPalette('brand');
    const view = render(<ThemeProvider><FeedbackButton level="B1" languagePair="es-en" currentCard="pcic" /></ThemeProvider>);
    await flush();
    expect(view.queryByTestId('feedback-fab')).toBeTruthy();
    fireEvent.press(view.getByText('💬'));
    expect(view.queryByTestId('feedback-modal')).toBeTruthy();
    view.unmount();
  });

  it('classic palettán a mai kör-gomb: nincs BrutalBox', async () => {
    await getDb().setGrammarPalette('classic');
    const view = render(<ThemeProvider><FeedbackButton level="B1" languagePair="es-en" currentCard="pcic" /></ThemeProvider>);
    await flush();
    expect(view.queryByTestId('feedback-fab')).toBeNull();
    fireEvent.press(view.getByText('💬'));
    expect(view.queryByTestId('feedback-modal')).toBeNull();
    expect(view.queryByText('Feedback')).toBeTruthy();
    view.unmount();
  });
});
