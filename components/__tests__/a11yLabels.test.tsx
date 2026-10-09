// Accessibility: the controls that show only an icon (🔊 / ⏹, 💬, ✕, the status strip, the switch,
// the back box) carry a role and a localized label (EN + ES). Mock pattern: speakButton.test.tsx,
// FeedbackModal.test.tsx, grammarDrillBrutal.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('@/lib/buildFlavor', () => ({ IS_PLAY_BUILD: false, FEEDBACK_URL: 'https://example.test/feedback' }));
const mockSpeak = jest.fn();
jest.mock('@/lib/speech', () => ({
  speak: (...args: unknown[]) => mockSpeak(...args),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import lessonJson from '@/data/games/grammar/es/presente-irregular.json';
import { getDb } from '@/lib/database';
import { setLanguage } from '@/lib/i18n';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';
import { ThemeProvider } from '@/lib/ThemeContext';
import FeedbackButton from '../FeedbackModal';
import GlossText from '../games/GlossText';
import GrammarDrill from '../grammar/GrammarDrill';
import { BrutalBackButton, BrutalSwitch } from '../grammar/Brutal';
import SpeakButton from '../SpeakButton';
import StatusBarStrip from '../StatusBarStrip';

jest.setTimeout(30000);

const lesson = lessonJson as unknown as LessonV2;

const flush = async (times = 6) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('a11y: icon-only controls', () => {
  beforeEach(() => mockSpeak.mockClear());
  afterEach(() => setLanguage('en'));

  describe.each(['classic', 'brand'] as const)('palette %s', (palette) => {
    beforeEach(async () => {
      await getDb().setGrammarPalette(palette);
    });

    it('SpeakButton: icon-only is "Play audio" / "Stop audio"; a visible label or a custom label is not overridden', async () => {
      const onPress = jest.fn();
      const view = render(
        <ThemeProvider>
          <SpeakButton testID="sp" onPress={onPress} />
        </ThemeProvider>
      );
      await flush();
      expect(view.getByTestId('sp').props.accessibilityLabel).toBe('Play audio');
      expect(view.getByTestId('sp').props.accessibilityRole).toBe('button');
      fireEvent.press(view.getByLabelText('Play audio'));
      expect(onPress).toHaveBeenCalledTimes(1);
      view.rerender(
        <ThemeProvider>
          <SpeakButton testID="sp" onPress={onPress} speaking />
        </ThemeProvider>
      );
      expect(view.getByLabelText('Stop audio')).toBeTruthy();
      view.rerender(
        <ThemeProvider>
          <SpeakButton testID="sp" onPress={onPress} label="Read aloud" />
        </ThemeProvider>
      );
      expect(view.getByTestId('sp').props.accessibilityLabel).toBeUndefined();
      view.rerender(
        <ThemeProvider>
          <SpeakButton testID="sp" onPress={onPress} accessibilityLabel="Custom" />
        </ThemeProvider>
      );
      expect(view.getByLabelText('Custom')).toBeTruthy();
      view.unmount();
    });

    it('SpeakButton: Spanish UI', async () => {
      setLanguage('es');
      const view = render(
        <ThemeProvider>
          <SpeakButton testID="sp" onPress={jest.fn()} />
        </ThemeProvider>
      );
      await flush();
      expect(view.getByLabelText('Reproducir audio')).toBeTruthy();
      view.unmount();
    });

    it('BrutalSwitch is a named switch and toggles; BrutalBackButton is a button named "Back"', async () => {
      const onValueChange = jest.fn();
      const onBack = jest.fn();
      const view = render(
        <ThemeProvider>
          <BrutalSwitch testID="sw" accessibilityLabel="Accents count" value={false} onValueChange={onValueChange} />
          <BrutalBackButton testID="bb" onPress={onBack} />
        </ThemeProvider>
      );
      await flush();
      expect(view.getByLabelText('Accents count').props.testID).toBe('sw');
      fireEvent(view.getByLabelText('Accents count'), palette === 'brand' ? 'press' : 'valueChange', true);
      expect(onValueChange).toHaveBeenCalledTimes(1);
      const back = view.getByLabelText('Back');
      expect(back.props.accessibilityRole).toBe('button');
      fireEvent.press(back);
      expect(onBack).toHaveBeenCalledTimes(1);
      view.unmount();
    });

    it('the 💬 feedback button is a button named "Feedback" and opens the modal', async () => {
      const view = render(
        <ThemeProvider>
          <FeedbackButton level="B1" languagePair="es-en" currentCard="pcic" />
        </ThemeProvider>
      );
      await flush();
      const fab = view.getByLabelText('Feedback');
      expect(fab.props.accessibilityRole).toBe('button');
      fireEvent.press(fab);
      expect(view.getByPlaceholderText('Share your thoughts...')).toBeTruthy();
      view.unmount();
    });

    it('the status-bar strip is a button named for what it does, and it still cycles the tint', async () => {
      const view = render(
        <ThemeProvider>
          <StatusBarStrip />
        </ThemeProvider>
      );
      await flush();
      const strip = view.getByLabelText('Change the color of the top strip');
      expect(strip.props.accessibilityRole).toBe('button');
      const before = StyleSheet.flatten(strip.props.style).backgroundColor;
      fireEvent.press(strip);
      await flush();
      const after = StyleSheet.flatten(view.getByLabelText('Change the color of the top strip').props.style).backgroundColor;
      expect(after).not.toBe(before);
      view.unmount();
    });

    it('the word-gloss bubble 🔊 is a button named "Play audio" and speaks the word', async () => {
      const view = render(
        <ThemeProvider>
          <GlossText
            text="vida"
            glosses={new Map()}
            learnedLang="es"
            forceOpen={{ learned: 'vida', native: 'life', isNew: true }}
            onForceClose={jest.fn()}
          />
        </ThemeProvider>
      );
      await flush();
      const speak = view.getByLabelText('Play audio');
      expect(speak.props.accessibilityRole).toBe('button');
      fireEvent.press(speak);
      expect(mockSpeak).toHaveBeenCalledWith('vida', 'es-MX');
      view.unmount();
    });
  });

  it('GrammarDrill: the ✕ of the brutalist header is named "Close" and calls onClose', async () => {
    await getDb().setGrammarPalette('brand');
    const onClose = jest.fn();
    const view = render(
      <ThemeProvider>
        <GrammarDrill topic={lesson} learnedLang="es" contentLang="en" onFinish={jest.fn()} kinds={['choice']} onClose={onClose} />
      </ThemeProvider>
    );
    await flush();
    const close = screen.getByLabelText('Close');
    expect(close.props.accessibilityRole).toBe('button');
    fireEvent.press(close);
    expect(onClose).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('GrammarDrill: Spanish UI, the ✕ is "Cerrar"', async () => {
    await getDb().setGrammarPalette('brand');
    setLanguage('es');
    const view = render(
      <ThemeProvider>
        <GrammarDrill topic={lesson} learnedLang="es" contentLang="es" onFinish={jest.fn()} kinds={['choice']} onClose={jest.fn()} />
      </ThemeProvider>
    );
    await flush();
    expect(screen.getByLabelText('Cerrar')).toBeTruthy();
    view.unmount();
  });
});
