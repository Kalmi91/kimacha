// Next to the conjugation drill's label ("Sustantivo") the helper table's column header is
// also shown in parentheses ("Noun"), if the header differs in the UI language.
import { render, screen } from '@testing-library/react-native';

import GrammarDrill from '../grammar/GrammarDrill';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';

jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

const lesson: LessonV2 = {
  schema: 2,
  topic: 'label-test',
  level: 'A1',
  title: { en: 't', es: 't' },
  body: [
    {
      kind: 'table',
      id: 'derivacion',
      title: { en: 'd', es: 'd' },
      header: [
        { en: 'Adjective', es: 'Adjetivo' },
        { en: 'Noun', es: 'Sustantivo' },
      ],
      rows: [['difícil', 'dificultad']],
    },
  ],
  speak: { en: 'e', es: 's' },
  items: [{ id: 'f1', kind: 'form', verb: 'Sustantivo', person: 'difícil', answer: 'dificultad', table: 'derivacion' }],
};

describe('GrammarDrill form: the label and the table header', () => {
  it('on the English UI the table "Noun" header is next to the label', () => {
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="en" onFinish={jest.fn()} kinds={['form']} />);
    expect(screen.getByText('Sustantivo (Noun) · difícil')).toBeTruthy();
  });

  it('if the header is the same, no parentheses', () => {
    const same: LessonV2 = {
      ...lesson,
      body: [
        {
          kind: 'table',
          id: 'derivacion',
          title: { en: 'd', es: 'd' },
          header: [
            { en: 'Adjective', es: 'Adjetivo' },
            { en: 'Sustantivo', es: 'Sustantivo' },
          ],
          rows: [['difícil', 'dificultad']],
        },
      ],
    };
    render(<GrammarDrill topic={same} learnedLang="es" contentLang="en" onFinish={jest.fn()} kinds={['form']} />);
    expect(screen.getByText('Sustantivo · difícil')).toBeTruthy();
  });
});
