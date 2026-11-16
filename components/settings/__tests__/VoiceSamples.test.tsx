// EJSZAKA E109: the sample sentence and the play buttons on the Settings -> Voice cards. The button plays the sample
// of the engine the card shows, shows its state, and never changes the picked person; Automatic has no button.

import { Pressable, View } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { ThemeProvider } from '@/lib/ThemeContext';
import { DEFAULT_SPEAKERS } from '@/lib/neuralVoices';
import { setSpeakerChoices } from '@/lib/voicePreference';
import { SAMPLE_SENTENCES } from '@/lib/voiceSampleData';
import SpeakerPickerRows from '../SpeakerPickerRows';

let mockState: any;
let mockPlaying: string | null = null;
const mockPlay = jest.fn();
const mockStop = jest.fn();
jest.mock('@/lib/neuralModels', () => ({
  useNeuralState: () => mockState,
  setNeuralFastFallback: jest.fn(),
  setNeuralSpeaker: jest.fn(),
}));
jest.mock('@/lib/voiceSample', () => ({
  useSamplePlaying: () => mockPlaying,
  playVoiceSample: (...args: unknown[]) => mockPlay(...args),
  stopVoiceSample: () => mockStop(),
}));

const stateWith = (over: Record<string, unknown> = {}) => ({
  supported: true,
  ready: true,
  enabled: false,
  engines: { es: 'piper', en: 'piper', hu: 'piper', de: 'piper' },
  installed: {},
  download: { running: false, percent: 0, phase: 'download', failed: [] },
  ...over,
});
const Row = ({ onPress, children }: { onPress?: () => void; children: React.ReactNode }) => (
  <Pressable onPress={onPress}>
    <View>{children}</View>
  </Pressable>
);
const show = () =>
  render(
    <ThemeProvider>
      <SpeakerPickerRows Row={Row} languages={['es', 'en', 'hu', 'de']} />
    </ThemeProvider>,
  );

beforeEach(() => {
  mockPlay.mockClear();
  mockStop.mockClear();
  mockPlaying = null;
  mockState = stateWith();
  setSpeakerChoices({ ...DEFAULT_SPEAKERS });
});

describe('voice samples on the Voice cards', () => {
  it('every card shows the label and its sentence and a play button per person, none for Automatic, with nothing downloaded and the Better voice off', () => {
    const view = show();
    expect(view.getAllByText('Example sentence')).toHaveLength(4);
    for (const lang of ['es', 'en', 'hu', 'de'] as const) {
      expect(view.getByText(SAMPLE_SENTENCES[lang])).toBeTruthy();
      expect(view.getByTestId(`voice-sample-${lang}-f`)).toBeTruthy();
      expect(view.getByTestId(`voice-sample-${lang}-m`)).toBeTruthy();
    }
    expect(view.queryByTestId('voice-sample-es-auto')).toBeNull();
  });

  it('the play button plays the sample of the engine the card shows, and does not change the choice', () => {
    mockState = stateWith({ engines: { es: 'kokoro', en: 'piper', hu: 'piper', de: 'piper' } });
    const view = show();
    fireEvent.press(view.getByTestId('voice-sample-es-m'));
    expect(mockPlay).toHaveBeenLastCalledWith('es', 'kokoro', 'm');
    fireEvent.press(view.getByTestId('voice-sample-en-f'));
    expect(mockPlay).toHaveBeenLastCalledWith('en', 'piper', 'f');
    fireEvent.press(view.getByTestId('voice-sample-hu-m'));
    expect(mockPlay).toHaveBeenLastCalledWith('hu', 'piper', 'm');
    expect(view.getByTestId('settings-speaker-es-auto').props.accessibilityState.checked).toBe(true);
    expect(view.getByTestId('settings-speaker-es-m').props.accessibilityState.checked).toBe(false);
  });

  it('the playing button shows a stop sign and a selected state, and a second tap stops it', () => {
    mockPlaying = 'en-piper-m';
    const view = show();
    const playing = view.getByTestId('voice-sample-en-m');
    expect(playing.props.accessibilityState.selected).toBe(true);
    expect(view.getByTestId('voice-sample-en-f').props.accessibilityState.selected).toBe(false);
    expect(view.getAllByText('■')).toHaveLength(1);
    fireEvent.press(playing);
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('the labels name the person', () => {
    const view = show();
    expect(view.getByTestId('voice-sample-de-m').props.accessibilityLabel).toBe('Play sample: Thorsten');
  });
});
