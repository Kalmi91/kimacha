// On a wrong answer the learner's own answer and the correct answer appear
// one under the other, with the difference highlighted.
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';

import AnswerCompare from '../grammar/AnswerCompare';
import GrammarDrill from '../grammar/GrammarDrill';
import { grammarColorsFor } from '@/lib/grammarColors';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';

jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

const g = grammarColorsFor('light');

// The single-letter, highlighted (background-coloured) children in the row.
function highlighted(line: ReactTestInstance): string {
  return line
    .findAll((n) => typeof n.type === 'string' && n.props.style && flat(n.props.style).backgroundColor !== undefined)
    .map((n) => n.props.children)
    .join('');
}
function flat(style: unknown): Record<string, unknown> {
  return Array.isArray(style) ? Object.assign({}, ...style.map(flat)) : ((style as Record<string, unknown>) ?? {});
}

describe('AnswerCompare', () => {
  it('the two rows one under the other: your own and the correct answer', () => {
    render(<AnswerCompare typed="estas" correct="estás" g={g} />);
    expect(screen.getByText('Your answer')).toBeTruthy();
    expect(screen.getByText('Correct answer')).toBeTruthy();
    expect(screen.getByTestId('answer-compare-typed')).toBeTruthy();
    expect(screen.getByTestId('answer-compare-correct')).toBeTruthy();
  });

  it('highlights the differing letter in both rows (accent = difference)', () => {
    render(<AnswerCompare typed="estas" correct="estás" g={g} />);
    expect(highlighted(screen.getByTestId('answer-compare-typed'))).toBe('a');
    expect(highlighted(screen.getByTestId('answer-compare-correct'))).toBe('á');
  });

  it('highlights the omitted letter in the correct row, the extra letter in the own row', () => {
    render(<AnswerCompare typed="son" correct="somos" g={g} />);
    expect(highlighted(screen.getByTestId('answer-compare-correct'))).toBe('mos');
    expect(highlighted(screen.getByTestId('answer-compare-typed'))).toBe('n');
  });

  it('a case difference is not an error', () => {
    render(<AnswerCompare typed="Somos" correct="somos" g={g} />);
    expect(highlighted(screen.getByTestId('answer-compare-typed'))).toBe('');
    expect(highlighted(screen.getByTestId('answer-compare-correct'))).toBe('');
  });

  it('with an empty answer the own row is a dash', () => {
    render(<AnswerCompare typed="" correct="somos" g={g} />);
    expect(screen.getByTestId('answer-compare-typed').props.children).toBeTruthy();
  });
});

describe('GrammarDrill: wrong conjugation → comparison', () => {
  const topic: LessonV2 = {
    schema: 2,
    topic: 'cmp',
    level: 'A1',
    title: { hu: 't', en: 't', es: 't', de: 't' },
    body: [],
    speak: { hu: 'h', en: 'e', es: 's', de: 'd' },
    items: [{ id: 'form-cmp', kind: 'form', verb: 'ser', person: 'nosotros', answer: 'somos', table: 'x' }],
  };

  it('under Not quite! the own and the correct answer show', () => {
    render(<GrammarDrill topic={topic} learnedLang="es" contentLang="en" onFinish={jest.fn()} kinds={['form']} />);
    fireEvent.changeText(screen.getByTestId('formInput'), 'son');
    fireEvent.press(screen.getByTestId('formCheck'));
    expect(screen.getByText('Your answer')).toBeTruthy();
    expect(screen.getByText('Correct answer')).toBeTruthy();
    expect(highlighted(screen.getByTestId('answer-compare-correct'))).toBe('mos');
  });
});
