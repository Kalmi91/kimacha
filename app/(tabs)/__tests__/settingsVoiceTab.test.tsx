// Settings has two tabs at the top: General (everything it had) and Voice (the better voice block and the
// speaker picker below it). General opens first; the feedback button stays on both. Mock pattern:
// settingsFeedbackHeader.test.tsx.

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn() }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: '' } }));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-document-picker', () => ({}));

let mockNeural: any;
const mockSetSpeaker = jest.fn();
jest.mock('@/lib/neuralModels', () => ({
  useNeuralState: () => mockNeural,
  downloadNeural: jest.fn(),
  setNeuralEnabled: jest.fn(),
  setNeuralEngine: jest.fn(),
  setNeuralSpeaker: (lang: string, choice: string) => {
    mockSetSpeaker(lang, choice);
    require('@/lib/voicePreference').setSpeakerChoice(lang, choice);
  },
}));

import { fireEvent, render } from '@testing-library/react-native';

import { setPcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';
import { DEFAULT_SPEAKERS, PIPER_MODEL_KEYS } from '@/lib/neuralVoices';
import { setSpeakerChoices } from '@/lib/voicePreference';
import SettingsScreen from '../settings';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(30000);

const flush = makeFlush(8);

const neuralState = (supported: boolean) => ({
  supported,
  ready: true,
  enabled: true,
  engines: { es: 'piper', en: 'piper', hu: 'piper' },
  installed: Object.fromEntries(PIPER_MODEL_KEYS.map(key => [key, true])),
  download: { running: false, percent: 0, phase: 'download', failed: [] },
});

describe('Settings: the General and Voice tabs', () => {
  beforeEach(async () => {
    setPcicTarget('es');
    await getDb().setOnboarding('en', 'es');
    mockNeural = neuralState(true);
    mockSetSpeaker.mockClear();
    setSpeakerChoices({ ...DEFAULT_SPEAKERS });
  });

  const show = async () => {
    const view = render(
      <ThemeProvider>
        <SettingsScreen />
      </ThemeProvider>,
    );
    await flush();
    return view;
  };

  it('opens on General: the usual rows are there, the voice block is not', async () => {
    const { getByTestId, queryByTestId, getByText } = await show();
    expect(getByText('General')).toBeTruthy();
    expect(getByText('Voice')).toBeTruthy();
    expect(getByTestId('settings-tab-general').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('settings-theme-row')).toBeTruthy();
    expect(getByTestId('settings-beta-title')).toBeTruthy();
    expect(queryByTestId('settings-better-voice')).toBeNull();
    expect(queryByTestId('settings-speaker-es')).toBeNull();
  });

  it('the Voice tab holds the better voice block and the speaker picker, and nothing of General', async () => {
    const { getByTestId, queryByTestId } = await show();
    fireEvent.press(getByTestId('settings-tab-voice'));
    expect(getByTestId('settings-tab-voice').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('settings-better-voice')).toBeTruthy();
    expect(getByTestId('settings-speaker-es-auto')).toBeTruthy();
    expect(getByTestId('settings-speaker-en-m')).toBeTruthy();
    expect(getByTestId('settings-speaker-hu-f')).toBeTruthy();
    expect(queryByTestId('settings-theme-row')).toBeNull();
    expect(queryByTestId('settings-beta-title')).toBeNull();
  });

  it('a person picked on the Voice tab is checked, and General comes back unchanged', async () => {
    const { getByTestId, queryByTestId } = await show();
    fireEvent.press(getByTestId('settings-tab-voice'));
    fireEvent.press(getByTestId('settings-speaker-es-m'));
    expect(mockSetSpeaker).toHaveBeenCalledWith('es', 'm');
    expect(getByTestId('settings-speaker-es-m').props.accessibilityState.checked).toBe(true);
    expect(getByTestId('settings-speaker-es-auto').props.accessibilityState.checked).toBe(false);
    fireEvent.press(getByTestId('settings-tab-general'));
    expect(getByTestId('settings-theme-row')).toBeTruthy();
    expect(queryByTestId('settings-speaker-es-m')).toBeNull();
    fireEvent.press(getByTestId('settings-tab-voice'));
    expect(getByTestId('settings-speaker-es-m').props.accessibilityState.checked).toBe(true); // the choice is kept
  });

  it('the feedback button is reachable on both tabs', async () => {
    const { getByTestId, getByLabelText } = await show();
    expect(getByLabelText('Feedback')).toBeTruthy();
    fireEvent.press(getByTestId('settings-tab-voice'));
    expect(getByLabelText('Feedback')).toBeTruthy();
    fireEvent.press(getByTestId('settings-tab-general'));
    expect(getByLabelText('Feedback')).toBeTruthy();
  });

  it('where the better voice does not exist (web) the Voice tab has no voice block and no picker', async () => {
    mockNeural = neuralState(false);
    const { getByTestId, queryByTestId } = await show();
    fireEvent.press(getByTestId('settings-tab-voice'));
    expect(queryByTestId('settings-better-voice')).toBeNull();
    expect(queryByTestId('settings-speaker-es')).toBeNull();
  });
});
