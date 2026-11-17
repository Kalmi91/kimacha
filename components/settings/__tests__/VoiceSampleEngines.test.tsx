// EJSZAKA E109: the sample buttons of the Piper and Kokoro voices in the picker. They play that voice's sample and never
// choose the voice, open a download question or change the choice (Kálmán 2026-11-17: one voice per language).

import { Alert, View } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { ThemeProvider } from '@/lib/ThemeContext';
import { DEFAULT_SPEAKERS, PIPER_MODEL_KEYS } from '@/lib/neuralVoices';
import { getSpeakerChoices, setSpeakerChoices } from '@/lib/voicePreference';
import SpeakerPickerRows from '../SpeakerPickerRows';

let mockState: any;
let mockPlaying: string | null = null;
const mockSetEngine = jest.fn();
const mockDownload = jest.fn();
const mockPlay = jest.fn();
const mockStop = jest.fn();
jest.mock('@/lib/neuralModels', () => ({
  downloadNeural: (...args: unknown[]) => mockDownload(...args),
  setNeuralEngine: (...args: unknown[]) => mockSetEngine(...args),
  setNeuralSpeaker: jest.fn(),
  useNeuralState: () => mockState,
}));
jest.mock('@/lib/voiceSample', () => ({
  useSamplePlaying: () => mockPlaying,
  playVoiceSample: (...args: unknown[]) => mockPlay(...args),
  stopVoiceSample: () => mockStop(),
}));

const allPiper = { ...Object.fromEntries(PIPER_MODEL_KEYS.map(key => [key, true])), kokoro: true };
const Row = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
const show = (lang: 'es' | 'en' | 'hu') =>
  render(
    <ThemeProvider>
      <View>
        <SpeakerPickerRows Row={Row} languages={[lang]} />
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

describe('sample buttons of the voices', () => {
  it('a Kokoro sample plays that voice without a download question, an engine change or a choice change', () => {
    const alert = jest.spyOn(Alert, 'alert');
    const view = show('es');
    fireEvent.press(view.getByTestId('voice-sample-es-kokoro-f'));
    expect(mockPlay).toHaveBeenLastCalledWith('es', 'kokoro', 'f');
    fireEvent.press(view.getByTestId('voice-sample-es-piper-m'));
    expect(mockPlay).toHaveBeenLastCalledWith('es', 'piper', 'm');
    expect(alert).not.toHaveBeenCalled();
    expect(mockSetEngine).not.toHaveBeenCalled();
    expect(mockDownload).not.toHaveBeenCalled();
    expect(view.getByTestId('settings-speaker-es-piper-f').props.accessibilityState.checked).toBe(true);
    expect(getSpeakerChoices().es).toBe('f');
  });

  it('the playing one shows a stop sign and selected, and a second tap stops it', () => {
    mockPlaying = 'es-kokoro-m';
    const view = show('es');
    const k = view.getByTestId('voice-sample-es-kokoro-m');
    expect(k.props.accessibilityState.selected).toBe(true);
    expect(view.getByTestId('voice-sample-es-kokoro-f').props.accessibilityState.selected).toBe(false);
    expect(view.getAllByText('■')).toHaveLength(1);
    fireEvent.press(k);
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(mockPlay).not.toHaveBeenCalled();
    expect(k.props.accessibilityLabel).toBe('Play sample: Alex');
  });

  it('a language without a Kokoro voice has no Kokoro sample', () => {
    const view = show('hu');
    expect(view.queryByTestId('voice-sample-hu-kokoro-f')).toBeNull();
    expect(view.getByTestId('voice-sample-hu-piper-f')).toBeTruthy();
  });
});
