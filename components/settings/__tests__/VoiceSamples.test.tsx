// EJSZAKA E109: the sample sentence and the play buttons on the Settings -> Voice cards. The button plays the sample
// of its own voice (engine + person), shows its state, and never changes the picked voice.

import { Pressable, View } from 'react-native';
import { fireEvent, render, within } from '@testing-library/react-native';

import { ThemeProvider } from '@/lib/ThemeContext';
import { DEFAULT_SPEAKERS, PIPER_MODEL_KEYS } from '@/lib/neuralVoices';
import { setSpeakerChoices } from '@/lib/voicePreference';
import { SAMPLE_SENTENCES } from '@/lib/voiceSampleData';
import SpeakerPickerRows from '../SpeakerPickerRows';

let mockState: any;
let mockPlaying: string | null = null;
const mockPlay = jest.fn();
const mockStop = jest.fn();
jest.mock('@/lib/neuralModels', () => ({
  useNeuralState: () => mockState,
  setNeuralEngine: jest.fn(),
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
  installed: { ...Object.fromEntries(PIPER_MODEL_KEYS.map(key => [key, true])), kokoro: true },
  download: { running: false, percent: 0, phase: 'download', failed: [] },
  issues: {},
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
  it('every card shows the label and its sentence and a play button per voice, with the Better voice off', () => {
    const view = show();
    expect(view.getAllByText('Example sentence')).toHaveLength(4);
    for (const lang of ['es', 'en', 'hu', 'de'] as const) {
      expect(view.getByText(SAMPLE_SENTENCES[lang])).toBeTruthy();
      expect(view.getByTestId(`voice-sample-${lang}-piper-f`)).toBeTruthy();
      expect(view.getByTestId(`voice-sample-${lang}-piper-m`)).toBeTruthy();
    }
    expect(view.getByTestId('voice-sample-es-kokoro-f')).toBeTruthy();
    expect(view.getByTestId('voice-sample-en-kokoro-m')).toBeTruthy();
    expect(view.queryByTestId('voice-sample-hu-kokoro-f')).toBeNull();
  });

  it('the play button plays the sample of its own engine and person, and does not change the choice', () => {
    const view = show();
    fireEvent.press(view.getByTestId('voice-sample-es-kokoro-m'));
    expect(mockPlay).toHaveBeenLastCalledWith('es', 'kokoro', 'm');
    fireEvent.press(view.getByTestId('voice-sample-en-piper-f'));
    expect(mockPlay).toHaveBeenLastCalledWith('en', 'piper', 'f');
    fireEvent.press(view.getByTestId('voice-sample-hu-piper-m'));
    expect(mockPlay).toHaveBeenLastCalledWith('hu', 'piper', 'm');
    expect(view.getByTestId('settings-speaker-es-piper-f').props.accessibilityState.checked).toBe(true);
    expect(view.getByTestId('settings-speaker-es-kokoro-m').props.accessibilityState.checked).toBe(false);
  });

  it('the playing button shows a stop sign and a selected state, and a second tap stops it', () => {
    mockPlaying = 'en-piper-m';
    const view = show();
    const playing = view.getByTestId('voice-sample-en-piper-m');
    expect(playing.props.accessibilityState.selected).toBe(true);
    expect(view.getByTestId('voice-sample-en-piper-f').props.accessibilityState.selected).toBe(false);
    expect(view.getAllByText('■')).toHaveLength(1);
    expect(within(playing).getByText('Stop')).toBeTruthy();
    expect(within(playing).queryByText('Listen')).toBeNull();
    expect(view.getAllByText('Listen')).toHaveLength(11);
    fireEvent.press(playing);
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('the labels name the person', () => {
    const view = show();
    expect(view.getByTestId('voice-sample-de-piper-m').props.accessibilityLabel).toBe('Play sample: Thorsten');
  });
});
