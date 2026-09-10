// FB199, Kálmán 2026-09-09: „az utolsó rész a 4-ből, azt kellene úgy megcsinálni,
// hogy rá tudjak beszélni és akkor felismeri hogy mit mondok, leírja, és az
// alapján osztályozza le." The oral paper listens, writes down what it heard, and
// is marked on that; the old 0/1/2 self-rating stays for devices that cannot
// recognize speech.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => [{ language: 'es-MX', identifier: 'es-mx-1', quality: 'Default', name: 'es' }]),
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { setLanguage } from '@/lib/i18n';
import { __setRecognitionModule, mergeTranscript } from '@/lib/speechRecognition';
import { scoreTask } from '@/lib/exam/score';
import ExamTaskCard from '../exam/ExamTaskCard';
import type { ExamTask } from '@/lib/exam/types';

const task = {
  id: 's1',
  kind: 'speaking_prompt',
  instruction: 'TAREA 1.',
  prompt: 'Preséntese.',
  model: 'Me llamo Ana.',
  minWords: 8,
  points: [
    { id: 'nombre', label: 'Dice cómo se llama', keywords: ['me llamo'] },
    { id: 'edad', label: 'Dice su edad', keywords: ['años'] },
  ],
} as unknown as ExamTask;

/** A stand-in for the native recognizer, driven by the test. */
function fakeRecognizer(options: { granted?: boolean } = {}) {
  const listeners: Record<string, ((payload: unknown) => void)[]> = {};
  const module = {
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
    requestPermissionsAsync: jest.fn(async () => ({ granted: options.granted ?? true })),
    addListener: jest.fn((event: string, listener: (payload: never) => void) => {
      (listeners[event] ??= []).push(listener as (payload: unknown) => void);
      return { remove: jest.fn() };
    }),
  };
  const emit = (event: string, payload: unknown) => {
    act(() => {
      for (const listener of listeners[event] ?? []) listener(payload);
    });
  };
  return { module, emit };
}

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe('exam speaking, spoken and recognized (FB199)', () => {
  beforeEach(() => setLanguage('hu'));
  afterEach(() => __setRecognitionModule(undefined));

  it('writes down what was said and hands it to the marking', async () => {
    const { module, emit } = fakeRecognizer();
    __setRecognitionModule(module as never);
    const onAnswer = jest.fn();

    render(<ExamTaskCard task={task} answer={{}} onAnswer={onAnswer} learnedLang="es" canSpeak />);

    fireEvent.press(screen.getByTestId('exam-speak-toggle'));
    await flush();
    expect(module.start).toHaveBeenCalledWith(expect.objectContaining({ lang: 'es-MX', continuous: true }));

    // Interim first, then the final utterance, then a second utterance: in
    // continuous mode each final covers only what is new.
    emit('result', { isFinal: false, results: [{ transcript: 'me llamo', confidence: 0.5 }] });
    emit('result', { isFinal: true, results: [{ transcript: 'Me llamo Daniel', confidence: 0.9 }] });
    emit('result', { isFinal: true, results: [{ transcript: 'y tengo treinta y cuatro años', confidence: 0.9 }] });

    expect(screen.getByTestId('exam-speak-heard').props.children).toBe(
      'Me llamo Daniel y tengo treinta y cuatro años',
    );
    expect(onAnswer).toHaveBeenLastCalledWith('transcript', 'Me llamo Daniel y tengo treinta y cuatro años');

    // What the card handed up is what earns the marks.
    const transcript = onAnswer.mock.calls.at(-1)![1] as string;
    const result = scoreTask(task, { transcript });
    expect(result.correct).toBe(result.total);
  });

  it('keeps the self-rating when the device cannot recognize speech', async () => {
    __setRecognitionModule(null);
    render(<ExamTaskCard task={task} answer={{}} onAnswer={jest.fn()} learnedLang="es" canSpeak />);
    await flush();

    expect(screen.queryByTestId('exam-speak-toggle')).toBeNull();
    expect(screen.getByTestId('exam-self-2')).toBeTruthy();
  });

  it('says so and leaves the self-rating when the microphone is refused', async () => {
    const { module } = fakeRecognizer({ granted: false });
    __setRecognitionModule(module as never);
    render(<ExamTaskCard task={task} answer={{}} onAnswer={jest.fn()} learnedLang="es" canSpeak />);

    fireEvent.press(screen.getByTestId('exam-speak-toggle'));
    await flush();

    expect(module.start).not.toHaveBeenCalled();
    expect(screen.getByText('Mikrofon-engedély nélkül nincs mit felismerni, értékeld magad.')).toBeTruthy();
    expect(screen.getByTestId('exam-self-2')).toBeTruthy();
  });

  it('joins finals and shows the live interim on the end', () => {
    expect(mergeTranscript(['Me llamo Daniel'], 'y tengo')).toBe('Me llamo Daniel y tengo');
    expect(mergeTranscript([], '')).toBe('');
  });
});
