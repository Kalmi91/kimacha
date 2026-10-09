// The chat FAB and the Feedback modal on the brutalist palette (square BrutalBox,
// box modal), today's round button on the classic palette. Mock pattern: FeedbackModal.test.tsx.

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

describe('Feedback FAB, neo-brutalist', () => {
  it('with the brand palette a square BrutalBox FAB, the modal is a box too', async () => {
    await getDb().setGrammarPalette('brand');
    const view = render(<ThemeProvider><FeedbackButton level="B1" languagePair="es-en" currentCard="pcic" /></ThemeProvider>);
    await flush();
    expect(view.queryByTestId('feedback-fab')).toBeTruthy();
    fireEvent.press(view.getByText('💬'));
    expect(view.queryByTestId('feedback-modal')).toBeTruthy();
    view.unmount();
  });

  it('with the classic palette the current round button: no BrutalBox', async () => {
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
