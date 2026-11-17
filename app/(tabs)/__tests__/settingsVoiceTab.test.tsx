// Settings folders keep the controls on their own routes and show only the active voice pair.
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: mockBack, replace: mockReplace }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: '' } }));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-document-picker', () => ({}));

let mockNeural: any;
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
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

import { fireEvent, render, within } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { setPcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { setLanguage, t } from '@/lib/i18n';
import { pairLabel } from '@/lib/languages';
import { ThemeProvider } from '@/lib/ThemeContext';
import { touchCountsAsLearning } from '@/lib/usageRoutes';
import { DEFAULT_SPEAKERS, PIPER_MODEL_KEYS } from '@/lib/neuralVoices';
import { setSpeakerChoices } from '@/lib/voicePreference';
import SettingsScreen from '../settings';
import LearningSettingsScreen from '../../settings-learning';
import VoiceSettingsScreen from '../../settings-voice';
import DataSettingsScreen from '../../settings-data';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(30000);
const flush = makeFlush(8);
const show = async (Screen = SettingsScreen) => {
  const view = render(<ThemeProvider><Screen /></ThemeProvider>);
  await flush();
  return view;
};

beforeEach(async () => {
  jest.clearAllMocks();
  setLanguage('en');
  setPcicTarget('es');
  await getDb().setOnboarding('en', 'es');
  await getDb().setDailyNewLimit(10);
  mockNeural = {
    supported: true, ready: true, enabled: true,
    engines: { es: 'piper', en: 'piper', hu: 'piper', de: 'piper' },
    installed: Object.fromEntries(PIPER_MODEL_KEYS.map(key => [key, true])),
    download: { running: false, percent: 0, phase: 'download', failed: [] },
    issues: {},
  };
  setSpeakerChoices({ ...DEFAULT_SPEAKERS });
});
afterEach(() => {
  setLanguage('en');
  delete (globalThis as any).location;
  jest.restoreAllMocks();
});

describe.each(['brand', 'classic'] as const)('Settings folders on %s', palette => {
  beforeEach(async () => { await getDb().setGrammarPalette(palette); });

  it('has five ordered entries with the direction/daily subtitle and no duplicate title, tabs or importer', async () => {
    const view = await show();
    for (const [label, path] of [
      ['Learning', '/settings-learning'], ['Voice', '/settings-voice'], ['Themes', '/themes'],
      ['My data', '/settings-data'], ['Sources and licenses', '/credits'],
    ]) {
      fireEvent.press(view.getByText(label));
      expect(mockPush).toHaveBeenLastCalledWith(path);
    }
    expect(mockPush.mock.calls.map(([path]) => path)).toEqual([
      '/settings-learning', '/settings-voice', '/themes', '/settings-data', '/credits',
    ]);
    expect(view.getByText(pairLabel('en', 'es') + ', 10 words / day')).toBeTruthy();
    expect(view.queryByText('Settings')).toBeNull();
    expect(view.queryByText('General')).toBeNull();
    expect(view.queryByText(/Load my mistakes/)).toBeNull();
    expect(view.queryByText('Beta')).toBeNull();
    expect(view.queryByTestId('settings-better-voice')).toBeNull();
    expect(view.queryByText('Learning direction')).toBeNull();
  });

  it.each([LearningSettingsScreen, VoiceSettingsScreen, DataSettingsScreen])('has one feedback button and a working back button on %p', async Screen => {
    const view = await show(Screen);
    expect(view.getAllByLabelText('Feedback')).toHaveLength(1);
    fireEvent.press(view.getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('groups only target/source voices, one radio list of voices per card', async () => {
    const view = await show(VoiceSettingsScreen);
    expect(view.getAllByTestId(/^settings-speaker-(es|en)$/).map(node => node.props.testID)).toEqual(['settings-speaker-es', 'settings-speaker-en']);
    expect(view.queryByTestId('settings-speaker-hu')).toBeNull();
    expect(view.queryByTestId('settings-speaker-de')).toBeNull();
    expect(view.getByText('Better voice (beta)')).toBeTruthy();
    expect(view.queryByText('Fast fallback')).toBeNull();
    const card = view.getByTestId('settings-speaker-es');
    expect(within(card).getAllByRole('radio')).toHaveLength(4);
    expect(within(card).getByTestId('settings-speaker-es-kokoro-m')).toBeTruthy();
    expect(view.queryByTestId('settings-theme-row')).toBeNull();
    expect(view.queryByText(/Load my mistakes/)).toBeNull();
    expect(view.queryByText('Beta')).toBeNull();
  });

  it('keeps a picked speaker when leaving and reopening Voice', async () => {
    const first = await show(VoiceSettingsScreen);
    fireEvent.press(first.getByTestId('settings-speaker-es-piper-m'));
    expect(mockSetSpeaker).toHaveBeenCalledWith('es', 'm');
    first.unmount();
    const next = await show(VoiceSettingsScreen);
    expect(next.getByTestId('settings-speaker-es-piper-m').props.accessibilityState.checked).toBe(true);
    expect(next.getByTestId('settings-speaker-es-piper-f').props.accessibilityState.checked).toBe(false);
  });

  it('persists a daily limit after reopening Learning and refreshes the home subtitle', async () => {
    const first = await show(LearningSettingsScreen);
    fireEvent.press(first.getByLabelText('Increase new words a day'));
    await flush();
    expect(await getDb().getDailyNewLimit()).toBe(15);
    first.unmount();
    const next = await show(LearningSettingsScreen);
    expect(next.getByText('15 words / day')).toBeTruthy();
    next.unmount();
    const home = await show();
    expect(home.getByText(pairLabel('en', 'es') + ', 15 words / day')).toBeTruthy();
  });
});

it('shows the new two languages, target first, after changing direction in Learning', async () => {
  const learning = await show(LearningSettingsScreen);
  fireEvent.press(learning.getByText('Learning direction'));
  fireEvent.press(learning.getByText(pairLabel('hu', 'de')));
  await flush();
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  learning.unmount();
  const voice = await show(VoiceSettingsScreen);
  expect(voice.getAllByTestId(/^settings-speaker-(de|hu)$/).map(node => node.props.testID)).toEqual(['settings-speaker-de', 'settings-speaker-hu']);
  expect(voice.queryByTestId('settings-speaker-en')).toBeNull();
  expect(voice.queryByTestId('settings-speaker-es')).toBeNull();
  expect(voice.queryByTestId('settings-speaker-hu-kokoro-f')).toBeNull();
  expect(voice.queryByTestId('settings-speaker-de-kokoro-f')).toBeNull();
});

it('has no Voice entry on web', async () => {
  Object.defineProperty(globalThis, 'location', { value: { search: '' }, configurable: true });
  jest.replaceProperty(Platform, 'OS', 'web');
  const view = await show();
  expect(view.queryByText('Voice')).toBeNull();
  expect(view.getByText('Learning')).toBeTruthy();
});

it.each(['en', 'es', 'hu', 'de'])('translates the folder labels and has no Beta section in %s', locale => {
  setLanguage(locale);
  const s = t().settings;
  expect(Object.values(s.folders).every(label => label.length > 0)).toBe(true);
  expect((s as Record<string, unknown>).beta).toBeUndefined();
  expect(s.speaker.title).toBeTruthy();
});

it.each(['settings-learning', 'settings-voice', 'settings-data'])('does not count time browsing %s as learning', route => {
  expect(touchCountsAsLearning([route])).toBe(false);
});
