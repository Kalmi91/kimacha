// FB760: a match item can be started from the right column too. FB753: example sentences after a form item.
import { fireEvent, render, screen } from '@testing-library/react-native';

import GrammarDrill from '../grammar/GrammarDrill';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';
import { starSegments } from '@/lib/grammar/starSegments';

jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

const matchItem = {
  id: 'match-01',
  kind: 'match' as const,
  pairs: [
    { es: 'soy', en: 'I am' },
    { es: 'somos', en: 'we are' },
  ],
};

const formItem = {
  id: 'form-01',
  kind: 'form' as const,
  verb: 'ser',
  person: 'nosotros',
  answer: 'somos',
  table: 'ser-presente',
};

const lessonWith = (items: LessonV2['items']): LessonV2 => ({
  schema: 2,
  topic: 'test-v2',
  level: 'A1',
  title: { en: 't', es: 't' },
  body: [
    {
      kind: 'table',
      id: 'ser-presente',
      title: { en: 'ser', es: 'ser' },
      header: [
        { en: 'Person', es: 'Persona' },
        { en: 'ser', es: 'ser' },
      ],
      rows: [
        ['yo', 'soy'],
        ['nosotros', 'somos'],
      ],
    },
  ],
  speak: { en: 'e', es: 's' },
  items,
});

const renderMatch = () => {
  const onFinish = jest.fn();
  render(<GrammarDrill topic={lessonWith([matchItem])} learnedLang="es" contentLang="en" onFinish={onFinish} kinds={['match']} />);
  return onFinish;
};

// the right cells are found by their own text, the left ones by testID (left-0 = I am = soy, left-1 = we are = somos)
describe('GrammarDrill: match item from either side', () => {
  it('right first, then the left cell, makes a correct pair', () => {
    const onFinish = renderMatch();
    fireEvent.press(screen.getByText('soy'));
    fireEvent.press(screen.getByTestId('match-left-0'));
    fireEvent.press(screen.getByText('somos'));
    fireEvent.press(screen.getByTestId('match-left-1'));
    expect(screen.queryByText('Correct!')).toBeTruthy();
    fireEvent.press(screen.getByTestId('grammar-next'));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('right first and a wrong left gives the same result as left first and a wrong right', () => {
    const finish = (rightFirst: boolean) => {
      const onFinish = renderMatch();
      if (rightFirst) {
        fireEvent.press(screen.getByText('somos'));
        fireEvent.press(screen.getByTestId('match-left-0')); // wrong
      } else {
        fireEvent.press(screen.getByTestId('match-left-0'));
        fireEvent.press(screen.getByText('somos')); // wrong
      }
      fireEvent.press(screen.getByTestId('match-left-0'));
      fireEvent.press(screen.getByText('soy'));
      fireEvent.press(screen.getByTestId('match-left-1'));
      fireEvent.press(screen.getByText('somos'));
      fireEvent.press(screen.getByTestId('grammar-next'));
      screen.unmount();
      return onFinish.mock.calls;
    };
    const perfect = (() => {
      const onFinish = renderMatch();
      fireEvent.press(screen.getByTestId('match-left-0'));
      fireEvent.press(screen.getByText('soy'));
      fireEvent.press(screen.getByTestId('match-left-1'));
      fireEvent.press(screen.getByText('somos'));
      fireEvent.press(screen.getByTestId('grammar-next'));
      screen.unmount();
      return onFinish.mock.calls;
    })();
    const leftFirst = finish(false);
    const rightFirst = finish(true);
    expect(rightFirst).toEqual(leftFirst);
    expect(rightFirst).not.toEqual(perfect);
  });

  it('right then another right moves the selection (only one is selected)', () => {
    const onFinish = renderMatch();
    fireEvent.press(screen.getByText('soy'));
    fireEvent.press(screen.getByText('somos')); // the selection moves to somos
    fireEvent.press(screen.getByTestId('match-left-1')); // we are + somos = right pair
    fireEvent.press(screen.getByTestId('match-left-0'));
    fireEvent.press(screen.getByText('soy'));
    expect(screen.queryByText('Correct!')).toBeTruthy(); // no wrong attempt happened
    fireEvent.press(screen.getByTestId('grammar-next'));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});

describe('starSegments', () => {
  it('no star: one plain segment', () => {
    expect(starSegments('Camina despacio.')).toEqual([{ text: 'Camina despacio.', bold: false }]);
  });
  it('one star pair', () => {
    expect(starSegments('El tren es *lento*.')).toEqual([
      { text: 'El tren es ', bold: false },
      { text: 'lento', bold: true },
      { text: '.', bold: false },
    ]);
  });
  it('two star pairs', () => {
    expect(starSegments('*lento* y *lenta*')).toEqual([
      { text: 'lento', bold: true },
      { text: ' y ', bold: false },
      { text: 'lenta', bold: true },
    ]);
  });
  it('an unpaired star stays as plain text', () => {
    expect(starSegments('Es *lento.')).toEqual([{ text: 'Es *lento.', bold: false }]);
  });
});

describe('GrammarDrill: form item examples', () => {
  const withExamples = lessonWith([{ ...formItem, examples: ['El tren es *lento*.', 'La tortuga es *lenta*.', 'Camina *lentamente*.'] }]);
  const run = (topic: LessonV2, typed: string) => {
    render(<GrammarDrill topic={topic} learnedLang="es" contentLang="en" onFinish={jest.fn()} kinds={['form']} />);
    expect(screen.queryByTestId('form-examples')).toBeFalsy();
    fireEvent.changeText(screen.getByTestId('formInput'), typed);
    fireEvent.press(screen.getByTestId('formCheck'));
  };

  it.each([
    ['right', 'somos'],
    ['wrong', 'son'],
  ])('shows the examples after a %s answer, without stars', (_label, typed) => {
    run(withExamples, typed);
    expect(screen.getByTestId('form-examples')).toBeTruthy();
    for (const i of [0, 1, 2]) expect(screen.getByTestId(`form-example-${i}`)).toBeTruthy();
    expect(screen.queryByTestId('form-example-3')).toBeFalsy();
    expect(screen.queryByText(/\*/)).toBeFalsy();
  });

  it('an item without examples draws none', () => {
    run(lessonWith([formItem]), 'somos');
    expect(screen.queryByTestId('form-examples')).toBeFalsy();
  });
});
