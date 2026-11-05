// Settings, "Better voice": nothing downloads before a question that names the size. The download, the
// retry and the Kokoro choice all ask first; a choice that needs no download goes straight through.

import { Alert, View } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { ThemeProvider } from '@/lib/ThemeContext';
import { NEURAL_MODELS, PACK_BYTES, PACK_KEY, PIPER_MODEL_KEYS, SENTENCE_PACK_BYTES, SENTENCES_KEY, formatMegabytes } from '@/lib/neuralVoices';
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
// the pack sizes are the built-in ones (lib/neuralVoices.ts), so a new pack release changes no test
const PACK_MB = formatMegabytes(PACK_BYTES);
const SENTENCES_MB = formatMegabytes(SENTENCE_PACK_BYTES);
const VOICES_MB = formatMegabytes(PIPER_MODEL_KEYS.reduce((sum, key) => sum + NEURAL_MODELS[key].bytes, 0));
const PACKS_MB = formatMegabytes(PACK_BYTES + SENTENCE_PACK_BYTES);
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
  it('the first download names and fetches the voice models only, and only the confirm starts it', () => {
    mockState = stateWith({});
    const view = show();
    expect(view.getByText(`Download (${VOICES_MB})`)).toBeTruthy(); // the voices alone, no recordings in the label
    fireEvent.press(view.getByTestId('settings-better-voice-download'));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0][0]).toBe('Download the better voice?');
    expect(alertSpy.mock.calls[0][1]).toContain(VOICES_MB);
    expect(alertSpy.mock.calls[0][1]).not.toContain(PACKS_MB);
    expect(mockDownload).not.toHaveBeenCalled();
    lastButtons(alertSpy).find(b => b.text === 'Cancel')?.onPress?.();
    expect(mockDownload).not.toHaveBeenCalled();
    lastButtons(alertSpy).find(b => b.text === 'Download')?.onPress?.();
    expect(mockDownload).toHaveBeenCalledTimes(1);
    expect((mockDownload.mock.calls[0][0] as string[]).some(key => key === PACK_KEY || key === SENTENCES_KEY)).toBe(false);
  });

  it('a phone with no packs also has the optional Recordings row; only its own tap fetches them', () => {
    mockState = stateWith({});
    const view = show();
    expect(view.getByText('Recordings: both speakers')).toBeTruthy();
    expect(view.getByText(/Optional: recordings of every word and sentence by both speakers/)).toBeTruthy();
    expect(view.queryByTestId('settings-recordings-newer')).toBeNull();
    fireEvent.press(view.getByTestId('settings-recordings-download'));
    expect(alertSpy.mock.calls[0][1]).toContain(PACKS_MB);
    expect(mockDownload).not.toHaveBeenCalled();
    lastButtons(alertSpy).find(b => b.text === 'Download')?.onPress?.();
    expect(mockDownload).toHaveBeenCalledWith([PACK_KEY, SENTENCES_KEY]);
  });

  it('too little free space: the row says how much is needed', () => {
    mockState = { ...stateWith(allPiper), download: { running: false, percent: 0, phase: 'download', failed: [], lowSpace: 2000 * 1048576 } };
    expect(show().getByTestId('settings-recordings-lowspace').props.children).toContain('2000 MB');
  });

  it('a retry after a failed item asks too, with the size of what is still missing', () => {
    mockState = { ...stateWith({ ...allPiper, [SENTENCES_KEY]: true }), download: { running: false, percent: 80, phase: 'download', failed: [PACK_KEY] } };
    const view = show();
    fireEvent.press(view.getByTestId('settings-recordings-retry'));
    expect(alertSpy.mock.calls[0][1]).toContain(PACK_MB);
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

  it('a phone that already has the voices is offered the recordings in their own row, behind the size question', () => {
    mockState = stateWith({ ...allPiper, [PACK_KEY]: true });
    const view = show();
    expect(view.getByTestId('settings-better-voice')).toBeTruthy(); // the voice keeps working meanwhile
    expect(view.getByText('Recordings: both speakers')).toBeTruthy();
    fireEvent.press(view.getByTestId('settings-recordings-download'));
    expect(alertSpy.mock.calls[0][1]).toContain(SENTENCES_MB);
    expect(mockDownload).not.toHaveBeenCalled();
    lastButtons(alertSpy).find(b => b.text === 'Download')?.onPress?.();
    expect(mockDownload).toHaveBeenCalledTimes(1);
    expect(mockDownload).toHaveBeenCalledWith([PACK_KEY, SENTENCES_KEY]);
  });

  it('with the v1 recordings the row says newer ones exist, nothing downloads by itself, and the voice switch works', () => {
    mockState = stateWith({ ...allPiper, 'legacy-pack': true, 'legacy-sentences': true });
    const view = show();
    expect(view.getByTestId('settings-recordings-newer').props.children).toContain('The app works without them');
    expect(view.getByTestId('settings-better-voice')).toBeTruthy();
    expect(mockDownload).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('Kokoro with only the v1 recordings: the question names the model size alone and no pack is fetched', () => {
    mockState = stateWith({ ...allPiper, 'legacy-pack': true, 'legacy-sentences': true });
    const view = show();
    fireEvent.press(view.getByTestId('settings-better-voice-es-kokoro'));
    expect(alertSpy.mock.calls[0][1]).toContain(formatMegabytes(NEURAL_MODELS.kokoro.bytes));
    expect(alertSpy.mock.calls[0][1]).not.toContain(formatMegabytes(NEURAL_MODELS.kokoro.bytes + PACK_BYTES + SENTENCE_PACK_BYTES));
    lastButtons(alertSpy).find(b => b.text === 'Download')?.onPress?.();
    expect(mockSetEngine).toHaveBeenCalledWith('es', 'kokoro');
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it('a phone with no packs at all keeps the first Download with the full size, started only by the tap', () => {
    mockState = stateWith({});
    show();
    expect(mockDownload).not.toHaveBeenCalled();
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

  it('says in words that the stand-in could not be loaded either', () => {
    mockState = { ...stateWith(allPiper, { es: 'kokoro', en: 'piper', hu: 'piper', de: 'piper' }), issues: { es: { engine: 'piper', kind: 'standin-failed', at: 1 } } };
    expect(show().getByTestId('settings-better-voice-es-issue').props.children).toContain('Piper could not be loaded either');
  });

  it('says nothing when the trouble belongs to an engine that is no longer the chosen one', () => {
    mockState = { ...stateWith(allPiper), issues: { es: { engine: 'kokoro', kind: 'slow', at: 1 } } };
    expect(show().queryByTestId('settings-better-voice-es-issue')).toBeNull();
  });
});
