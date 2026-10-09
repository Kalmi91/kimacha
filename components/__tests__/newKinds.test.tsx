// the three new item kinds played through (error spotting, word order, dictation).
jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
  stop: jest.fn(),
}));
jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'brand-light' }),
}));
jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import GrammarDrill from '../grammar/GrammarDrill';
import { lessonFor } from '@/lib/grammar/syllabus';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';

const speech = require('@/lib/speech') as { speak: jest.Mock };
const serEstar = lessonFor('es', 'ser-estar') as LessonV2;
const negacion = lessonFor('es', 'negacion') as LessonV2;

const only = (lesson: LessonV2, kind: string, count = 1): LessonV2 => ({
  ...lesson,
  items: lesson.items.filter((i) => i.kind === kind).slice(0, count),
});

// GrammarDrill reads the strict-accents setting on mount, one microtask later;
// settle it inside act() so the update is not reported as unwrapped.
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(() => speech.speak.mockClear());

describe('hibakereső (spot)', () => {
  it('a rossz szóra bökve jön a javítás-választó, a jó opció után jó jelzés, javított mondat, elhangzik, a Next pontoz', async () => {
    const onFinish = jest.fn();
    render(<GrammarDrill topic={only(negacion, 'spot')} learnedLang="es" contentLang="en" onFinish={onFinish} kinds={['spot']} />);
    await flush();

    // NEW · TEST badge on the item
    expect(screen.getByTestId('trial-badge')).toBeTruthy();
    expect(screen.getByText('Tap the word that is wrong')).toBeTruthy();

    // "No veo algo." -> the 3rd word (algo, index 2) is the wrong one
    fireEvent.press(screen.getByTestId('spot-word-2'));
    expect(screen.getByText('Pick the right form')).toBeTruthy();
    fireEvent.press(screen.getByText('nada'));

    expect(screen.getByTestId('spot-result')).toBeTruthy();
    expect(screen.getByText('Correct!')).toBeTruthy();
    expect(screen.getByText('No veo nada.')).toBeTruthy();
    expect(speech.speak).toHaveBeenCalledWith('No veo nada.', 'es-MX');

    fireEvent.press(screen.getByTestId('grammar-next'));
    expect(onFinish).toHaveBeenCalledWith(1, 1);
  });

  it('egy jó szóra bökés hiba: nem lesz pont, de a feladat végigvihető', async () => {
    const onFinish = jest.fn();
    render(<GrammarDrill topic={only(negacion, 'spot')} learnedLang="es" contentLang="en" onFinish={onFinish} kinds={['spot']} />);
    await flush();
    fireEvent.press(screen.getByTestId('spot-word-0'));
    expect(screen.getByText('That word is fine. Look again.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('spot-word-2'));
    fireEvent.press(screen.getByText('nada'));
    expect(screen.getByText('Not quite!')).toBeTruthy();
    fireEvent.press(screen.getByTestId('grammar-next'));
    expect(onFinish).toHaveBeenCalledWith(0, 1);
  });

  it('a rossz javítás-opció hibás jelzés', async () => {
    const onFinish = jest.fn();
    render(<GrammarDrill topic={only(negacion, 'spot')} learnedLang="es" contentLang="en" onFinish={onFinish} kinds={['spot']} />);
    await flush();
    fireEvent.press(screen.getByTestId('spot-word-2'));
    fireEvent.press(screen.getByText('nunca'));
    expect(screen.getByText('Not quite!')).toBeTruthy();
    fireEvent.press(screen.getByTestId('grammar-next'));
    expect(onFinish).toHaveBeenCalledWith(0, 1);
  });

  it('a törlős javítás: "Nadie no viene."', async () => {
    const onFinish = jest.fn();
    const topic: LessonV2 = { ...negacion, items: negacion.items.filter((i) => i.id === 'neg-spot-03') };
    render(<GrammarDrill topic={topic} learnedLang="es" contentLang="en" onFinish={onFinish} kinds={['spot']} />);
    await flush();
    fireEvent.press(screen.getByTestId('spot-word-1'));
    fireEvent.press(screen.getByText('(remove it)'));
    expect(screen.getByText('Nadie viene.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('grammar-next'));
    expect(onFinish).toHaveBeenCalledWith(1, 1);
  });
});

describe('szórend (order)', () => {
  it('a mondat a felület nyelvén, a csempék sorba rakva, a helyes mondat elhangzik, a Next pontoz', async () => {
    const onFinish = jest.fn();
    render(<GrammarDrill topic={only(negacion, 'order')} learnedLang="es" contentLang="en" onFinish={onFinish} kinds={['order']} />);
    await flush();

    expect(screen.getByTestId('trial-badge')).toBeTruthy();
    expect(screen.getByText("I don't speak Spanish.")).toBeTruthy();
    for (const w of ['no', 'hablo', 'español']) fireEvent.press(screen.getAllByText(w)[0]);
    fireEvent.press(screen.getByText('Check'));
    expect(screen.getByText(/^Correct/)).toBeTruthy();
    expect(speech.speak).toHaveBeenLastCalledWith('no hablo español', 'es-MX');
    fireEvent.press(screen.getByText(/Next/));
    expect(onFinish).toHaveBeenCalledWith(1, 1);
  });
});

describe('diktálás (dictation)', () => {
  it('a mondat elhangzik, a gépelt válasz elnéző, jó válasz után jó jelzés és a fordítás', async () => {
    const onFinish = jest.fn();
    render(<GrammarDrill topic={only(serEstar, 'dictation')} learnedLang="es" contentLang="en" onFinish={onFinish} kinds={['dictation']} />);
    await flush();

    expect(speech.speak).toHaveBeenCalledWith('Estoy en casa.', 'es-MX');
    expect(screen.getByTestId('trial-badge')).toBeTruthy();
    // slower playback: rate 0.55
    fireEvent.press(screen.getByTestId('dictation-slow'));
    expect(speech.speak).toHaveBeenCalledWith('Estoy en casa.', 'es-MX', { rate: 0.55 });

    // also fine without punctuation, in lowercase
    fireEvent.changeText(screen.getByTestId('dictation-input'), 'estoy en casa');
    fireEvent.press(screen.getByTestId('dictation-check'));
    expect(screen.getByTestId('dictation-result')).toBeTruthy();
    expect(screen.getByText('Correct!')).toBeTruthy();
    expect(screen.getByText('I am at home.')).toBeTruthy();

    fireEvent.press(screen.getByTestId('grammar-next'));
    expect(onFinish).toHaveBeenCalledWith(1, 1);
  });

  it('rossz válasznál a különbség-kiemelés (Your answer / Correct answer) és nincs pont', async () => {
    const onFinish = jest.fn();
    render(<GrammarDrill topic={only(serEstar, 'dictation')} learnedLang="es" contentLang="en" onFinish={onFinish} kinds={['dictation']} />);
    await flush();
    fireEvent.changeText(screen.getByTestId('dictation-input'), 'estoy a casa');
    fireEvent.press(screen.getByTestId('dictation-check'));
    expect(screen.getByText('Not quite!')).toBeTruthy();
    expect(screen.getByText('Your answer')).toBeTruthy();
    expect(screen.getByTestId('answer-compare-correct')).toBeTruthy();
    fireEvent.press(screen.getByTestId('grammar-next'));
    expect(onFinish).toHaveBeenCalledWith(0, 1);
  });
});
