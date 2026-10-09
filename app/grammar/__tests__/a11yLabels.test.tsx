// Accessibility: the ← of the lesson page and of the table-practice screen, and the 🔊 next to the
// lesson examples, are named buttons. Mock pattern: lessonBrutal.test.tsx, tableDeckBrutal.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
const mockSpeak = jest.fn();
jest.mock('@/lib/speech', () => ({
  speak: (...args: unknown[]) => mockSpeak(...args),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  useLocalSearchParams: () => ({ topic: 'ser-estar' }),
}));

import { act, fireEvent, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { setLanguage } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/ThemeContext';
import TableDeckScreen from '../deck/[topic]';
import GrammarLessonScreen from '../[topic]';

jest.setTimeout(30000);

const flush = async (times = 8) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('a11y: grammar lesson page and table practice', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    mockBack.mockClear();
    mockSpeak.mockClear();
  });
  afterEach(() => setLanguage('en'));

  describe.each(['classic', 'brand'] as const)('palette %s', (palette) => {
    it('lesson page: the ← is a button named "Back" and goes back; the 🔊 of an example is named "Play audio"', async () => {
      await getDb().setGrammarPalette(palette);
      const view = render(<ThemeProvider><GrammarLessonScreen /></ThemeProvider>);
      await flush();
      const back = view.getByLabelText('Back');
      expect(back.props.accessibilityRole).toBe('button');
      fireEvent.press(back);
      expect(mockBack).toHaveBeenCalledTimes(1);
      const speak = view.getAllByLabelText('Play audio')[0];
      expect(speak.props.accessibilityRole).toBe('button');
      fireEvent.press(speak);
      expect(mockSpeak).toHaveBeenCalledTimes(1);
      view.unmount();
    });

    it('table practice: the ← is a button named "Back" and goes back', async () => {
      await getDb().setGrammarPalette(palette);
      const view = render(<ThemeProvider><TableDeckScreen /></ThemeProvider>);
      await flush();
      const back = view.getByLabelText('Back');
      expect(back.props.accessibilityRole).toBe('button');
      fireEvent.press(back);
      expect(mockBack).toHaveBeenCalledTimes(1);
      view.unmount();
    });
  });

  it('Spanish UI: the lesson page back label is "Atrás"', async () => {
    await getDb().setGrammarPalette('classic');
    setLanguage('es');
    const view = render(<ThemeProvider><GrammarLessonScreen /></ThemeProvider>);
    await flush();
    expect(view.getByLabelText('Atrás')).toBeTruthy();
    view.unmount();
  });
});
