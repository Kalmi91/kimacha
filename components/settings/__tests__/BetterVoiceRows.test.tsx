// Settings, "Better voice": nothing downloads before a question that names the size. The download, the
// retry and the Kokoro choice all ask first; a choice that needs no download goes straight through.

import { Alert, View } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { ThemeProvider } from '@/lib/ThemeContext';
import { NEURAL_MODELS, PACK_KEY, PIPER_MODEL_KEYS, SENTENCES_KEY } from '@/lib/neuralVoices';
import BetterVoiceRows from '../BetterVoiceRows';

let mockState: any;
const mockDownload = jest.fn();
const mockSetEngine = jest.fn();
jest.mock('@/lib/neuralModels', () => ({
  downloadNeural: (...args: unknown[]) => mockDownload(...args),
  setNeuralEnabled: jest.fn(),
  setNeuralEngine: (...args: unknown[]) => mockSetEngine(...args),
  useNeuralState: () => mockState,
}));

const stateWith = (installed: Record<string, boolean>, engines = { es: 'piper', en: 'piper', hu: 'piper', de: 'piper' }) => ({
  supported: true,
  ready: true,
  enabled: true,
  engines,
  installed,
  download: { running: false, percent: 0, phase: 'download', failed: [] },
  issues: {} as Record<string, unknown>,
});
const allPiper = Object.fromEntries(PIPER_MODEL_KEYS.map(key => [key, true]));

const Row = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
const show = () =>
  render(
    <ThemeProvider>
      <BetterVoiceRows Row={Row} />
    </ThemeProvider>,
  );

// The buttons of the last confirming Alert.
const lastButtons = (alertSpy: jest.SpyInstance) => alertSpy.mock.calls[alertSpy.mock.calls.length - 1][2] as { text: string; onPress?: () => void }[];

let alertSpy: jest.SpyInstance;
beforeEach(() => {
  mockDownload.mockClear();
  mockSetEngine.mockClear();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => alertSpy.mockRestore());

describe('BetterVoiceRows: the size question', () => {
  it('the first download asks with the real size (both packs and eight voices), and only the confirm starts it', () => {
    mockState = stateWith({});
    const view = show();
    expect(view.getByText('Download (602 MB)')).toBeTruthy(); // the label counts the packs too
    fireEvent.press(view.getByTestId('settings-better-voice-download'));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0][0]).toBe('Download the better voice?');
    expect(alertSpy.mock.calls[0][1]).toContain('602 MB');
    expect(mockDownload).not.toHaveBeenCalled();
    lastButtons(alertSpy).find(b => b.text === 'Cancel')?.onPress?.();
    expect(mockDownload).not.toHaveBeenCalled();
    lastButtons(alertSpy).find(b => b.text === 'Download')?.onPress?.();
    expect(mockDownload).toHaveBeenCalledTimes(1);
  });

  it('a retry after a failed item asks too, with the size of what is still missing', () => {
    mockState = { ...stateWith({ ...allPiper, [SENTENCES_KEY]: true }), download: { running: false, percent: 80, phase: 'download', failed: [PACK_KEY] } };
    const view = show();
    fireEvent.press(view.getByTestId('settings-better-voice-retry'));
    expect(alertSpy.mock.calls[0][1]).toContain('114 MB');
    expect(mockDownload).not.toHaveBeenCalled();
    lastButtons(alertSpy).find(b => b.text === 'Download')?.onPress?.();
    expect(mockDownload).toHaveBeenCalledTimes(1);
  });

  it('choosing Kokoro asks with its size and switches only after the confirm', () => {
    mockState = stateWith({ ...allPiper, [PACK_KEY]: true, [SENTENCES_KEY]: true });
    const view = show();
    fireEvent.press(view.getByTestId('settings-better-voice-es-kokoro'));
    expect(alertSpy.mock.calls[0][1]).toContain('126 MB');
    expect(mockSetEngine).not.toHaveBeenCalled();
    lastButtons(alertSpy).find(b => b.text === 'Download')?.onPress?.();
    expect(mockSetEngine).toHaveBeenCalledWith('es', 'kokoro');
  });

  it('a choice that needs nothing from the net goes straight through', () => {
    mockState = stateWith({ ...allPiper, [PACK_KEY]: true, [SENTENCES_KEY]: true, kokoro: true }, { es: 'kokoro', en: 'piper', hu: 'piper', de: 'piper' });
    expect(NEURAL_MODELS.kokoro.bytes).toBeGreaterThan(0);
    const view = show();
    fireEvent.press(view.getByTestId('settings-better-voice-es-piper'));
    expect(mockSetEngine).toHaveBeenCalledWith('es', 'piper');
    fireEvent.press(view.getByTestId('settings-better-voice-en-kokoro')); // Kokoro is on the phone already
    expect(mockSetEngine).toHaveBeenCalledWith('en', 'kokoro');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('a phone that already has the voices is offered the sentence recordings, behind the same question', () => {
    mockState = stateWith({ ...allPiper, [PACK_KEY]: true });
    const view = show();
    expect(view.getByTestId('settings-better-voice')).toBeTruthy(); // the voice keeps working meanwhile
    fireEvent.press(view.getByText('Download (327 MB)'));
    expect(alertSpy.mock.calls[0][1]).toContain('327 MB');
    expect(mockDownload).not.toHaveBeenCalled();
    lastButtons(alertSpy).find(b => b.text === 'Download')?.onPress?.();
    expect(mockDownload).toHaveBeenCalledTimes(1);
  });
});

describe('BetterVoiceRows: why the chosen voice is not speaking', () => {
  it('says in words that Kokoro was too slow, or could not load, for that language only', () => {
    mockState = { ...stateWith(allPiper, { es: 'kokoro', en: 'piper', hu: 'piper', de: 'piper' }), issues: { es: { engine: 'kokoro', kind: 'slow', at: 1 } } };
    const view = show();
    expect(view.getByTestId('settings-better-voice-es-issue').props.children).toContain('Kokoro was too slow on this phone');
    expect(view.queryByTestId('settings-better-voice-en-issue')).toBeNull();
    mockState = { ...mockState, issues: { es: { engine: 'kokoro', kind: 'load-failed', at: 1 } } };
    view.rerender(
      <ThemeProvider>
        <BetterVoiceRows Row={Row} />
      </ThemeProvider>,
    );
    expect(view.getByTestId('settings-better-voice-es-issue').props.children).toContain('could not be loaded');
  });

  it('says nothing when the trouble belongs to an engine that is no longer the chosen one', () => {
    mockState = { ...stateWith(allPiper), issues: { es: { engine: 'kokoro', kind: 'slow', at: 1 } } };
    expect(show().queryByTestId('settings-better-voice-es-issue')).toBeNull();
  });
});
