jest.mock('expo-speech', () => ({
  speak: jest.fn(), stop: jest.fn(), getAvailableVoicesAsync: jest.fn(),
}));
jest.mock('@/lib/neuralModels', () => ({
  neuralPackFile: jest.fn(() => null), neuralSentenceFile: jest.fn(() => null), neuralEngineFor: jest.fn(() => null),
}));

import { act, fireEvent, render } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import * as Speech from 'expo-speech';

import SpeakButton from '@/components/SpeakButton';
import SpeechFeedback from '@/components/SpeechFeedback';
import TypedSentenceCard from '@/components/TypedSentenceCard';
import MockPlayer from '@/components/exam/mock/MockPlayer';
import { useMockAudio } from '@/components/exam/mock/useMockAudio';
import { hasVoiceFor, loadVoices, missingVoiceLanguages, noteSpeechTouch, resetVoiceCache, speak, speakAuto, speakSequence, stop } from '@/lib/speech';
import { setLanguage, t } from '@/lib/i18n';

const speech = Speech as jest.Mocked<typeof Speech>;
const originalOS = Platform.OS;
const synthDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'speechSynthesis');

function ListeningScreen() {
  return <><SpeakButton testID="listen" onPress={() => speak('hola', 'es-MX')} /><SpeechFeedback /></>;
}

function ExamScreen() {
  const audio = useMockAudio('es', 2);
  return <><MockPlayer audio={audio} id="clip" lines={[{ text: 'hola' }]} canSpeak /><SpeechFeedback /></>;
}

function SentenceScreen() {
  return <><TypedSentenceCard sourceSentence="hello" targetSentence="hola" speechLocale="es-MX" listening onResult={jest.fn()} /><SpeechFeedback /></>;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  resetVoiceCache();
  setLanguage('en');
  speech.getAvailableVoicesAsync.mockResolvedValue([{ language: 'es-MX' }] as Speech.Voice[]);
});

afterEach(() => {
  act(() => stop());
  jest.useRealTimers();
  (Platform as { OS: string }).OS = originalOS;
  if (synthDescriptor) Object.defineProperty(globalThis, 'speechSynthesis', synthDescriptor);
  else Reflect.deleteProperty(globalThis, 'speechSynthesis');
});

it.each(['empty', 'rejected'])('attempts speech with a %s voice query and reports no engine only if it never starts', async (kind) => {
  if (kind === 'empty') speech.getAvailableVoicesAsync.mockResolvedValue([]);
  else speech.getAvailableVoicesAsync.mockRejectedValue(new Error('no engine'));
  const view = render(<ListeningScreen />);
  await act(async () => fireEvent.press(view.getByTestId('listen')));
  expect(speech.speak).toHaveBeenCalledTimes(1);
  expect(speech.speak.mock.calls[0][1]!.voice).toBeUndefined();
  expect(view.queryByTestId('speech-feedback')).toBeNull();
  act(() => jest.advanceTimersByTime(10000));
  expect(view.getByText(t().audio.noEngine)).toBeTruthy();
});

it('retries voice discovery on a new press after voices were unavailable', async () => {
  speech.getAvailableVoicesAsync.mockResolvedValueOnce([]);
  const view = render(<ListeningScreen />);
  await act(async () => fireEvent.press(view.getByTestId('listen')));
  act(() => jest.advanceTimersByTime(10000));
  expect(view.getByText(t().audio.noEngine)).toBeTruthy();
  await act(async () => fireEvent.press(view.getByTestId('listen')));
  expect(speech.getAvailableVoicesAsync).toHaveBeenCalledTimes(2);
  expect(speech.speak).toHaveBeenCalledTimes(2);
  expect(view.queryByText(t().audio.noEngine)).toBeNull();
});

it.each(['en', 'es', 'hu', 'de'])('shows a missing-language message instead of silently completing (%s UI)', async (language) => {
  setLanguage(language);
  speech.getAvailableVoicesAsync.mockResolvedValue([{ language: 'en-US' }] as Speech.Voice[]);
  await loadVoices();
  const view = render(<SentenceScreen />);
  await act(async () => fireEvent.press(view.getByTestId('sentence-listen-play')));
  expect(view.getByText(t().audio.noVoice)).toBeTruthy();
  expect(speech.speak).not.toHaveBeenCalled();
});

it('shows the sentence listening button state throughout playback', async () => {
  await loadVoices();
  const view = render(<SentenceScreen />);
  fireEvent.press(view.getByTestId('sentence-listen-play'));
  expect(view.getByText('⏳')).toBeTruthy();
  act(() => speech.speak.mock.calls[0][1]!.onStart!());
  expect(view.getByText('🔉')).toBeTruthy();
  act(() => speech.speak.mock.calls[0][1]!.onDone!());
  expect(view.getByText('🔊')).toBeTruthy();
});

it('changes the pressed button immediately, stays active during speech and resets on completion', async () => {
  let resolveVoices!: (voices: Speech.Voice[]) => void;
  speech.getAvailableVoicesAsync.mockReturnValue(new Promise((resolve) => { resolveVoices = resolve; }));
  const view = render(<ListeningScreen />);
  fireEvent.press(view.getByTestId('listen'));
  expect(view.getByText('⏳')).toBeTruthy();
  expect(view.queryByTestId('speech-feedback')).toBeNull();
  await act(async () => resolveVoices([{ language: 'es-MX' }] as Speech.Voice[]));
  act(() => speech.speak.mock.calls[0][1]!.onStart!());
  expect(view.getByText('🔉')).toBeTruthy();
  expect(view.queryByTestId('speech-feedback')).toBeNull();
  act(() => speech.speak.mock.calls[0][1]!.onDone!());
  expect(view.queryByTestId('speech-feedback')).toBeNull();
  expect(view.getByText('🔊')).toBeTruthy();
});

it('shows runtime speech failures and refunds the exam listen, with a transcript available', async () => {
  await loadVoices();
  const view = render(<ExamScreen />);
  fireEvent.press(view.getByTestId('mock-play'));
  expect(view.getByText(`🔉 ${t().audio.playing}`)).toBeTruthy();
  act(() => speech.speak.mock.calls[0][1]!.onError!(new Error('failed')));
  expect(view.getByText(t().audio.failed)).toBeTruthy();
  expect(view.getByTestId('mock-plays-left').props.children).toBe(t().mockExam.playsLeft(2));
  fireEvent.press(view.getByTestId('mock-transcript-toggle'));
  expect(view.getByTestId('mock-transcript')).toBeTruthy();
  fireEvent.press(view.getByTestId('mock-play'));
  expect(speech.speak).toHaveBeenCalledTimes(2);
});

it('times out a phone speech that never starts and keeps the failure visible after late callbacks', async () => {
  await loadVoices();
  const view = render(<ListeningScreen />);
  fireEvent.press(view.getByTestId('listen'));
  act(() => jest.advanceTimersByTime(10000));
  expect(view.getByText(t().audio.failed)).toBeTruthy();
  act(() => speech.speak.mock.calls[0][1]!.onDone!());
  expect(view.getByText(t().audio.failed)).toBeTruthy();
});

it('does not restart speech when delayed voice discovery finishes after leaving the screen', async () => {
  let resolveVoices!: (voices: Speech.Voice[]) => void;
  speech.getAvailableVoicesAsync.mockReturnValue(new Promise((resolve) => { resolveVoices = resolve; }));
  speak('hola', 'es-MX');
  stop();
  await act(async () => resolveVoices([{ language: 'es-MX' }] as Speech.Voice[]));
  expect(speech.speak).toHaveBeenCalledTimes(1);
});

it('releases the exam player immediately when speech is interrupted, even without an engine stop event', async () => {
  await loadVoices();
  const view = render(<ExamScreen />);
  fireEvent.press(view.getByTestId('mock-play'));
  act(() => stop());
  expect(view.getByTestId('mock-play').props.accessibilityState.busy).toBe(false);
  fireEvent.press(view.getByTestId('mock-play'));
  expect(speech.speak).toHaveBeenCalledTimes(2);
});

it('does not skip an unavailable sequence segment as if it had played successfully', async () => {
  speech.getAvailableVoicesAsync.mockResolvedValue([{ language: 'en-US' }] as Speech.Voice[]);
  await loadVoices();
  const done = jest.fn();
  const failed = jest.fn();
  const view = render(<SpeechFeedback />);
  act(() => speakSequence([{ text: 'hola', locale: 'es-MX' }], done, undefined, failed));
  expect(failed).toHaveBeenCalledTimes(1);
  expect(done).not.toHaveBeenCalled();
  expect(view.getByText(t().audio.noVoice)).toBeTruthy();
});

it('skips a missing Hungarian voice without an error callback, speaks Spanish and preserves the failure after completion', async () => {
  await loadVoices();
  const done = jest.fn();
  const view = render(<SpeechFeedback />);
  act(() => speakSequence([{ text: 'szia', locale: 'hu-HU' }, { text: 'hola', locale: 'es-MX' }], done));
  expect(speech.speak).toHaveBeenCalledTimes(1);
  expect(speech.speak).toHaveBeenCalledWith('hola', expect.objectContaining({ language: 'es-MX' }));
  act(() => speech.speak.mock.calls[0][1]!.onStart!());
  expect(view.getByText(t().audio.noVoice)).toBeTruthy();
  act(() => speech.speak.mock.calls[0][1]!.onDone!());
  expect(done).toHaveBeenCalledTimes(1);
  expect(view.getByText(t().audio.noVoice)).toBeTruthy();
  act(() => speech.speak.mock.calls[0][1]!.onDone!());
  expect(done).toHaveBeenCalledTimes(1);
});

it('continues after a runtime segment failure when no error callback was passed', async () => {
  await loadVoices();
  const done = jest.fn();
  const view = render(<SpeechFeedback />);
  act(() => speakSequence([{ text: 'hola', locale: 'es-MX' }, { text: 'adiós', locale: 'es-MX' }], done));
  act(() => speech.speak.mock.calls[0][1]!.onError!(new Error('failed')));
  expect(speech.speak).toHaveBeenCalledTimes(2);
  act(() => speech.speak.mock.calls[1][1]!.onDone!());
  expect(done).toHaveBeenCalledTimes(1);
  expect(view.getByText(t().audio.failed)).toBeTruthy();
});

it('reports an absent browser speech API visibly', async () => {
  (Platform as { OS: string }).OS = 'web';
  Object.defineProperty(globalThis, 'speechSynthesis', { configurable: true, value: undefined });
  const view = render(<ListeningScreen />);
  await act(async () => fireEvent.press(view.getByTestId('listen')));
  expect(view.getByText(t().audio.noEngine)).toBeTruthy();
  expect(speech.speak).not.toHaveBeenCalled();
});

it.each(['ios', 'web'])('bounds an unresolved Expo voice query on %s without blocking speech', async (os) => {
  (Platform as { OS: string }).OS = os;
  Object.defineProperty(globalThis, 'speechSynthesis', { configurable: true, value: {} });
  speech.getAvailableVoicesAsync.mockReturnValue(new Promise(() => {}));
  const view = render(<ListeningScreen />);
  fireEvent.press(view.getByTestId('listen'));
  await act(async () => jest.advanceTimersByTime(2001));
  expect(hasVoiceFor('es-MX')).toBe(true);
  expect(speech.speak).toHaveBeenCalledTimes(1);
  expect(speech.speak.mock.calls[0][1]!.voice).toBeUndefined();
  expect(view.queryByTestId('speech-feedback')).toBeNull();
  act(() => speech.speak.mock.calls[0][1]!.onStart!());
  act(() => speech.speak.mock.calls[0][1]!.onDone!());
  expect(view.queryByTestId('speech-feedback')).toBeNull();
});

it('places failures outside layout without capturing touches and hides them after six seconds', async () => {
  speech.getAvailableVoicesAsync.mockResolvedValue([{ language: 'en-US' }] as Speech.Voice[]);
  await loadVoices();
  const view = render(<ListeningScreen />);
  fireEvent.press(view.getByTestId('listen'));
  const overlay = view.getByTestId('speech-feedback-overlay');
  expect(overlay.props.pointerEvents).toBe('none');
  expect(StyleSheet.flatten(overlay.props.style).position).toBe('absolute');
  act(() => jest.advanceTimersByTime(5999));
  expect(view.getByText(t().audio.noVoice)).toBeTruthy();
  act(() => jest.advanceTimersByTime(1));
  expect(view.queryByTestId('speech-feedback')).toBeNull();
});

it.each(['speech', 'stop'])('clears a failure immediately on a new %s', async (action) => {
  speech.getAvailableVoicesAsync.mockResolvedValue([{ language: 'en-US' }] as Speech.Voice[]);
  await loadVoices();
  const view = render(<ListeningScreen />);
  fireEvent.press(view.getByTestId('listen'));
  expect(view.getByText(t().audio.noVoice)).toBeTruthy();
  act(() => { if (action === 'speech') speak('hello', 'en-US'); else stop(); });
  expect(view.queryByTestId('speech-feedback')).toBeNull();
});

it('clears the failure timer when the feedback unmounts', async () => {
  speech.getAvailableVoicesAsync.mockResolvedValue([{ language: 'en-US' }] as Speech.Voice[]);
  await loadVoices();
  const view = render(<ListeningScreen />);
  fireEvent.press(view.getByTestId('listen'));
  expect(jest.getTimerCount()).toBe(1);
  view.unmount();
  expect(jest.getTimerCount()).toBe(0);
});

it.each(['noVoice', 'noStart', 'runtime'])('suppresses automatic %s failures but reports them on manual speech', async (kind) => {
  speech.getAvailableVoicesAsync.mockResolvedValue(kind === 'noStart' ? [] : [{ language: kind === 'noVoice' ? 'en-US' : 'es-MX' }] as Speech.Voice[]);
  await loadVoices();
  noteSpeechTouch();
  const done = jest.fn();
  const view = render(<SpeechFeedback />);
  act(() => speakAuto('hola', 'es-MX', { onDone: done }));
  await act(async () => {
    if (kind === 'noStart') jest.advanceTimersByTime(10000);
    if (kind === 'runtime') speech.speak.mock.calls[0][1]!.onError!(new Error('failed'));
  });
  expect(done).toHaveBeenCalledTimes(1);
  expect(missingVoiceLanguages()).toContain('es');
  expect(view.queryByTestId('speech-feedback')).toBeNull();
  act(() => speak('hola', 'es-MX'));
  await act(async () => {
    if (kind === 'noStart') jest.advanceTimersByTime(10000);
    if (kind === 'runtime') speech.speak.mock.calls[1][1]!.onError!(new Error('failed'));
  });
  expect(view.getByText(t().audio[kind === 'noVoice' ? 'noVoice' : kind === 'noStart' ? 'noEngine' : 'failed'])).toBeTruthy();
});
