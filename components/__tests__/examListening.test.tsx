// FB191 + FB192: a hallgatás-feladat lejátszó gombja.
// FB191 (09-08 23:43): „itt a play az 2 szer lejátszotta egymás után." A gombnak
// nem volt zárja, tehát egy dupla koppintás egyszerre indított két lejátszást és
// elhasználta a papír mindkét meghallgatását.
// FB192 (09-08 23:45): „nem mondta a szöveg, hogy mikor mondja a másik személyt."

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => [{ language: 'es-MX', identifier: 'es-mx-1', quality: 'Default', name: 'es' }]),
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Speech from 'expo-speech';

import { setLanguage } from '@/lib/i18n';
import { loadVoices, resetVoiceCache } from '@/lib/speech';
import ExamTaskCard from '../exam/ExamTaskCard';
import type { ExamTask } from '@/lib/exam/types';

const AUDIO = ['Hola, soy Nuria.', 'Hola, ¿qué tal?', 'Muy bien, gracias.'];

const dialogue = {
  id: 'd1',
  kind: 'listen_dialogue',
  audio: AUDIO,
  questions: [{ q: '¿Quién llama?', options: ['Nuria.', 'Daniel.'], correct: 0 }],
} as unknown as ExamTask;

const flush = async (times = 3) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('exam listening playback', () => {
  beforeEach(async () => {
    setLanguage('hu');
    resetVoiceCache();
    await loadVoices();
    (Speech.speak as jest.Mock).mockClear();
    (Speech.stop as jest.Mock).mockClear();
  });

  it('ignores a second tap while the recording is still playing (FB191)', async () => {
    render(<ExamTaskCard task={dialogue} answer={{}} onAnswer={jest.fn()} learnedLang="es" canSpeak />);
    await flush();

    fireEvent.press(screen.getByTestId('exam-play'));
    const afterFirst = (Speech.speak as jest.Mock).mock.calls.length;
    expect(afterFirst).toBe(AUDIO.length);

    // A dupla koppintás nem indít újabb kört, és nem éget el egy meghallgatást.
    fireEvent.press(screen.getByTestId('exam-play'));
    expect((Speech.speak as jest.Mock).mock.calls.length).toBe(afterFirst);
    expect(screen.getByText('Még 1-szer hallgathatod meg')).toBeTruthy();
  });

  it('lets the second play through once the first has finished (FB191)', async () => {
    render(<ExamTaskCard task={dialogue} answer={{}} onAnswer={jest.fn()} learnedLang="es" canSpeak />);
    await flush();

    fireEvent.press(screen.getByTestId('exam-play'));
    // Az utolsó sor onDone-ja oldja a zárat, ahogy eszközön is.
    const lastCall = (Speech.speak as jest.Mock).mock.calls.at(-1)!;
    act(() => lastCall[1].onDone());

    fireEvent.press(screen.getByTestId('exam-play'));
    expect((Speech.speak as jest.Mock).mock.calls.length).toBe(AUDIO.length * 2);
    expect(screen.getByText('Kétszer már meghallgattad')).toBeTruthy();
  });

  it('gives the two speakers different voices in a dialogue (FB192)', async () => {
    render(<ExamTaskCard task={dialogue} answer={{}} onAnswer={jest.fn()} learnedLang="es" canSpeak />);
    await flush();

    fireEvent.press(screen.getByTestId('exam-play'));
    const pitches = (Speech.speak as jest.Mock).mock.calls.map((c) => c[1].pitch);
    // Váltakozó sorok: az első és a harmadik az egyik hang, a második a másik.
    expect(pitches[0]).toBeUndefined();
    expect(pitches[1]).toBe(0.8);
    expect(pitches[2]).toBeUndefined();
  });

  it('labels the speakers in the no-voice transcript (FB192)', async () => {
    render(<ExamTaskCard task={dialogue} answer={{}} onAnswer={jest.fn()} learnedLang="es" canSpeak={false} />);
    await flush();

    fireEvent.press(screen.getByText('Szöveg megjelenítése'));
    expect(screen.getByText(/Első hang: Hola, soy Nuria\./)).toBeTruthy();
    expect(screen.getByText(/Második hang: Hola, ¿qué tal\?/)).toBeTruthy();
  });
});
