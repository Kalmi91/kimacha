// Settings -> Voice, "who reads": one block per language with Automatic and the two people of the language's
// engine pair, exactly one row checked per language, the choice handed to lib/neuralModels.

import { Pressable, View } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { ThemeProvider } from '@/lib/ThemeContext';
import { DEFAULT_SPEAKERS } from '@/lib/neuralVoices';
import { setSpeakerChoices } from '@/lib/voicePreference';
import SpeakerPickerRows from '../SpeakerPickerRows';

let mockState: any;
const mockSetSpeaker = jest.fn();
jest.mock('@/lib/neuralModels', () => ({
  useNeuralState: () => mockState,
  setNeuralSpeaker: (lang: string, choice: string) => {
    mockSetSpeaker(lang, choice);
    require('@/lib/voicePreference').setSpeakerChoice(lang, choice);
  },
}));

const stateWith = (over: Record<string, unknown> = {}) => ({
  supported: true,
  ready: true,
  enabled: true,
  engines: { es: 'piper', en: 'piper', hu: 'piper' },
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
      <SpeakerPickerRows Row={Row} />
    </ThemeProvider>,
  );
const checked = (view: ReturnType<typeof show>, lang: string) =>
  (['auto', 'f', 'm'] as const).filter(choice => view.getByTestId(`settings-speaker-${lang}-${choice}`).props.accessibilityState.checked);

beforeEach(() => {
  mockSetSpeaker.mockClear();
  setSpeakerChoices({ ...DEFAULT_SPEAKERS });
});

describe('SpeakerPickerRows', () => {
  it('shows a block per language with Automatic and the two people of the Piper pair, named with their sex', () => {
    mockState = stateWith();
    const view = show();
    for (const text of [
      'Who reads Español', 'Who reads English', 'Who reads Magyar',
      'Claude, female', 'Ald, male', 'Kristin, female', 'John, male', 'Berta, female', 'Imre, male',
    ]) {
      expect(view.getByText(text)).toBeTruthy();
    }
    expect(view.getAllByText('Automatic (fastest)')).toHaveLength(3);
  });

  it('the people follow the engine of the language: Kokoro es and en show Dora / Alex and Heart / Michael', () => {
    mockState = stateWith({ engines: { es: 'kokoro', en: 'kokoro', hu: 'piper' } });
    const view = show();
    for (const text of ['Dora, female', 'Alex, male', 'Heart, female', 'Michael, male', 'Berta, female']) {
      expect(view.getByText(text)).toBeTruthy();
    }
    expect(view.queryByText('Claude, female')).toBeNull();
  });

  it('a hint under each person row says the other person\'s words start a little slower; Automatic has none', () => {
    mockState = stateWith();
    const view = show();
    expect(view.getAllByText('Recordings of the other person\'s words start a little slower.')).toHaveLength(6);
  });

  it('Automatic is checked in every language to begin with: exactly one row per language', () => {
    mockState = stateWith();
    const view = show();
    for (const lang of ['es', 'en', 'hu']) expect(checked(view, lang)).toEqual(['auto']);
  });

  it('tapping a person checks it (and only it), hands the choice on, and leaves the other languages alone', () => {
    mockState = stateWith();
    const view = show();
    fireEvent.press(view.getByTestId('settings-speaker-es-m'));
    expect(mockSetSpeaker).toHaveBeenCalledWith('es', 'm');
    expect(checked(view, 'es')).toEqual(['m']);
    expect(checked(view, 'en')).toEqual(['auto']);
    fireEvent.press(view.getByTestId('settings-speaker-es-f'));
    expect(checked(view, 'es')).toEqual(['f']);
    fireEvent.press(view.getByTestId('settings-speaker-es-auto'));
    expect(mockSetSpeaker).toHaveBeenLastCalledWith('es', 'auto');
    expect(checked(view, 'es')).toEqual(['auto']);
  });

  it('shows the check mark on the checked row only', () => {
    mockState = stateWith();
    setSpeakerChoices({ es: 'f', en: 'auto', hu: 'm' });
    const view = show();
    expect(view.getAllByText('✓')).toHaveLength(3); // one per language
    expect(checked(view, 'es')).toEqual(['f']);
    expect(checked(view, 'hu')).toEqual(['m']);
  });

  it('is hidden where the better voice does not exist (the web build)', () => {
    mockState = stateWith({ supported: false });
    const view = show();
    expect(view.toJSON()).toBeNull();
  });
});
