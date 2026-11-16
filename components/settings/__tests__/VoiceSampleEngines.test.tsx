// EJSZAKA E109: the sample buttons beside the Sentence voice engine choice (Piper / Kokoro). They play the engine's
// sample in the picked person's voice and never choose the engine, open a download question or change the choice.

import { Alert, View } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { ThemeProvider } from '@/lib/ThemeContext';
import { DEFAULT_SPEAKERS, PIPER_MODEL_KEYS } from '@/lib/neuralVoices';
import { getSpeakerChoices, setSpeakerChoices } from '@/lib/voicePreference';
import { SentenceVoiceChoices } from '../BetterVoiceRows';

let mockState: any;
let mockPlaying: string | null = null;
const mockSetEngine = jest.fn();
const mockDownload = jest.fn();
const mockPlay = jest.fn();
const mockStop = jest.fn();
jest.mock('@/lib/neuralModels', () => ({
  downloadNeural: (...args: unknown[]) => mockDownload(...args),
  setNeuralEnabled: jest.fn(),
  setNeuralEngine: (...args: unknown[]) => mockSetEngine(...args),
  useNeuralState: () => mockState,
}));
jest.mock('@/lib/voiceSample', () => ({
  useSamplePlaying: () => mockPlaying,
  playVoiceSample: (...args: unknown[]) => mockPlay(...args),
  stopVoiceSample: () => mockStop(),
}));

const allPiper = Object.fromEntries(PIPER_MODEL_KEYS.map(key => [key, true]));
const show = (lang: 'es' | 'en' | 'hu') =>
  render(
    <ThemeProvider>
      <View>
        <SentenceVoiceChoices lang={lang} />
      </View>
    </ThemeProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockPlaying = null;
  mockState = {
    supported: true,
    ready: true,
    enabled: true,
    engines: { es: 'piper', en: 'piper', hu: 'piper', de: 'piper' },
    installed: allPiper,
    download: { running: false, percent: 0, phase: 'download', failed: [] },
    issues: {},
  };
  setSpeakerChoices({ ...DEFAULT_SPEAKERS });
});

describe('sample buttons of the engine choice', () => {
  it('Automatic plays the female sample of each engine, without a download question or an engine change', () => {
    const alert = jest.spyOn(Alert, 'alert');
    const view = show('es');
    fireEvent.press(view.getByTestId('voice-sample-es-engine-kokoro'));
    expect(mockPlay).toHaveBeenLastCalledWith('es', 'kokoro', 'f');
    fireEvent.press(view.getByTestId('voice-sample-es-engine-piper'));
    expect(mockPlay).toHaveBeenLastCalledWith('es', 'piper', 'f');
    expect(alert).not.toHaveBeenCalled();
    expect(mockSetEngine).not.toHaveBeenCalled();
    expect(mockDownload).not.toHaveBeenCalled();
    expect(view.getByTestId('settings-better-voice-es-piper').props.accessibilityState.selected).toBe(true);
  });

  it('a male choice plays the male sample, a female choice the female one, and the choice stays', () => {
    setSpeakerChoices({ ...DEFAULT_SPEAKERS, en: 'm', es: 'f' });
    const view = show('en');
    fireEvent.press(view.getByTestId('voice-sample-en-engine-kokoro'));
    expect(mockPlay).toHaveBeenLastCalledWith('en', 'kokoro', 'm');
    expect(getSpeakerChoices().en).toBe('m');
    const es = show('es');
    fireEvent.press(es.getByTestId('voice-sample-es-engine-kokoro'));
    expect(mockPlay).toHaveBeenLastCalledWith('es', 'kokoro', 'f');
  });

  it('the playing one shows a stop sign and selected, and a second tap stops it', () => {
    mockPlaying = 'es-kokoro-f';
    const view = show('es');
    const k = view.getByTestId('voice-sample-es-engine-kokoro');
    expect(k.props.accessibilityState.selected).toBe(true);
    expect(view.getByTestId('voice-sample-es-engine-piper').props.accessibilityState.selected).toBe(false);
    expect(view.getAllByText('■')).toHaveLength(1);
    fireEvent.press(k);
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(mockPlay).not.toHaveBeenCalled();
    expect(k.props.accessibilityLabel).toBe('Play sample: Kokoro');
  });

  it('a language without an engine choice has no such button', () => {
    const view = show('hu');
    expect(view.queryByTestId('voice-sample-hu-engine-kokoro')).toBeNull();
    expect(view.queryByTestId('voice-sample-hu-engine-piper')).toBeNull();
  });
});
