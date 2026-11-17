// Settings -> Voice, "who reads": one block per language with ONE radio list of voices (engine + person), exactly one
// row checked per language, the choice handed to lib/neuralModels (Kálmán 2026-11-17).

import { Alert, Pressable, View } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { ThemeProvider } from '@/lib/ThemeContext';
import { DEFAULT_SPEAKERS, PIPER_MODEL_KEYS } from '@/lib/neuralVoices';
import { setSpeakerChoices } from '@/lib/voicePreference';
import SpeakerPickerRows from '../SpeakerPickerRows';

let mockState: any;
const mockSetSpeaker = jest.fn();
const mockSetEngine = jest.fn();
jest.mock('@/lib/neuralModels', () => ({
  useNeuralState: () => mockState,
  setNeuralEngine: (lang: string, engine: string) => {
    mockSetEngine(lang, engine);
    mockState = { ...mockState, engines: { ...mockState.engines, [lang]: engine } };
    return Promise.resolve();
  },
  setNeuralSpeaker: (lang: string, choice: string) => {
    mockSetSpeaker(lang, choice);
    require('@/lib/voicePreference').setSpeakerChoice(lang, choice);
  },
}));

const allPiper = Object.fromEntries(PIPER_MODEL_KEYS.map(key => [key, true]));
const stateWith = (over: Record<string, unknown> = {}) => ({
  supported: true,
  ready: true,
  enabled: true,
  engines: { es: 'piper', en: 'piper', hu: 'piper', de: 'piper' },
  installed: { ...allPiper, kokoro: true },
  download: { running: false, percent: 0, phase: 'download', failed: [] },
  issues: {},
  ...over,
});

const Row = ({ onPress, children }: { onPress?: () => void; children: React.ReactNode }) => (
  <Pressable onPress={onPress}>
    <View>{children}</View>
  </Pressable>
);
const tree = () => (
  <ThemeProvider>
    <SpeakerPickerRows Row={Row} languages={['es', 'en', 'hu', 'de']} />
  </ThemeProvider>
);
const show = () => render(tree());
const rowIds = (view: ReturnType<typeof show>, lang: string) =>
  view.queryAllByTestId(new RegExp(`^settings-speaker-${lang}-(piper|kokoro)-(f|m)$`)).map(node => node.props.testID as string);
const checked = (view: ReturnType<typeof show>, lang: string) =>
  rowIds(view, lang)
    .filter(id => view.getByTestId(id).props.accessibilityState.checked)
    .map(id => id.replace(`settings-speaker-${lang}-`, ''));

beforeEach(() => {
  mockSetSpeaker.mockClear();
  mockSetEngine.mockClear();
  setSpeakerChoices({ ...DEFAULT_SPEAKERS });
});

describe('SpeakerPickerRows', () => {
  it('es and en show 4 voices (Piper and Kokoro, female and male), hu and de 2 (Piper), named with their sex', () => {
    mockState = stateWith();
    const view = show();
    expect(rowIds(view, 'es')).toHaveLength(4);
    expect(rowIds(view, 'en')).toHaveLength(4);
    expect(rowIds(view, 'hu')).toHaveLength(2);
    expect(rowIds(view, 'de')).toHaveLength(2);
    for (const text of [
      'Español', 'English', 'Magyar', 'Deutsch',
      'Claude, female', 'Ald, male', 'Dora, female', 'Alex, male', 'Kristin, female', 'John, male', 'Heart, female', 'Michael, male',
      'Berta, female', 'Imre, male', 'Kerstin, female', 'Thorsten, male',
    ]) {
      expect(view.getByText(text)).toBeTruthy();
    }
    expect(view.queryByText('Automatic (fastest)')).toBeNull();
  });

  it('the Kokoro rows are hidden until every Piper model is installed', () => {
    mockState = stateWith({ installed: {} });
    const view = show();
    expect(rowIds(view, 'es')).toHaveLength(2);
    expect(view.queryByText('Dora, female')).toBeNull();
  });

  it('exactly one row is checked per language to begin with: the Piper female', () => {
    mockState = stateWith();
    const view = show();
    for (const lang of ['es', 'en', 'hu', 'de']) expect(checked(view, lang)).toEqual(['piper-f']);
    expect(view.getAllByText('✓')).toHaveLength(4);
  });

  it('tapping Kokoro male (model installed) sets the engine and the person, and only that row is checked', () => {
    mockState = stateWith();
    const view = show();
    fireEvent.press(view.getByTestId('settings-speaker-es-kokoro-m'));
    expect(mockSetEngine).toHaveBeenCalledWith('es', 'kokoro');
    expect(mockSetSpeaker).toHaveBeenCalledWith('es', 'm');
    view.rerender(tree());
    expect(checked(view, 'es')).toEqual(['kokoro-m']);
    expect(checked(view, 'en')).toEqual(['piper-f']);
  });

  it('a person of the engine already chosen changes the person only', () => {
    mockState = stateWith();
    const view = show();
    fireEvent.press(view.getByTestId('settings-speaker-hu-piper-m'));
    expect(mockSetSpeaker).toHaveBeenCalledWith('hu', 'm');
    expect(mockSetEngine).not.toHaveBeenCalled();
  });

  it('a Kokoro row with the Kokoro model missing asks first and changes nothing on cancel', () => {
    mockState = stateWith({ installed: allPiper });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const view = show();
    expect(view.getAllByText(/Kokoro needs a/).length).toBeGreaterThan(0);
    fireEvent.press(view.getByTestId('settings-speaker-es-kokoro-f'));
    expect(alert).toHaveBeenCalledTimes(1);
    const buttons = alert.mock.calls[0][2] as { style?: string; onPress?: () => void }[];
    buttons.find(b => b.style === 'cancel')?.onPress?.();
    expect(mockSetEngine).not.toHaveBeenCalled();
    expect(mockSetSpeaker).not.toHaveBeenCalled();
    expect(checked(view, 'es')).toEqual(['piper-f']);
    buttons.find(b => b.style !== 'cancel')?.onPress?.();
    expect(mockSetEngine).toHaveBeenCalledWith('es', 'kokoro');
    expect(mockSetSpeaker).toHaveBeenCalledWith('es', 'f');
    alert.mockRestore();
  });

  it('every row has its own sample button', () => {
    mockState = stateWith();
    const view = show();
    expect(view.getByTestId('voice-sample-es-kokoro-m')).toBeTruthy();
    expect(view.getByTestId('voice-sample-hu-piper-f')).toBeTruthy();
  });

  it('is hidden where the better voice does not exist (the web build)', () => {
    mockState = stateWith({ supported: false });
    const view = show();
    expect(view.toJSON()).toBeNull();
  });

  it('has no fast-fallback switch any more', () => {
    mockState = stateWith();
    const view = show();
    expect(view.queryByTestId('settings-fast-fallback')).toBeNull();
    expect(view.queryByText('Fast fallback')).toBeNull();
  });
});
