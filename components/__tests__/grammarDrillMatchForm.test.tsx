// LECKE-SEMA 2.1-2.2: match/form feladatok a lecke-drillben. `includeAllKinds`
// kell, különben a régi (gap/mark-only) kör futna, ahogy a Game fül
// grammar-choice-ánál is marad (LECKE-SEMA 6.3 D pont).
import { fireEvent, render, screen } from '@testing-library/react-native';

import GrammarDrill from '../grammar/GrammarDrill';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';

jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

const lesson: LessonV2 = {
  schema: 2,
  topic: 'test-v2',
  level: 'A1',
  title: { hu: 't', en: 't', es: 't', de: 't' },
  body: [
    {
      kind: 'table',
      id: 'ser-presente',
      title: { hu: 'ser', en: 'ser', es: 'ser', de: 'ser' },
      header: [
        { hu: 'Személy', en: 'Person', es: 'Persona', de: 'Person' },
        { hu: 'ser', en: 'ser', es: 'ser', de: 'ser' },
      ],
      rows: [
        ['yo', 'soy'],
        ['nosotros', 'somos'],
      ],
    },
  ],
  speak: { hu: 'h', en: 'e', es: 's', de: 'd' },
  items: [
    {
      id: 'match-01',
      kind: 'match',
      pairs: [
        { es: 'soy', en: 'I am' },
        { es: 'somos', en: 'we are' },
      ],
    },
    {
      id: 'form-01',
      kind: 'form',
      verb: 'ser',
      person: 'nosotros',
      answer: 'somos',
      table: 'ser-presente',
    },
  ],
};

describe('GrammarDrill: match item', () => {
  it('is completed by tapping the correct pairs and reports correct', () => {
    const onFinish = jest.fn();
    render(
      <GrammarDrill topic={lesson} learnedLang="es" contentLang="hu" onFinish={onFinish} includeAllKinds />
    );

    // The right column is seeded-shuffled; find each right cell by its own
    // Spanish text instead of assuming a fixed position.
    fireEvent.press(screen.getByTestId('match-left-0')); // I am
    fireEvent.press(screen.getByText('soy'));
    fireEvent.press(screen.getByTestId('match-left-1')); // we are
    fireEvent.press(screen.getByText('somos'));

    expect(screen.queryByText('Correct!')).toBeTruthy();
    fireEvent.press(screen.getByTestId('grammar-next'));

    // Then the form item follows (spec order: gap/mark, match, form).
    expect(screen.queryByTestId('formInput')).toBeTruthy();
  });
});

describe('GrammarDrill: form item', () => {
  it('accepts the right conjugation and rejects a wrong one', () => {
    const onFinish = jest.fn();
    const topic: LessonV2 = { ...lesson, items: [lesson.items[1]] }; // form only
    render(
      <GrammarDrill topic={topic} learnedLang="es" contentLang="hu" onFinish={onFinish} includeAllKinds />
    );

    expect(screen.queryByText('ser · nosotros')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('formInput'), 'son');
    fireEvent.press(screen.getByTestId('formCheck'));
    expect(screen.queryByText('somos')).toBeTruthy(); // shows the correct form

    fireEvent.press(screen.getByTestId('grammar-next'));
    expect(onFinish).toHaveBeenCalledWith(0, 1);
  });

  it('accepts "somos" as correct', () => {
    const onFinish = jest.fn();
    const topic: LessonV2 = { ...lesson, items: [lesson.items[1]] };
    render(
      <GrammarDrill topic={topic} learnedLang="es" contentLang="hu" onFinish={onFinish} includeAllKinds />
    );

    fireEvent.changeText(screen.getByTestId('formInput'), 'somos');
    fireEvent.press(screen.getByTestId('formCheck'));
    fireEvent.press(screen.getByTestId('grammar-next'));
    expect(onFinish).toHaveBeenCalledWith(1, 1);
  });
});
