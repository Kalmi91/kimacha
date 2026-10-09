// Accessibility: the ← of the report and the deck, and the 🔊 of the revealed answer, are named
// buttons. Mock pattern: deck.test.tsx, brutal.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
const mockSpeak = jest.fn();
jest.mock('@/lib/speech', () => ({
  speak: (...args: unknown[]) => mockSpeak(...args),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

import { TextInput } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { setLanguage } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/ThemeContext';
import { validateMistakesPayload } from '@/lib/mistakes/format';
import sample from '@/lib/mistakes/__fixtures__/sample.json';
import MistakesDeckScreen from '../deck';
import MistakesReportScreen from '../index';

jest.setTimeout(30000);

const flush = async (times = 6) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('a11y: mistakes screens', () => {
  beforeAll(async () => {
    const result = validateMistakesPayload(sample);
    if (!result.ok) throw new Error(result.error);
    await getDb().saveMistakeBatch(result.batch.batchId, JSON.stringify(result.batch), '2026-09-23T10:00:00.000Z');
  });
  beforeEach(() => mockBack.mockClear());
  afterEach(() => setLanguage('en'));

  describe.each(['classic', 'brand'] as const)('palette %s', (palette) => {
    it('report: the ← is a button named "Back" and goes back', async () => {
      await getDb().setGrammarPalette(palette);
      const view = render(<ThemeProvider><MistakesReportScreen /></ThemeProvider>);
      await flush();
      const back = view.getByLabelText('Back');
      expect(back.props.accessibilityRole).toBe('button');
      fireEvent.press(back);
      expect(mockBack).toHaveBeenCalledTimes(1);
      view.unmount();
    });

    it('deck: the ← is named "Back"; after Check the 🔊 is a button named "Play audio" and speaks', async () => {
      await getDb().setGrammarPalette(palette);
      const view = render(<ThemeProvider><MistakesDeckScreen /></ThemeProvider>);
      await flush();
      expect(view.getByLabelText('Back').props.accessibilityRole).toBe('button');
      fireEvent.changeText(view.UNSAFE_getByType(TextInput), 'No tengo tomate.');
      fireEvent.press(view.getByText('✓ Check'));
      await flush();
      const speak = view.getByLabelText('Play audio');
      expect(speak.props.accessibilityRole).toBe('button');
      mockSpeak.mockClear(); // the answer is also read out automatically on reveal
      fireEvent.press(speak);
      expect(mockSpeak).toHaveBeenCalledTimes(1);
      view.unmount();
    });
  });

  it('Spanish UI: the report back label is "Atrás"', async () => {
    await getDb().setGrammarPalette('classic');
    setLanguage('es');
    const view = render(<ThemeProvider><MistakesReportScreen /></ThemeProvider>);
    await flush();
    expect(view.getByLabelText('Atrás')).toBeTruthy();
    view.unmount();
  });
});
