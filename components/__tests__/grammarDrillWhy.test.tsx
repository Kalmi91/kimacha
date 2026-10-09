// the "Why this sentence?" item kind in the lesson drill. The pattern for `kinds={['why']}`
// comes from the match/form tests in grammarDrillMatchForm.test.tsx.
import { fireEvent, render, screen, within } from '@testing-library/react-native';

import GrammarDrill from '../grammar/GrammarDrill';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';

jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

const lesson: LessonV2 = {
  schema: 2,
  topic: 'test-why',
  level: 'A1',
  title: { hu: 't', en: 't', es: 't', de: 't' },
  body: [],
  speak: { hu: 'h', en: 'e', es: 's', de: 'd' },
  items: [
    {
      id: 'why-01',
      kind: 'why',
      es: 'Soy profesor.',
      tr: { hu: 'Tanár vagyok.', en: 'I am a teacher.', es: 'Soy profesor.', de: 'Ich bin Lehrer.' },
      options: [
        { text: { hu: 'foglalkozás', en: 'profession', es: 'profesión', de: 'Beruf' } },
        {
          text: { hu: 'hely', en: 'location', es: 'ubicación', de: 'Ort' },
          wrong: { hu: 'x hely x', en: 'x location x', es: 'x ubicación x', de: 'x Ort x' },
        },
        {
          text: { hu: 'állapot', en: 'state', es: 'estado', de: 'Zustand' },
          wrong: { hu: 'x állapot x', en: 'x state x', es: 'x estado x', de: 'x Zustand x' },
        },
      ],
      correctIndex: 0,
    },
  ],
};

describe('GrammarDrill: why item', () => {
  it('kinds={["why"]} only puts why items in the round', () => {
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="hu" onFinish={jest.fn()} kinds={['why']} />);
    expect(screen.queryByText('Soy profesor.')).toBeTruthy();
    expect(screen.queryAllByTestId('grammar-option')).toHaveLength(3);
  });

  it('correct pick shows green feedback and "next" advances', () => {
    const onFinish = jest.fn();
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="hu" onFinish={onFinish} kinds={['why']} />);

    fireEvent.press(screen.getByText('foglalkozás'));
    expect(screen.queryByText('Correct!')).toBeTruthy();

    fireEvent.press(screen.getByTestId('grammar-next'));
    expect(onFinish).toHaveBeenCalledWith(1, 1);
  });

  it('wrong pick shows the wrong explanation for the picked option', () => {
    const onFinish = jest.fn();
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="hu" onFinish={onFinish} kinds={['why']} />);

    fireEvent.press(screen.getByText('hely'));
    expect(screen.queryByText('x hely x')).toBeTruthy();

    fireEvent.press(screen.getByTestId('grammar-next'));
    expect(onFinish).toHaveBeenCalledWith(0, 1);
  });
});

// the translation gives away the answer, so it starts hidden, a
// button reveals it, and it shows on its own once the item is answered.
describe('GrammarDrill: why item translation', () => {
  it('starts hidden behind a button', () => {
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="hu" onFinish={jest.fn()} kinds={['why']} />);
    expect(screen.queryByText('Tanár vagyok.')).toBeNull();
    expect(screen.getByTestId('why-show-translation')).toBeTruthy();
  });

  it('shows after tapping the button', () => {
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="hu" onFinish={jest.fn()} kinds={['why']} />);
    fireEvent.press(screen.getByTestId('why-show-translation'));
    expect(screen.queryByText('Tanár vagyok.')).toBeTruthy();
  });

  it('shows automatically once answered, even without tapping the button', () => {
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="hu" onFinish={jest.fn()} kinds={['why']} />);
    fireEvent.press(screen.getByText('foglalkozás'));
    expect(screen.queryByText('Tanár vagyok.')).toBeTruthy();
  });
});

// if the correct option is always first in the authored order, it still lands in different places
// in the drill (seeded shuffle from the item id), and the right answer is still right.
describe('GrammarDrill: why option order (R21)', () => {
  const withId = (id: string): LessonV2 => ({ ...lesson, items: [{ ...(lesson.items[0] as object), id } as LessonV2['items'][number]] });

  it('the correct option is not always the first one on screen', () => {
    const positions = new Set<number>();
    for (let k = 0; k < 12; k++) {
      const view = render(<GrammarDrill topic={withId(`why-r21-${k}`)} learnedLang="es" contentLang="hu" onFinish={jest.fn()} kinds={['why']} />);
      const opts = screen.getAllByTestId('grammar-option');
      positions.add(opts.findIndex((o) => within(o).queryByText('foglalkozás') !== null));
      view.unmount();
    }
    expect(positions.size).toBeGreaterThan(1);
  });

  it('the same item keeps its order, and the correct pick is still correct', () => {
    const onFinish = jest.fn();
    const topic = withId('why-r21-3');
    const a = render(<GrammarDrill topic={topic} learnedLang="es" contentLang="hu" onFinish={onFinish} kinds={['why']} />);
    const first = screen.getAllByTestId('grammar-option').findIndex((o) => within(o).queryByText('foglalkozás') !== null);
    a.unmount();
    render(<GrammarDrill topic={topic} learnedLang="es" contentLang="hu" onFinish={onFinish} kinds={['why']} />);
    expect(screen.getAllByTestId('grammar-option').findIndex((o) => within(o).queryByText('foglalkozás') !== null)).toBe(first);
    fireEvent.press(screen.getByText('foglalkozás'));
    expect(screen.queryByText('Correct!')).toBeTruthy();
  });
});
