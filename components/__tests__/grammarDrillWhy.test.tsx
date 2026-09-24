// TASK-8 (D4, FB288): "Miért ez a mondat?" feladat-fajta a lecke-drillben. A
// `kinds={['why']}` mintáját a grammarDrillMatchForm.test.tsx match/form
// tesztjei adják (D3, FB290).
import { fireEvent, render, screen } from '@testing-library/react-native';

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

// FB376: without `focus`, no question naming a word (nothing to name); with
// `focus`, the sentence highlights the word and the question names it.
const lessonWithFocus: LessonV2 = {
  ...lesson,
  items: [
    {
      id: 'why-02',
      kind: 'why',
      es: 'El perro corre en el parque.',
      tr: { hu: 'A kutya fut a parkban.', en: 'The dog runs in the park.', es: 'El perro corre en el parque.', de: 'Der Hund läuft im Park.' },
      options: lesson.items[0].kind === 'why' ? lesson.items[0].options : [],
      correctIndex: 0,
      focus: 'perro',
    },
  ],
};

describe('GrammarDrill: why item focus (FB376)', () => {
  it('names the focus word in a question', () => {
    render(<GrammarDrill topic={lessonWithFocus} learnedLang="es" contentLang="hu" onFinish={jest.fn()} kinds={['why']} />);
    expect(screen.queryByText('What is "perro"?')).toBeTruthy();
  });

  it('without focus, asks no such question', () => {
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="hu" onFinish={jest.fn()} kinds={['why']} />);
    expect(screen.queryByText(/What is/)).toBeNull();
  });
});
